DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS chairs CASCADE;
DROP TABLE IF EXISTS restaurant_tables CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff', 'customer')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE TABLE restaurant_tables (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'cleaning')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE TABLE restaurant.chairs (
  id SERIAL PRIMARY KEY,
  table_id INT NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  chair_label VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'vacant' CHECK (status IN ('vacant', 'locked', 'occupied')),
  locked_until TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE TABLE menu_items (
  id SERIAL PRIMARY KEY,
  item_name VARCHAR(120) NOT NULL,
  category VARCHAR(60) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  image_url TEXT,
  stock_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE TABLE reservations (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  table_id INT REFERENCES restaurant_tables(id),
  num_guests INT NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'finished', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_code CHAR(3) UNIQUE NOT NULL,
  user_id INT REFERENCES users(id),
  reservation_id INT REFERENCES reservations(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('dine_in', 'takeout')),
  status VARCHAR(20) DEFAULT 'preparing' CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  payment_status VARCHAR(20) DEFAULT 'paid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  total_amount NUMERIC(10, 2) NOT NULL,
  qr_code TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INT NOT NULL REFERENCES menu_items(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);


ALTER TABLE restaurant.orders
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) DEFAULT 'Cash';

ALTER TABLE restaurant.orders
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) DEFAULT 'Cash';
