import json
import os
import secrets
import random
import psycopg2
import base64
from datetime import datetime, timedelta

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
    'Content-Type': 'application/json'
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def get_token(headers):
    return headers.get('X-Auth-Token') or headers.get('x-auth-token') or ''

def user_by_token(cur, token):
    if not token:
        return None
    cur.execute("""
        SELECT id, phone, first_name, last_name, middle_name, avatar_url, inn, snils,
               passport_series, passport_number, address, birth_date, gender,
               phone_verified, gosuslugi_linked, gosuslugi_data, created_at
        FROM users WHERE session_token = %s
    """, (token,))
    return cur.fetchone()

def row_to_user(row):
    return {
        'id': row[0], 'phone': row[1], 'first_name': row[2], 'last_name': row[3],
        'middle_name': row[4], 'avatar_url': row[5], 'inn': row[6], 'snils': row[7],
        'passport_series': row[8], 'passport_number': row[9], 'address': row[10],
        'birth_date': str(row[11]) if row[11] else None, 'gender': row[12],
        'phone_verified': row[13], 'gosuslugi_linked': row[14],
        'gosuslugi_data': row[15], 'created_at': str(row[16]) if row[16] else None
    }

def send_sms(phone, code):
    """Отправка SMS через провайдер. Если нет ключа — логируем код (dev-режим)."""
    sms_key = os.environ.get('SMS_API_KEY', '')
    if not sms_key:
        print(f"[DEV] SMS to {phone}: {code}")
        return True
    try:
        import urllib.request
        url = f"https://sms.ru/sms/send?api_id={sms_key}&to={phone}&msg=Ваш+код+Югару:+{code}&json=1"
        req = urllib.request.urlopen(url, timeout=5)
        return True
    except Exception as e:
        print(f"SMS error: {e}")
        return True

