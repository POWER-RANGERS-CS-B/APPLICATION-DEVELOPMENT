const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");

const dbPath = require.resolve("../config/db");
const statements = [];
const db = {
  async query(sql, values) {
    statements.push({ sql, values });
    if (/SELECT COUNT\(\*\)::int AS unread_count/.test(sql)) {
      return { rows: [{ unread_count: "137" }] };
    }
    if (/UPDATE restaurant\.customer_notifications/.test(sql)) {
      return { rows: [{ id: values[0], read_at: values[2] ? "2026-11-09T00:00:00Z" : null }] };
    }
    if (/DELETE FROM restaurant\.customer_notifications/.test(sql)) {
      return { rows: [{ id: values[0] }] };
    }
    return { rows: [] };
  },
};
const dbModule = new Module(dbPath);
dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = db;
require.cache[dbPath] = dbModule;

const customerModel = require("../models/customerModel");
const customerController = require("../controllers/customerController");

test("unread notification count is customer-scoped and not limited to the notification history page", async () => {
  assert.equal(await customerModel.getUnreadNotificationCount(42), 137);
  const countQuery = statements.find(({ sql }) => /SELECT COUNT\(\*\)::int AS unread_count/.test(sql));
  assert.ok(countQuery);
  assert.match(countQuery.sql, /WHERE user_id = \$1 AND read_at IS NULL/);
  assert.deepEqual(countQuery.values, [42]);
});

test("notification history includes both read and unread records without a page-size cap", async () => {
  const originalQuery = db.query;
  const notifications = [
    { id: 2, read_at: "2026-11-09T00:00:00Z" },
    { id: 1, read_at: null },
  ];
  const listQueryStart = statements.length;
  db.query = async (sql, values) => {
    statements.push({ sql, values });
    return { rows: notifications };
  };
  try {
    const result = await customerModel.listNotifications(42);
    assert.deepEqual(result, notifications);
    const query = statements.slice(listQueryStart).at(-1);
    assert.match(query.sql, /WHERE user_id = \$1/);
    assert.doesNotMatch(query.sql, /read_at IS NULL|LIMIT\s+100/i);
    assert.deepEqual(query.values, [42]);
  } finally {
    db.query = originalQuery;
  }
});

test("notification response returns the full unread count separately from notification history", async () => {
  const originalList = customerModel.listNotifications;
  const originalCount = customerModel.getUnreadNotificationCount;
  customerModel.listNotifications = async (userId) => {
    assert.equal(userId, 42);
    return Array.from({ length: 100 }, (_, index) => ({ id: index + 1, read_at: null }));
  };
  customerModel.getUnreadNotificationCount = async (userId) => {
    assert.equal(userId, 42);
    return 137;
  };

  try {
    let response;
    await customerController.listNotifications(
      { user: { id: 42 } },
      { json(value) { response = value; } }
    );
    assert.equal(response.notifications.length, 100);
    assert.equal(response.unreadCount, 137);
  } finally {
    customerModel.listNotifications = originalList;
    customerModel.getUnreadNotificationCount = originalCount;
  }
});

test("notification read status can be toggled and remains customer-scoped", async () => {
  const result = await customerModel.markNotificationRead(42, 7, false);
  const updateQuery = statements.at(-1);
  assert.deepEqual(result, { id: 7, read_at: null });
  assert.match(updateQuery.sql, /WHERE id = \$1 AND user_id = \$2/);
  assert.deepEqual(updateQuery.values, [7, 42, false]);
});

test("mark all as read only updates unread notifications for the authenticated customer", async () => {
  const result = await customerModel.markAllNotificationsRead(42);
  const updateQuery = statements.at(-1);
  assert.deepEqual(result, { updatedCount: 1 });
  assert.match(updateQuery.sql, /WHERE user_id = \$1 AND read_at IS NULL/);
  assert.deepEqual(updateQuery.values, [42]);
});

test("notification deletion is scoped to the authenticated customer", async () => {
  const result = await customerModel.deleteNotification(42, 7);
  const deleteQuery = statements.at(-1);
  assert.deepEqual(result, { id: 7 });
  assert.match(deleteQuery.sql, /WHERE id = \$1 AND user_id = \$2/);
  assert.deepEqual(deleteQuery.values, [7, 42]);
});

test("notification read-status controller uses the authenticated customer identity", async () => {
  const original = customerModel.markNotificationRead;
  let received;
  customerModel.markNotificationRead = async (...args) => {
    received = args;
    return { id: 7, read_at: null };
  };
  try {
    let response;
    await customerController.markNotificationRead(
      { user: { id: 42 }, params: { id: "7" }, body: { read: false, user_id: 99 } },
      { json(value) { response = value; } }
    );
    assert.deepEqual(received, [42, 7, false]);
    assert.deepEqual(response, { id: 7, read_at: null });
  } finally {
    customerModel.markNotificationRead = original;
  }
});
