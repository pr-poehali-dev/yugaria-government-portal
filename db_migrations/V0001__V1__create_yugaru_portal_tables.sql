
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  inn VARCHAR(12),
  session_token VARCHAR(64) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  author_id INTEGER REFERENCES users(id),
  title VARCHAR(300) NOT NULL,
  content TEXT NOT NULL,
  is_official BOOLEAN DEFAULT FALSE,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_comments (
  id SERIAL PRIMARY KEY,
  news_id INTEGER REFERENCES news(id),
  author_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  doc_type VARCHAR(50) NOT NULL,
  doc_number VARCHAR(100),
  doc_data JSONB,
  file_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fines (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  inn VARCHAR(12),
  car_number VARCHAR(20),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'unpaid',
  issued_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS taxes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  inn VARCHAR(12),
  tax_type VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  period VARCHAR(50),
  status VARCHAR(20) DEFAULT 'unpaid',
  due_date DATE,
  paid_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  service_type VARCHAR(100) NOT NULL,
  doctor_name VARCHAR(200),
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  payment_type VARCHAR(50) NOT NULL,
  reference_id INTEGER,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