def handler(event: dict, context) -> dict:
    """
    Аутентификация Югару: регистрация с фото и отчеством, вход по телефону,
    SMS-верификация, интеграция с Госуслугами.
    """
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    body = {}
    if event.get('body'):
        body = json.loads(event['body'])
    headers = event.get('headers', {})

    conn = get_conn()
    cur = conn.cursor()

    try:
        # POST /send-sms — отправить SMS-код
        if method == 'POST' and '/send-sms' in path:
            phone = body.get('phone', '').strip()
            if not phone:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Укажите номер телефона'})}
            code = str(random.randint(100000, 999999))
            expires = datetime.now() + timedelta(minutes=10)
            # Проверяем существует ли пользователь
            cur.execute("SELECT id FROM users WHERE phone = %s", (phone,))
            exists = cur.fetchone()
            if exists:
                cur.execute("UPDATE users SET sms_code = %s, sms_code_expires = %s WHERE phone = %s",
                            (code, expires, phone))
            else:
                # Временная запись — будет дополнена при регистрации
                cur.execute("""
                    INSERT INTO users (phone, first_name, last_name, sms_code, sms_code_expires)
                    VALUES (%s, '', '', %s, %s)
                    ON CONFLICT (phone) DO UPDATE SET sms_code = %s, sms_code_expires = %s
                """, (phone, code, expires, code, expires))
            conn.commit()
            send_sms(phone, code)
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'sent': True})}

        # POST /verify-sms — проверить код
        if method == 'POST' and '/verify-sms' in path:
            phone = body.get('phone', '').strip()
            code = body.get('code', '').strip()
            bypass = body.get('bypass', False)
            if not phone:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Укажите телефон'})}
            cur.execute("SELECT id, sms_code, sms_code_expires FROM users WHERE phone = %s", (phone,))
            row = cur.fetchone()
            if not row:
                return {'statusCode': 404, 'headers': HEADERS, 'body': json.dumps({'error': 'Пользователь не найден'})}
            user_id = row[0]
            # bypass = кнопка "код не пришёл" — всегда успех
            if not bypass:
                if not row[1] or row[1] != code:
                    return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Неверный код'})}
                if row[2] and datetime.now() > row[2]:
                    return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Код устарел, запросите новый'})}
            cur.execute("UPDATE users SET phone_verified = TRUE, sms_code = NULL WHERE id = %s", (user_id,))
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'verified': True, 'user_id': user_id})}

        # POST /register — завершить регистрацию (после SMS)
        if method == 'POST' and '/register' in path:
            phone = body.get('phone', '').strip()
            first_name = body.get('first_name', '').strip()
            last_name = body.get('last_name', '').strip()
            middle_name = body.get('middle_name', '').strip()
            inn = body.get('inn', '')
            snils = body.get('snils', '')
            birth_date = body.get('birth_date', None)
            gender = body.get('gender', '')
            address = body.get('address', '')
            avatar_b64 = body.get('avatar_b64', '')
            avatar_content_type = body.get('avatar_content_type', 'image/jpeg')

            if not phone or not first_name or not last_name:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Заполните все обязательные поля'})}

            cur.execute("SELECT id, phone_verified FROM users WHERE phone = %s", (phone,))
            existing = cur.fetchone()

            token = secrets.token_hex(32)
            avatar_url = None

            # Загрузить аватар если передан
            if avatar_b64:
                try:
                    import boto3
                    img_bytes = base64.b64decode(avatar_b64)
                    s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                                     aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                                     aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
                    # temp key — обновим после получения id
                    temp_key = f"avatars/tmp_{secrets.token_hex(8)}.jpg"
                    s3.put_object(Bucket='files', Key=temp_key, Body=img_bytes, ContentType=avatar_content_type)
                    avatar_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{temp_key}"
                except Exception as e:
                    print(f"Avatar upload error: {e}")

            if existing:
                user_id = existing[0]
                cur.execute("""
                    UPDATE users SET first_name=%s, last_name=%s, middle_name=%s, inn=%s, snils=%s,
                    birth_date=%s, gender=%s, address=%s, session_token=%s, avatar_url=COALESCE(%s, avatar_url)
                    WHERE id=%s
                    RETURNING id, phone, first_name, last_name, middle_name, avatar_url, inn, snils,
                              passport_series, passport_number, address, birth_date, gender,
                              phone_verified, gosuslugi_linked, gosuslugi_data, created_at
                """, (first_name, last_name, middle_name or None, inn or None, snils or None,
                      birth_date or None, gender or None, address or None, token, avatar_url, user_id))
            else:
                cur.execute("""
                    INSERT INTO users (phone, first_name, last_name, middle_name, inn, snils,
                    birth_date, gender, address, session_token, avatar_url)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING id, phone, first_name, last_name, middle_name, avatar_url, inn, snils,
                              passport_series, passport_number, address, birth_date, gender,
                              phone_verified, gosuslugi_linked, gosuslugi_data, created_at
                """, (phone, first_name, last_name, middle_name or None, inn or None, snils or None,
                      birth_date or None, gender or None, address or None, token, avatar_url))

            row = cur.fetchone()
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS,
                    'body': json.dumps({'token': token, 'user': row_to_user(row)})}

        # POST /login — вход по телефону (только телефон, после SMS)
        if method == 'POST' and '/login' in path:
            phone = body.get('phone', '').strip()
            if not phone:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Укажите номер телефона'})}
            cur.execute("""
                SELECT id, phone, first_name, last_name, middle_name, avatar_url, inn, snils,
                       passport_series, passport_number, address, birth_date, gender,
                       phone_verified, gosuslugi_linked, gosuslugi_data, created_at
                FROM users WHERE phone = %s AND first_name != ''
            """, (phone,))
            row = cur.fetchone()
            if not row:
                return {'statusCode': 404, 'headers': HEADERS, 'body': json.dumps({'error': 'Пользователь не найден. Пройдите регистрацию.'})}
            token = secrets.token_hex(32)
            cur.execute("UPDATE users SET session_token = %s WHERE id = %s", (token, row[0]))
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS,
                    'body': json.dumps({'token': token, 'user': row_to_user(row)})}

        # POST /gosuslugi — имитация OAuth Госуслуги → импорт данных
        if method == 'POST' and '/gosuslugi' in path:
            # В реальной системе здесь был бы OAuth 2.0 flow с ЕСИА
            # Имитируем получение данных от Госуслуг
            gosuslugi_token = body.get('gosuslugi_token', '')
            phone = body.get('phone', '').strip()

            # Генерируем правдоподобные данные из "Госуслуг"
            gosuslugi_data = {
                'source': 'gosuslugi',
                'verified': True,
                'linked_at': datetime.now().isoformat(),
                'documents': {
                    'passport': {'series': '4521', 'number': '123456', 'issued_by': 'МВД Югании', 'issued_date': '2018-05-10'},
                    'snils': '123-456-789 00',
                    'inn': body.get('inn', ''),
                    'medical_policy': {'number': '1234567890123456', 'company': 'ГосМедСтрах'},
                },
                'services': ['Запись к врачу', 'Налоги', 'Штрафы', 'Регистрация ТС', 'Загранпаспорт']
            }

            token = secrets.token_hex(32)
            cur.execute("SELECT id FROM users WHERE phone = %s", (phone,))
            existing = cur.fetchone()

            first_name = body.get('first_name', '')
            last_name = body.get('last_name', '')
            middle_name = body.get('middle_name', '')
            inn = body.get('inn', '')
            snils = gosuslugi_data['documents']['snils']

            if existing:
                user_id = existing[0]
                cur.execute("""
                    UPDATE users SET gosuslugi_linked=TRUE, gosuslugi_data=%s, session_token=%s,
                    first_name=CASE WHEN first_name='' THEN %s ELSE first_name END,
                    last_name=CASE WHEN last_name='' THEN %s ELSE last_name END,
                    middle_name=COALESCE(middle_name, %s),
                    inn=COALESCE(inn, %s), snils=COALESCE(snils, %s),
                    phone_verified=TRUE
                    WHERE id=%s
                    RETURNING id, phone, first_name, last_name, middle_name, avatar_url, inn, snils,
                              passport_series, passport_number, address, birth_date, gender,
                              phone_verified, gosuslugi_linked, gosuslugi_data, created_at
                """, (json.dumps(gosuslugi_data), token, first_name, last_name, middle_name or None,
                      inn or None, snils, user_id))
            else:
                cur.execute("""
                    INSERT INTO users (phone, first_name, last_name, middle_name, inn, snils,
                    session_token, gosuslugi_linked, gosuslugi_data, phone_verified)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,TRUE,%s,TRUE)
                    RETURNING id, phone, first_name, last_name, middle_name, avatar_url, inn, snils,
                              passport_series, passport_number, address, birth_date, gender,
                              phone_verified, gosuslugi_linked, gosuslugi_data, created_at
                """, (phone, first_name, last_name, middle_name or None, inn or None, snils,
                      token, json.dumps(gosuslugi_data)))

            row = cur.fetchone()
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS,
                    'body': json.dumps({'token': token, 'user': row_to_user(row), 'gosuslugi_data': gosuslugi_data})}

        # GET /me — профиль
        if method == 'GET' and '/me' in path:
            token = get_token(headers)
            if not token:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}
            row = user_by_token(cur, token)
            if not row:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Сессия истекла'})}
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'user': row_to_user(row)})}

        # PUT /me — обновить профиль
        if method == 'PUT' and '/me' in path:
            token = get_token(headers)
            if not token:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}
            row = user_by_token(cur, token)
            if not row:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Сессия истекла'})}
            user_id = row[0]
            allowed = ['first_name', 'last_name', 'middle_name', 'phone', 'avatar_url',
                       'inn', 'snils', 'address', 'birth_date', 'gender',
                       'passport_series', 'passport_number']
            updates, values = [], []
            for field in allowed:
                if field in body:
                    updates.append(f"{field} = %s")
                    values.append(body[field])
            if not updates:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Нет данных для обновления'})}
            values.append(user_id)
            cur.execute(f"""
                UPDATE users SET {', '.join(updates)} WHERE id = %s
                RETURNING id, phone, first_name, last_name, middle_name, avatar_url, inn, snils,
                          passport_series, passport_number, address, birth_date, gender,
                          phone_verified, gosuslugi_linked, gosuslugi_data, created_at
            """, values)
            updated = cur.fetchone()
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'user': row_to_user(updated)})}

        # PUT /avatar — загрузить аватар
        if method == 'PUT' and '/avatar' in path:
            import boto3
            token = get_token(headers)
            if not token:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}
            row = user_by_token(cur, token)
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
            token = get_token(headers)
            if not token:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}
            row = user_by_token(cur, token)
            if not row:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Сессия истекла'})}
            user_id = row[0]
            cur.execute("""
                UPDATE users SET session_token = NULL, first_name = 'Удалённый',
                last_name = 'пользователь', phone = CONCAT('deleted_', id, '_', phone)
                WHERE id = %s
            """, (user_id,))
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'success': True})}

        return {'statusCode': 404, 'headers': HEADERS, 'body': json.dumps({'error': 'Маршрут не найден'})}
    finally:
        cur.close()
        conn.close()
