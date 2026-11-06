-- ===========================================
-- CORRECT SAMPLE DATA FOR YOUR ORIGINAL SCHEMA
-- WITH TABLES 9-14
-- ===========================================

-- 1. USERS (password is 'password123' hashed)
INSERT INTO users (full_name, email, password_hash, role) VALUES
('Restaurant Admin', 'admin@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'admin'),
('Staff User', 'staff@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'staff'),
('Juan Dela Cruz', 'juan@gmail.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'customer'),
('Maria Santos', 'maria@gmail.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'customer');

-- 2. RESTAURANT TABLES (Tables 1-14)
INSERT INTO restaurant_tables (table_name, position_x, position_y, status) VALUES
-- Existing tables 1-8
('Table 1', 120, 120, 'vacant'),
('Table 2', 380, 120, 'vacant'),
('Table 3', 120, 350, 'vacant'),
('Table 4', 380, 350, 'vacant'),
('Table 5', 650, 120, 'vacant'),
('Table 6', 650, 350, 'vacant'),
('Table 7', 200, 550, 'vacant'),
('Table 8', 500, 550, 'vacant'),
-- New tables 9-10 (8 chairs each)
('Table 9', 800, 120, 'vacant'),
('Table 10', 800, 350, 'vacant'),
-- New tables 11-14 (2 chairs each)
('Table 11', 120, 720, 'vacant'),
('Table 12', 380, 720, 'vacant'),
('Table 13', 650, 720, 'vacant'),
('Table 14', 800, 720, 'vacant');

-- 3. CHAIRS (with varying quantities per table)
INSERT INTO chairs (table_id, chair_label, status) VALUES
-- Table 1 chairs (4 chairs)
(1, 'T1-C1', 'vacant'), (1, 'T1-C2', 'vacant'), (1, 'T1-C3', 'vacant'), (1, 'T1-C4', 'vacant'),
-- Table 2 chairs (4 chairs)
(2, 'T2-C1', 'vacant'), (2, 'T2-C2', 'vacant'), (2, 'T2-C3', 'vacant'), (2, 'T2-C4', 'vacant'),
-- Table 3 chairs (4 chairs)
(3, 'T3-C1', 'vacant'), (3, 'T3-C2', 'vacant'), (3, 'T3-C3', 'vacant'), (3, 'T3-C4', 'vacant'),
-- Table 4 chairs (4 chairs)
(4, 'T4-C1', 'vacant'), (4, 'T4-C2', 'vacant'), (4, 'T4-C3', 'vacant'), (4, 'T4-C4', 'vacant'),
-- Table 5 chairs (4 chairs)
(5, 'T5-C1', 'vacant'), (5, 'T5-C2', 'vacant'), (5, 'T5-C3', 'vacant'), (5, 'T5-C4', 'vacant'),
-- Table 6 chairs (4 chairs)
(6, 'T6-C1', 'vacant'), (6, 'T6-C2', 'vacant'), (6, 'T6-C3', 'vacant'), (6, 'T6-C4', 'vacant'),
-- Table 7 chairs (6 chairs)
(7, 'T7-C1', 'vacant'), (7, 'T7-C2', 'vacant'), (7, 'T7-C3', 'vacant'), 
(7, 'T7-C4', 'vacant'), (7, 'T7-C5', 'vacant'), (7, 'T7-C6', 'vacant'),
-- Table 8 chairs (8 chairs)
(8, 'T8-C1', 'vacant'), (8, 'T8-C2', 'vacant'), (8, 'T8-C3', 'vacant'), (8, 'T8-C4', 'vacant'),
(8, 'T8-C5', 'vacant'), (8, 'T8-C6', 'vacant'), (8, 'T8-C7', 'vacant'), (8, 'T8-C8', 'vacant'),
-- Table 9 chairs (8 chairs)
(9, 'T9-C1', 'vacant'), (9, 'T9-C2', 'vacant'), (9, 'T9-C3', 'vacant'), (9, 'T9-C4', 'vacant'),
(9, 'T9-C5', 'vacant'), (9, 'T9-C6', 'vacant'), (9, 'T9-C7', 'vacant'), (9, 'T9-C8', 'vacant'),
-- Table 10 chairs (8 chairs)
(10, 'T10-C1', 'vacant'), (10, 'T10-C2', 'vacant'), (10, 'T10-C3', 'vacant'), (10, 'T10-C4', 'vacant'),
(10, 'T10-C5', 'vacant'), (10, 'T10-C6', 'vacant'), (10, 'T10-C7', 'vacant'), (10, 'T10-C8', 'vacant'),
-- Table 11 chairs (2 chairs)
(11, 'T11-C1', 'vacant'), (11, 'T11-C2', 'vacant'),
-- Table 12 chairs (2 chairs)
(12, 'T12-C1', 'vacant'), (12, 'T12-C2', 'vacant'),
-- Table 13 chairs (2 chairs)
(13, 'T13-C1', 'vacant'), (13, 'T13-C2', 'vacant'),
-- Table 14 chairs (2 chairs)
(14, 'T14-C1', 'vacant'), (14, 'T14-C2', 'vacant');

-- 4. MENU ITEMS (with all required columns)
INSERT INTO menu_items (item_name, category, description, price, image_url, stock_count) VALUES
-- Appetizers
('Lumpiang Shanghai', 'Appetizers', 'Crispy fried spring rolls with sweet chili sauce', 120.00, 'images/menu-images/lumpia.jpg', 50),
('Chicken Wings', 'Appetizers', 'Buffalo-style chicken wings with dip', 180.00, 'images/menu-images/wings.jpg', 45),
('Sisig Fries', 'Appetizers', 'Fries topped with sizzling pork sisig', 150.00, 'images/menu-images/sisig-fries.jpg', 40),
('Garlic Butter Shrimp', 'Appetizers', 'Shrimp sautéed in garlic butter sauce', 220.00, 'images/menu-images/shrimp.jpg', 35),

-- Main Course
('Chicken Adobo', 'Main Course', 'Classic Filipino chicken cooked in soy sauce and vinegar', 150.00, 'images/menu-images/adobo.jpg', 50),
('Pork Sinigang', 'Main Course', 'Sour tamarind soup with pork and vegetables', 170.00, 'images/menu-images/sinigang.jpg', 45),
('Beef Kare-Kare', 'Main Course', 'Peanut stew with oxtail and vegetables', 220.00, 'images/menu-images/karekare.jpg', 40),
('Lechon Kawali', 'Main Course', 'Deep-fried crispy pork belly', 200.00, 'images/menu-images/lechon.jpg', 45),
('Grilled Bangus', 'Main Course', 'Marinated milkfish grilled to perfection', 180.00, 'images/menu-images/bangus.jpg', 40),
('Bulalo', 'Main Course', 'Beef shank soup with corn and vegetables', 250.00, 'images/menu-images/bulalo.jpg', 35),
('Pork Caldereta', 'Main Course', 'Rich tomato-based pork stew with liver sauce', 180.00, 'images/menu-images/caldereta.jpg', 45),

-- Rice Meals
('Chicken Inasal Meal', 'Rice Meals', 'Grilled chicken with garlic rice and egg', 160.00, 'images/menu-images/inasal.jpg', 50),
('Pork BBQ Meal', 'Rice Meals', 'Barbecue skewers with rice and atchara', 140.00, 'images/menu-images/bbq.jpg', 50),
('Tapsilog', 'Rice Meals', 'Beef tapa with garlic rice and egg', 150.00, 'images/menu-images/tapsilog.jpg', 50),

-- Beverages
('Coke', 'Beverages', 'Chilled soft drink', 50.00, 'images/menu-images/coke.jpg', 200),
('Iced Tea', 'Beverages', 'Refreshing lemon iced tea', 40.00, 'images/menu-images/iced-tea.jpg', 200),
('Buko Juice', 'Beverages', 'Fresh coconut juice', 60.00, 'images/menu-images/buko.jpg', 150),
('Mango Shake', 'Beverages', 'Fresh mango blended drink', 90.00, 'images/menu-images/mango-shake.jpg', 150),

-- Desserts
('Halo-Halo', 'Desserts', 'Mixed dessert with shaved ice and toppings', 90.00, 'images/menu-images/halo-halo.jpg', 100),
('Leche Flan', 'Desserts', 'Creamy caramel custard', 80.00, 'images/menu-images/leche-flan.jpg', 100),
('Bibingka', 'Desserts', 'Rice cake with cheese and salted egg', 70.00, 'images/menu-images/bibingka.jpg', 100),
('Turon', 'Desserts', 'Fried banana spring rolls with caramelized sugar', 60.00, 'images/menu-images/turon.jpg', 100);