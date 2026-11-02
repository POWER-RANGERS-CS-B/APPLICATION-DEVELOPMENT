const db = require("../config/db");

exports.findAll = async () => {
  const result = await db.query(
    `SELECT *
     FROM restaurant.menu_items
     WHERE deleted_at IS NULL
     ORDER BY category, item_name`
  );

  return result.rows;
};

// : Direct layout hook to save dashboard form inputs to pgAdmin ---
exports.create = async (itemData) => {
  const { item_name, category, price, stock_count, description, image_url } = itemData;
  const result = await db.query(
    `INSERT INTO restaurant.menu_items (item_name, category, price, stock_count, description, image_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING *`,
    [item_name, category, price, stock_count || 0, description, image_url || 'images/default-food.jpg']
  );
  return result.rows[0];
};

// : Handles modifications sent from "Edit Price" panel inputs ---
exports.update = async (id, updateData) => {
  const { item_name, category, price, stock_count, description, image_url} = updateData;
  const result = await db.query(
    `UPDATE restaurant.menu_items
     SET item_name = COALESCE($1, item_name),
      category = COALESCE($2, category), 
      price = COALESCE($3, price), 
      stock_count = COALESCE($4, stock_count), 
      description = COALESCE($5, description), 
      image_url = COALESCE($6, image_url),
      updated_at = NOW()
     WHERE id = $7 AND deleted_at IS NULL
     RETURNING *`,
    [item_name, category, price, stock_count, description, image_url, id]
  );
  return result.rows[0];
};

exports.softDelete = async (id) => {
  const result = await db.query(
    `UPDATE restaurant.menu_items
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  return result.rows[0];
};

