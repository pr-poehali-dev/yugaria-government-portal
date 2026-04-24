import json
import os
import psycopg2

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
    'Content-Type': 'application/json'
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def get_user(cur, token):
    if not token:
        return None
    cur.execute("SELECT id, first_name, last_name, avatar_url FROM users WHERE session_token = %s", (token,))
    return cur.fetchone()

def handler(event: dict, context) -> dict:
    """CRUD для новостей портала Югару: получить список, создать, лайкнуть, добавить комментарий."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    body = {}
    if event.get('body'):
        body = json.loads(event['body'])

    token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')

    conn = get_conn()
    cur = conn.cursor()

    try:
        # GET /news — список новостей
        if method == 'GET' and path.rstrip('/').endswith('/news') or path == '/':
            cur.execute("""
                SELECT n.id, n.title, n.content, n.is_official, n.likes, n.created_at,
                       u.first_name, u.last_name, u.avatar_url, n.author_id
                FROM news n
                LEFT JOIN users u ON n.author_id = u.id
                ORDER BY n.created_at DESC
                LIMIT 50
            """)
            rows = cur.fetchall()
            news_list = []
            for r in rows:
                news_list.append({
                    'id': r[0], 'title': r[1], 'content': r[2],
                    'is_official': r[3], 'likes': r[4], 'created_at': str(r[5]),
                    'author_name': f"{r[6]} {r[7]}" if r[6] else 'Редакция',
                    'author_avatar': r[8], 'author_id': r[9]
                })
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'news': news_list})}

        # POST /news — создать новость
        if method == 'POST' and '/news' in path and '/comment' not in path and '/like' not in path:
            user = get_user(cur, token)
            if not user:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}
            title = body.get('title', '').strip()
            content = body.get('content', '').strip()
            if not title or not content:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Введите заголовок и текст'})}
            cur.execute(
                "INSERT INTO news (author_id, title, content, is_official) VALUES (%s, %s, %s, FALSE) RETURNING id, created_at",
                (user[0], title, content)
            )
            row = cur.fetchone()
            conn.commit()
            return {
                'statusCode': 200, 'headers': HEADERS,
                'body': json.dumps({'id': row[0], 'created_at': str(row[1])})
            }

        # POST /news/{id}/like
        if method == 'POST' and '/like' in path:
            parts = path.strip('/').split('/')
            news_id = None
            for i, p in enumerate(parts):
                if p == 'like' and i > 0:
                    try:
                        news_id = int(parts[i-1])
                    except:
                        pass
            if not news_id:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Нет ID новости'})}
            cur.execute("UPDATE news SET likes = likes + 1 WHERE id = %s RETURNING likes", (news_id,))
            row = cur.fetchone()
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'likes': row[0] if row else 0})}

        # GET /news/{id}/comments
        if method == 'GET' and '/comment' in path:
            parts = path.strip('/').split('/')
            news_id = None
            for i, p in enumerate(parts):
                if 'comment' in p and i > 0:
                    try:
                        news_id = int(parts[i-1])
                    except:
                        pass
            if not news_id:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Нет ID новости'})}
            cur.execute("""
                SELECT nc.id, nc.content, nc.created_at, u.first_name, u.last_name, u.avatar_url
                FROM news_comments nc
                LEFT JOIN users u ON nc.author_id = u.id
                WHERE nc.news_id = %s ORDER BY nc.created_at ASC
            """, (news_id,))
            rows = cur.fetchall()
            comments = [{'id': r[0], 'content': r[1], 'created_at': str(r[2]),
                         'author_name': f"{r[3]} {r[4]}", 'author_avatar': r[5]} for r in rows]
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'comments': comments})}

        # POST /news/{id}/comments
        if method == 'POST' and '/comment' in path:
            user = get_user(cur, token)
            if not user:
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}
            parts = path.strip('/').split('/')
            news_id = None
            for i, p in enumerate(parts):
                if 'comment' in p and i > 0:
                    try:
                        news_id = int(parts[i-1])
                    except:
                        pass
            content = body.get('content', '').strip()
            if not news_id or not content:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Нет данных'})}
            cur.execute(
                "INSERT INTO news_comments (news_id, author_id, content) VALUES (%s, %s, %s) RETURNING id, created_at",
                (news_id, user[0], content)
            )
            row = cur.fetchone()
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS,
                    'body': json.dumps({'id': row[0], 'created_at': str(row[1]),
                                        'author_name': f"{user[1]} {user[2]}", 'author_avatar': user[3]})}

        return {'statusCode': 404, 'headers': HEADERS, 'body': json.dumps({'error': 'Маршрут не найден'})}
    finally:
        cur.close()
        conn.close()
