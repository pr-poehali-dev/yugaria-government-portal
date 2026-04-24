import json
import os
import hashlib
import secrets
import psycopg2

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
    'Content-Type': 'application/json'
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def handler(event: dict, context) -> dict:
    """Аутентификация пользователей портала Югару: регистрация, вход, профиль, обновление, удаление."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    body = {}
    if event.get('body'):
        body = json.loads(event['body'])

    conn = get_conn()
    cur = conn.cursor()

    try:
        # POST /register
        if method == 'POST' and '/register' in path:
            phone = body.get('phone', '').strip()
            first_name = body.get('first_name', '').strip()
            last_name = body.get('last_name', '').strip()
            if not phone or not first_name or not last_name:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Заполните все поля'})}
            cur.execute("SELECT id FROM users WHERE phone = %s", (phone,))
            if cur.fetchone():
                return {'statusCode': 409, 'headers': HEADERS, 'body': json.dumps({'error': 'Номер телефона уже зарегистрирован'})}
            token = secrets.token_hex(32)
            cur.execute(
                "INSERT INTO users (phone, first_name, last_name, session_token) VALUES (%s, %s, %s, %s) RETURNING id, phone, first_name, last_name, created_at",
                (phone, first_name, last_name, token)
            )
            row = cur.fetchone()
            conn.commit()
            return {
                'statusCode': 200,
                'headers': HEADERS,
                'body': json.dumps({'token': token, 'user': {'id': row[0], 'phone': row[1], 'first_name': row[2], 'last_name': row[3]}})
            }

        # POST /login
        if method == 'POST' and '/login' in path:
            phone = body.get('phone', '').strip()
            first_name = body.get('first_name', '').strip()
            last_name = body.get('last_name', '').strip()
            if not phone or not first_name or not last_name:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Заполните все поля'})}
            cur.execute("SELECT id, phone, first_name, last_name, avatar_url, inn FROM users WHERE phone = %s AND first_name = %s AND last_name = %s", (phone, first_name, last_name))
            row = cur.fetchone()
            if not row:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Неверные данные. Проверьте телефон, имя и фамилию.'})}
            token = secrets.token_hex(32)
            cur.execute("UPDATE users SET session_token = %s WHERE id = %s", (token, row[0]))
            conn.commit()
            return {
                'statusCode': 200,
                'headers': HEADERS,
                'body': json.dumps({'token': token, 'user': {'id': row[0], 'phone': row[1], 'first_name': row[2], 'last_name': row[3], 'avatar_url': row[4], 'inn': row[5]}})
            }

        # GET /me — получить профиль
        if method == 'GET' and '/me' in path:
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            if not token:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}
            cur.execute("SELECT id, phone, first_name, last_name, avatar_url, inn, created_at FROM users WHERE session_token = %s", (token,))
            row = cur.fetchone()
            if not row:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Сессия истекла'})}
            return {
                'statusCode': 200,
                'headers': HEADERS,
                'body': json.dumps({'user': {'id': row[0], 'phone': row[1], 'first_name': row[2], 'last_name': row[3], 'avatar_url': row[4], 'inn': row[5], 'created_at': str(row[6])}})
            }

        # PUT /me — обновить профиль
        if method == 'PUT' and '/me' in path:
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            if not token:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}
            cur.execute("SELECT id FROM users WHERE session_token = %s", (token,))
            row = cur.fetchone()
            if not row:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Сессия истекла'})}
            user_id = row[0]
            updates = []
            values = []
            for field in ['first_name', 'last_name', 'phone', 'avatar_url', 'inn']:
                if field in body:
                    updates.append(f"{field} = %s")
                    values.append(body[field])
            if not updates:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Нет данных для обновления'})}
            values.append(user_id)
            cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s RETURNING id, phone, first_name, last_name, avatar_url, inn", values)
            updated = cur.fetchone()
            conn.commit()
            return {
                'statusCode': 200,
                'headers': HEADERS,
                'body': json.dumps({'user': {'id': updated[0], 'phone': updated[1], 'first_name': updated[2], 'last_name': updated[3], 'avatar_url': updated[4], 'inn': updated[5]}})
            }

        # PUT /avatar — загрузить аватар
        if method == 'PUT' and '/avatar' in path:
            import base64, boto3
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            if not token:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}
            cur.execute("SELECT id FROM users WHERE session_token = %s", (token,))
            row = cur.fetchone()
            if not row:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Сессия истекла'})}
            user_id = row[0]
            image_data = body.get('image')
            content_type = body.get('content_type', 'image/jpeg')
            if not image_data:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Нет изображения'})}
            img_bytes = base64.b64decode(image_data)
            s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                              aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                              aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
            key = f"avatars/user_{user_id}.jpg"
            s3.put_object(Bucket='files', Key=key, Body=img_bytes, ContentType=content_type)
            cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
            cur.execute("UPDATE users SET avatar_url = %s WHERE id = %s", (cdn_url, user_id))
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'avatar_url': cdn_url})}

        # DELETE /me — удалить аккаунт
        if method == 'DELETE' and '/me' in path:
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            if not token:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}
            cur.execute("SELECT id FROM users WHERE session_token = %s", (token,))
            row = cur.fetchone()
            if not row:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Сессия истекла'})}
            user_id = row[0]
            cur.execute("UPDATE users SET session_token = NULL, first_name = 'Удалённый', last_name = 'пользователь', phone = CONCAT('deleted_', id, '_', phone) WHERE id = %s", (user_id,))
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'success': True})}

        return {'statusCode': 404, 'headers': HEADERS, 'body': json.dumps({'error': 'Маршрут не найден'})}
    finally:
        cur.close()
        conn.close()
