CREATE SCHEMA IF NOT EXISTS restaurant;

SET search_path TO restaurant, public;

-- ========================================================
-- DROP EXISTING TABLES IN REVERSE ORDER OF RELATIONSHIPS
-- ========================================================
DROP TABLE IF EXISTS order_history CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS chairs CASCADE;
DROP TABLE IF EXISTS restaurant_tables CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ========================================================
-- CREATE DATABASE TABLES
-- ========================================================

-- USERS TABLE
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  username VARCHAR(32) UNIQUE,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff', 'customer')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- RESTAURANT TABLES TABLE
CREATE TABLE restaurant_tables (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'reserved', 'cleaning')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- CHAIRS TABLE
CREATE TABLE chairs (
  id SERIAL PRIMARY KEY,
  table_id INT NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  chair_label VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'vacant' CHECK (status IN ('vacant', 'locked', 'occupied', 'reserved')),
  locked_until TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- MENU ITEMS TABLE
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

-- RESERVATIONS TABLE
CREATE TABLE reservations (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  table_id INT REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  num_guests INT NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'reserved')),
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  contact_number VARCHAR(30) NOT NULL,
  reservation_code VARCHAR(20) UNIQUE,
  qr_code TEXT,
  reservation_token TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- ORDERS TABLE
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_code CHAR(3) UNIQUE NOT NULL,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  reservation_id INT REFERENCES reservations(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('dine_in', 'takeout')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  payment_method VARCHAR(30) DEFAULT 'Cash',
  total_amount NUMERIC(10, 2) NOT NULL,
  qr_code TEXT,
  receipt_token TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- ORDER ITEMS TABLE
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  quantity INT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- ORDER HISTORY TABLE
CREATE TABLE order_history (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  order_code CHAR(3),
  customer_name VARCHAR(120),
  customer_email VARCHAR(120),
  order_type VARCHAR(20),
  payment_method VARCHAR(30),
  payment_status VARCHAR(20),
  total_amount NUMERIC(10, 2),
  ordered_items TEXT,
  completed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================================================
-- INSERT SAMPLE DATA
-- ========================================================

-- A. INSERT USERS
INSERT INTO users (full_name, email, password_hash, role) VALUES
('Restaurant Admin', 'admin@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'admin'),
('Staff User', 'staff@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'staff'),
('Juan Dela Cruz', 'juan@gmail.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'customer'),
('Maria Santos', 'maria@gmail.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'customer');

-- Additional users, safe if email already exists
INSERT INTO users (full_name, email, password_hash, role) VALUES
('Admin User', 'admin@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'admin'),
('Staff User', 'staff@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'staff'),
('Customer User', 'customer@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'customer')
ON CONFLICT (email) DO NOTHING;

-- B. INSERT RESTAURANT TABLES
INSERT INTO restaurant_tables (table_name, position_x, position_y, status) VALUES
('Table 1', 120, 120, 'vacant'),
('Table 2', 380, 120, 'vacant'),
('Table 3', 120, 350, 'vacant'),
('Table 4', 380, 350, 'vacant'),
('Table 5', 650, 120, 'vacant'),
('Table 6', 650, 350, 'vacant'),
('Table 7', 200, 550, 'vacant'),
('Table 8', 500, 550, 'vacant'),
('Table 9', 800, 120, 'vacant'),
('Table 10', 800, 350, 'vacant'),
('Table 11', 120, 720, 'vacant'),
('Table 12', 380, 720, 'vacant'),
('Table 13', 650, 720, 'vacant'),
('Table 14', 800, 720, 'vacant');

-- C. INSERT CHAIRS
INSERT INTO chairs (table_id, chair_label, status) VALUES
(1, 'T1-C1', 'vacant'), (1, 'T1-C2', 'vacant'), (1, 'T1-C3', 'vacant'), (1, 'T1-C4', 'vacant'),
(2, 'T2-C1', 'vacant'), (2, 'T2-C2', 'vacant'), (2, 'T2-C3', 'vacant'), (2, 'T2-C4', 'vacant'),
(3, 'T3-C1', 'vacant'), (3, 'T3-C2', 'vacant'), (3, 'T3-C3', 'vacant'), (3, 'T3-C4', 'vacant'),
(4, 'T4-C1', 'vacant'), (4, 'T4-C2', 'vacant'), (4, 'T4-C3', 'vacant'), (4, 'T4-C4', 'vacant'),
(5, 'T5-C1', 'vacant'), (5, 'T5-C2', 'vacant'), (5, 'T5-C3', 'vacant'), (5, 'T5-C4', 'vacant'),
(6, 'T6-C1', 'vacant'), (6, 'T6-C2', 'vacant'), (6, 'T6-C3', 'vacant'), (6, 'T6-C4', 'vacant'),
(7, 'T7-C1', 'vacant'), (7, 'T7-C2', 'vacant'), (7, 'T7-C3', 'vacant'), (7, 'T7-C4', 'vacant'), (7, 'T7-C5', 'vacant'), (7, 'T7-C6', 'vacant'),
(8, 'T8-C1', 'vacant'), (8, 'T8-C2', 'vacant'), (8, 'T8-C3', 'vacant'), (8, 'T8-C4', 'vacant'), (8, 'T8-C5', 'vacant'), (8, 'T8-C6', 'vacant'), (8, 'T8-C7', 'vacant'), (8, 'T8-C8', 'vacant'),
(9, 'T9-C1', 'vacant'), (9, 'T9-C2', 'vacant'), (9, 'T9-C3', 'vacant'), (9, 'T9-C4', 'vacant'), (9, 'T9-C5', 'vacant'), (9, 'T9-C6', 'vacant'), (9, 'T9-C7', 'vacant'), (9, 'T9-C8', 'vacant'),
(10, 'T10-C1', 'vacant'), (10, 'T10-C2', 'vacant'), (10, 'T10-C3', 'vacant'), (10, 'T10-C4', 'vacant'), (10, 'T10-C5', 'vacant'), (10, 'T10-C6', 'vacant'), (10, 'T10-C7', 'vacant'), (10, 'T10-C8', 'vacant'),
(11, 'T11-C1', 'vacant'), (11, 'T11-C2', 'vacant'),
(12, 'T12-C1', 'vacant'), (12, 'T12-C2', 'vacant'),
(13, 'T13-C1', 'vacant'), (13, 'T13-C2', 'vacant'),
(14, 'T14-C1', 'vacant'), (14, 'T14-C2', 'vacant');

-- D. INSERT MENU ITEMS
INSERT INTO menu_items (item_name, category, description, price, image_url, stock_count) VALUES
('Lumpiang Shanghai', 'Appetizers', 'Crispy fried spring rolls with sweet chili sauce', 120.00, 'images/menu-images/lumpia.jpg', 50),
('Chicken Wings', 'Appetizers', 'Buffalo-style chicken wings with dip', 180.00, 'images/menu-images/wings.jpg', 45),
('Sisig Fries', 'Appetizers', 'Fries topped with sizzling pork sisig', 150.00, 'images/menu-images/sisig-fries.jpg', 40),
('Garlic Butter Shrimp', 'Appetizers', 'Shrimp sautéed in garlic butter sauce', 220.00, 'images/menu-images/shrimp.jpg', 35),
('Chicken Adobo', 'Main Course', 'Classic Filipino chicken cooked in soy sauce and vinegar', 150.00, 'images/menu-images/adobo.jpg', 50),
('Pork Sinigang', 'Main Course', 'Sour tamarind soup with pork and vegetables', 170.00, 'images/menu-images/sinigang.jpg', 45),
('Beef Kare-Kare', 'Main Course', 'Peanut stew with oxtail and vegetables', 220.00, 'images/menu-images/karekare.jpg', 40),
('Lechon Kawali', 'Main Course', 'Deep-fried crispy pork belly', 200.00, 'images/menu-images/lechon.jpg', 45),
('Grilled Bangus', 'Main Course', 'Marinated milkfish grilled to perfection', 180.00, 'images/menu-images/bangus.jpg', 40),
('Bulalo', 'Main Course', 'Beef shank soup with corn and vegetables', 250.00, 'images/menu-images/bulalo.jpg', 35),
('Pork Caldereta', 'Main Course', 'Rich tomato-based pork stew with liver sauce', 180.00, 'images/menu-images/caldereta.jpg', 45),
('Chicken Inasal Meal', 'Rice Meals', 'Grilled chicken with garlic rice and egg', 160.00, 'images/menu-images/inasal.jpg', 50),
('Pork BBQ Meal', 'Rice Meals', 'Barbecue skewers with rice and atchara', 140.00, 'images/menu-images/bbq.jpg', 50),
('Tapsilog', 'Rice Meals', 'Beef tapa with garlic rice and egg', 150.00, 'images/menu-images/tapsilog.jpg', 50),
('Coke', 'Beverages', 'Chilled soft drink', 50.00, 'images/menu-images/coke.jpg', 200),
('Iced Tea', 'Beverages', 'Refreshing lemon iced tea', 40.00, 'images/menu-images/iced-tea.jpg', 200),
('Buko Juice', 'Beverages', 'Fresh coconut juice', 60.00, 'images/menu-images/buko.jpg', 150),
('Mango Shake', 'Beverages', 'Fresh mango blended drink', 90.00, 'images/menu-images/mango-shake.jpg', 150),
('Halo-Halo', 'Desserts', 'Mixed dessert with shaved ice and toppings', 90.00, 'images/menu-images/halo-halo.jpg', 100),
('Leche Flan', 'Desserts', 'Creamy caramel custard', 80.00, 'images/menu-images/leche-flan.jpg', 100),
('Bibingka', 'Desserts', 'Rice cake with cheese and salted egg', 70.00, 'images/menu-images/bibingka.jpg', 100),
('Turon', 'Desserts', 'Fried banana spring rolls with caramelized sugar', 60.00, 'images/menu-images/turon.jpg', 100);

-- E. INSERT SAMPLE RESERVATIONS
INSERT INTO reservations (
  user_id,
  table_id,
  num_guests,
  status,
  reservation_date,
  reservation_time,
  customer_name,
  contact_number,
  reservation_code,
  reservation_token
) VALUES
(3, 5, 2, 'active', '2026-10-15', '18:30:00', 'Zaira Alumbro', '09123456789', 'RSV-DINE-001', 'token_secret_zai_123'),
(4, 9, 6, 'active', '2026-10-16', '19:00:00', 'Maria Santos', '09876543210', 'RSV-DINE-002', 'token_secret_maria_456'),
(NULL, 12, 2, 'active', '2026-10-17', '12:00:00', 'John Doe', '09555123456', 'RSV-DINE-003', 'token_secret_john_789');

-- Allow reservations without date/time if needed
ALTER TABLE reservations ALTER COLUMN reservation_date DROP NOT NULL;
ALTER TABLE reservations ALTER COLUMN reservation_time DROP NOT NULL;

-- ========================================================
-- EXTRA MENU ITEM COLUMNS / STOCK TRACKING
-- ========================================================

ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS stock INT DEFAULT 0;

UPDATE menu_items
SET stock = stock_count
WHERE stock = 0;

ALTER TABLE menu_items
ADD CONSTRAINT check_stock_positive CHECK (stock >= 0);

ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS ingredients TEXT;

ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT 'images/default-food.jpg';