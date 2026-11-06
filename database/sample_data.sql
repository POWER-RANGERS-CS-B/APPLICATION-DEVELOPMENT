INSERT INTO users (full_name, email, password_hash, role) VALUES
('Admin User', 'admin@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'admin'),
('Staff User', 'staff@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'staff'),
('Customer User', 'customer@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'customer');

INSERT INTO restaurant_tables (table_name, position_x, position_y) VALUES
('Table 1', 120, 120),
('Table 2', 380, 120),
('Table 3', 120, 350),
('Table 4', 380, 350);

INSERT INTO chairs (table_id, chair_label) VALUES
(1, 'T1-C1'), (1, 'T1-C2'), (1, 'T1-C3'), (1, 'T1-C4'),
(2, 'T2-C1'), (2, 'T2-C2'), (2, 'T2-C3'), (2, 'T2-C4'),
(3, 'T3-C1'), (3, 'T3-C2'), (3, 'T3-C3'), (3, 'T3-C4'),
(4, 'T4-C1'), (4, 'T4-C2'), (4, 'T4-C3'), (4, 'T4-C4');

INSERT INTO menu_items (item_name, category, description, price, image_url, stock_count) VALUES
('Golden Steak', 'Main Course', 'Premium steak with house sauce.', 349.00, 'images/menu-images/steak.jpg', 15),
('Midnight Pasta', 'Main Course', 'Creamy pasta with herbs.', 189.00, 'images/menu-images/pasta.jpg', 25),
('Luxury Burger', 'Main Course', 'Burger with cheese and fries.', 159.00, 'images/menu-images/burger.jpg', 20),
('Royal Fries', 'Sides', 'Crispy fries with dip.', 89.00, 'images/menu-images/fries.jpg', 40),
('White Gold Lemonade', 'Drinks', 'Fresh lemonade drink.', 69.00, 'images/menu-images/lemonade.jpg', 35);

-- First, clear existing users
DELETE FROM users;

-- Create new users with password = "password123"
INSERT INTO users (full_name, email, password_hash, role) VALUES 
('Admin User', 'admin@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'admin'),
('Staff User', 'staff@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'staff'),
('Customer User', 'customer@dinequeue.com', '$2a$10$uLMGgQCzGBYqlRSJf2sJO.x0tkyxESYozX/FocLm9zNJuA7B7yJ1O', 'customer');

-- Verify they were inserted
SELECT id, email, role FROM users;