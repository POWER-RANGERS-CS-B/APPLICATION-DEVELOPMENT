-- Fictional, optional local-development sample data only.
-- Do not run this file in production.
-- Run it in Query Tool connected to dinequeue_db, after dineari_schema.sql.
-- It adds the 14 example floor-plan tables, chairs, and fictional menu items.
-- Sample prices, stock, and descriptions are fictional and for development only.
-- It does not create users, orders, or reservations.

INSERT INTO restaurant.restaurant_tables (table_name, status)
SELECT 'T' || floor_plan.table_number, 'vacant'
FROM (VALUES
    (1), (2), (3), (4), (5), (6), (7),
    (8), (9), (10), (11), (12), (13), (14)
) AS floor_plan(table_number)
WHERE NOT EXISTS (
    SELECT 1
    FROM restaurant.restaurant_tables AS existing_table
    WHERE existing_table.table_name = 'T' || floor_plan.table_number
);

INSERT INTO restaurant.chairs (table_id, chair_label, status)
SELECT sample_table.id, 'C' || chair_numbers.chair_number, 'vacant'
FROM restaurant.restaurant_tables AS sample_table
CROSS JOIN LATERAL generate_series(
    1,
    CASE sample_table.table_name
        WHEN 'T7' THEN 8
        WHEN 'T8' THEN 8
        WHEN 'T9' THEN 10
        WHEN 'T10' THEN 10
        WHEN 'T11' THEN 2
        WHEN 'T12' THEN 2
        WHEN 'T13' THEN 2
        WHEN 'T14' THEN 2
        ELSE 4
    END
) AS chair_numbers(chair_number)
WHERE sample_table.table_name ~ '^T(1[0-4]|[1-9])$'
  AND NOT EXISTS (
      SELECT 1
      FROM restaurant.chairs AS existing_chair
      WHERE existing_chair.table_id = sample_table.id
        AND existing_chair.chair_label = 'C' || chair_numbers.chair_number
  );

INSERT INTO restaurant.menu_items
    (item_name, category, price, stock_count, description, image_url)
SELECT sample.item_name, sample.category, sample.price, sample.stock_count,
       'Fictional local-development sample; replace with your real menu details.',
       sample.image_url
FROM (VALUES
    ('Lumpiang Shanghai', 'Appetizers', 120.00, 50, 'images/menu-images/lumpiang-shanghai.png'),
    ('Chicken Wings', 'Appetizers', 180.00, 50, 'images/menu-images/chicken-wings.png'),
    ('Garlic Butter Shrimp', 'Appetizers', 240.00, 50, 'images/menu-images/garlic-butter-shrimp.png'),
    ('Sisig Fries', 'Appetizers', 150.00, 50, 'images/menu-images/sisig-fries.png'),
    ('Chicharon Bulaklak', 'Appetizers', 160.00, 50, 'images/menu-images/chicharon-bulaklak.png'),

    ('Chicken Adobo', 'Main Course', 220.00, 50, 'images/menu-images/chicken-adobo.png'),
    ('Chicken Afritada', 'Main Course', 220.00, 50, 'images/menu-images/chicken-afritada.png'),
    ('Bulalo', 'Main Course', 320.00, 50, 'images/menu-images/bulalo.png'),
    ('Grilled Bangus', 'Main Course', 260.00, 50, 'images/menu-images/grilled-bangus.png'),
    ('Pork Caldereta', 'Main Course', 250.00, 50, 'images/menu-images/pork-caldereta.png'),
    ('Pork Sinigang', 'Main Course', 250.00, 50, 'images/menu-images/pork-sinigang.png'),
    ('Beef Kare-Kare', 'Main Course', 320.00, 50, 'images/menu-images/beef-kare-kare.png'),
    ('Lechon Kawali', 'Main Course', 260.00, 50, 'images/menu-images/lechon-kawali.png'),

    ('Chicken Inasal Meal', 'Rice Meals', 180.00, 50, 'images/menu-images/chicken-inasal-meal.png'),
    ('Pork BBQ Meal', 'Rice Meals', 180.00, 50, 'images/menu-images/pork-bbq-meal.png'),
    ('Tapsilog', 'Rice Meals', 170.00, 50, 'images/menu-images/tapsilog.png'),
    ('Longsilog', 'Rice Meals', 160.00, 50, 'images/menu-images/longsilog.png'),
    ('Bangsilog', 'Rice Meals', 180.00, 50, 'images/menu-images/bangsilog.png'),
    ('Tocilog', 'Rice Meals', 160.00, 50, 'images/menu-images/tocilog.png'),

    ('Coke', 'Beverages', 60.00, 50, 'images/menu-images/coke.png'),
    ('Iced Tea', 'Beverages', 60.00, 50, 'images/menu-images/iced-tea.png'),
    ('Buko Juice', 'Beverages', 80.00, 50, 'images/menu-images/buko-juice.png'),
    ('Mango Shake', 'Beverages', 100.00, 50, 'images/menu-images/mango-shake.png'),
    ('Calamansi Juice', 'Beverages', 70.00, 50, 'images/menu-images/calamansi-juice.png'),
    ('Pineapple Juice', 'Beverages', 70.00, 50, 'images/menu-images/pineapple-juice.png'),

    ('Halo-Halo', 'Desserts', 140.00, 50, 'images/menu-images/halo-halo.png'),
    ('Leche Flan', 'Desserts', 100.00, 50, 'images/menu-images/leche-flan.png'),
    ('Bibingka', 'Desserts', 100.00, 50, 'images/menu-images/bibingka.png'),
    ('Turon', 'Desserts', 80.00, 50, 'images/menu-images/turon.png')
) AS sample(item_name, category, price, stock_count, image_url)
WHERE NOT EXISTS (
    SELECT 1
    FROM restaurant.menu_items AS existing_item
    WHERE existing_item.item_name = sample.item_name
      AND existing_item.deleted_at IS NULL
);
