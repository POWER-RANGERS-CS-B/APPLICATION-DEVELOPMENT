const db = require("../config/db");
const auditService = require("../services/auditService");

function auditActor(actor = {}) {
  return { userId: actor.userId || null, actorName: actor.actorName || null };
}

function menuAuditValues(item) {
  if (!item) return null;
  return {
    item_name: item.item_name,
    category: item.category,
    price: item.price,
    stock_count: item.stock_count,
    image_url: item.image_url,
    deleted_at: item.deleted_at,
  };
}

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
exports.create = async (itemData, actor) => {
  const { item_name, category, price, stock_count, description, image_url } = itemData;
  return auditService.transaction(async (client, audit) => {
    const result = await client.query(
      `INSERT INTO restaurant.menu_items (item_name, category, price, stock_count, description, image_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [item_name, category, price, stock_count || 0, description, image_url || 'images/default-food.jpg']
    );
    const item = result.rows[0];

    await audit({
      ...auditActor(actor),
      action: "MENU_ITEM_CREATED",
      module: "menu",
      entityId: item.id,
      newValues: menuAuditValues(item),
    });

    return item;
  });
};

// : Handles modifications sent from "Edit Price" panel inputs ---
exports.update = async (id, updateData, actor) => {
  const { item_name, category, price, stock_count, description, image_url} = updateData;
  return auditService.transaction(async (client, audit) => {
    const previousResult = await client.query(
      "SELECT * FROM restaurant.menu_items WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [id]
    );
    const previous = previousResult.rows[0];
    if (!previous) return null;

    const result = await client.query(
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
    const item = result.rows[0];
    const inventoryChanged = Number(previous.stock_count) !== Number(item.stock_count);

    await audit({
      ...auditActor(actor),
      action: inventoryChanged ? "INVENTORY_UPDATED" : "MENU_ITEM_UPDATED",
      module: inventoryChanged ? "inventory" : "menu",
      entityId: item.id,
      previousValues: menuAuditValues(previous),
      newValues: menuAuditValues(item),
    });

    return item;
  });
};

exports.softDelete = async (id, actor) => {
  return auditService.transaction(async (client, audit) => {
    const previousResult = await client.query(
      "SELECT * FROM restaurant.menu_items WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [id]
    );
    const previous = previousResult.rows[0];
    if (!previous) return null;

    const result = await client.query(
      `UPDATE restaurant.menu_items
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    const item = result.rows[0];

    await audit({
      ...auditActor(actor),
      action: "MENU_ITEM_DELETED",
      module: "menu",
      entityId: item.id,
      previousValues: menuAuditValues(previous),
      newValues: { deleted_at: item.deleted_at },
    });

    return item;
  });
};
