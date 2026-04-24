import json
import os
import psycopg2
import base64

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
    cur.execute("SELECT id, first_name, last_name FROM users WHERE session_token = %s", (token,))
    return cur.fetchone()

def handler(event: dict, context) -> dict:
    """Госуслуги портала Югару: штрафы, налоги, запись к врачу, документы, оплата."""
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
        user = get_user(cur, token)
        if not user and path != '/':
            return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}

        user_id = user[0] if user else None

        # GET /fines?inn=...&car_number=...
        if method == 'GET' and '/fines' in path:
            params = event.get('queryStringParameters') or {}
            inn = params.get('inn')
            car_number = params.get('car_number')
            where = "WHERE user_id = %s"
            vals = [user_id]
            if inn:
                where += " OR inn = %s"
                vals.append(inn)
            if car_number:
                where += " OR car_number = %s"
                vals.append(car_number)
            cur.execute(f"SELECT id, amount, description, status, issued_at, paid_at, inn, car_number FROM fines {where} ORDER BY issued_at DESC", vals)
            rows = cur.fetchall()
            fines = [{'id': r[0], 'amount': float(r[1]), 'description': r[2], 'status': r[3],
                      'issued_at': str(r[4]), 'paid_at': str(r[5]) if r[5] else None, 'inn': r[6], 'car_number': r[7]} for r in rows]
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'fines': fines})}

        # GET /taxes?inn=...
        if method == 'GET' and '/taxes' in path:
            params = event.get('queryStringParameters') or {}
            inn = params.get('inn')
            where = "WHERE user_id = %s"
            vals = [user_id]
            if inn:
                where += " OR inn = %s"
                vals.append(inn)
            cur.execute(f"SELECT id, tax_type, amount, period, status, due_date, paid_at, inn FROM taxes {where} ORDER BY due_date DESC", vals)
            rows = cur.fetchall()
            taxes = [{'id': r[0], 'tax_type': r[1], 'amount': float(r[2]), 'period': r[3], 'status': r[4],
                      'due_date': str(r[5]) if r[5] else None, 'paid_at': str(r[6]) if r[6] else None, 'inn': r[7]} for r in rows]
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'taxes': taxes})}

        # POST /pay — оплатить штраф или налог
        if method == 'POST' and '/pay' in path:
            payment_type = body.get('payment_type')
            reference_id = body.get('reference_id')
            amount = body.get('amount')
            if not payment_type or not reference_id or not amount:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Нет данных для оплаты'})}
            cur.execute("INSERT INTO payments (user_id, payment_type, reference_id, amount, status) VALUES (%s, %s, %s, %s, 'completed') RETURNING id",
                        (user_id, payment_type, reference_id, amount))
            payment_id = cur.fetchone()[0]
            if payment_type == 'fine':
                cur.execute("UPDATE fines SET status = 'paid', paid_at = NOW() WHERE id = %s", (reference_id,))
            elif payment_type == 'tax':
                cur.execute("UPDATE taxes SET status = 'paid', paid_at = NOW() WHERE id = %s", (reference_id,))
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'payment_id': payment_id, 'status': 'completed'})}

        # GET /appointments
        if method == 'GET' and '/appointments' in path:
            cur.execute("SELECT id, service_type, doctor_name, appointment_date, appointment_time, status, notes, created_at FROM appointments WHERE user_id = %s ORDER BY appointment_date DESC", (user_id,))
            rows = cur.fetchall()
            apps = [{'id': r[0], 'service_type': r[1], 'doctor_name': r[2], 'appointment_date': str(r[3]),
                     'appointment_time': r[4], 'status': r[5], 'notes': r[6], 'created_at': str(r[7])} for r in rows]
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'appointments': apps})}

        # POST /appointments — записаться к врачу
        if method == 'POST' and '/appointments' in path:
            service_type = body.get('service_type', '').strip()
            doctor_name = body.get('doctor_name', '').strip()
            appointment_date = body.get('appointment_date')
            appointment_time = body.get('appointment_time', '').strip()
            notes = body.get('notes', '')
            if not service_type or not appointment_date or not appointment_time:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Заполните все поля'})}
            cur.execute(
                "INSERT INTO appointments (user_id, service_type, doctor_name, appointment_date, appointment_time, notes) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (user_id, service_type, doctor_name, appointment_date, appointment_time, notes)
            )
            app_id = cur.fetchone()[0]
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'id': app_id})}

        # GET /documents
        if method == 'GET' and '/documents' in path:
            cur.execute("SELECT id, doc_type, doc_number, doc_data, file_url, created_at FROM documents WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
            rows = cur.fetchall()
            docs = [{'id': r[0], 'doc_type': r[1], 'doc_number': r[2], 'doc_data': r[3], 'file_url': r[4], 'created_at': str(r[5])} for r in rows]
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'documents': docs})}

        # POST /documents — добавить документ
        if method == 'POST' and '/documents' in path:
            import boto3
            doc_type = body.get('doc_type', '').strip()
            doc_number = body.get('doc_number', '')
            doc_data = body.get('doc_data', {})
            file_data = body.get('file_data')
            file_name = body.get('file_name', 'document.jpg')
            if not doc_type:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Укажите тип документа'})}
            file_url = None
            if file_data:
                img_bytes = base64.b64decode(file_data)
                s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                                  aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                                  aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
                key = f"documents/user_{user_id}/{doc_type}_{file_name}"
                s3.put_object(Bucket='files', Key=key, Body=img_bytes, ContentType='image/jpeg')
                file_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
            cur.execute(
                "INSERT INTO documents (user_id, doc_type, doc_number, doc_data, file_url) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (user_id, doc_type, doc_number, json.dumps(doc_data), file_url)
            )
            doc_id = cur.fetchone()[0]
            conn.commit()
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'id': doc_id, 'file_url': file_url})}

        return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'status': 'ok'})}
    finally:
        cur.close()
        conn.close()
