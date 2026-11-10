const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("node:crypto");
const authModel = require("../../models/authModel");

const defaultIds = { customer: 42, admin: 43, staff: 44, cashier: 45 };

function installSessionAuth() {
  const originalIsTokenRevoked = authModel.isTokenRevoked;
  const originalFindActiveAccount = authModel.findActiveAccount;
  const accounts = new Map();

  authModel.isTokenRevoked = async () => false;
  authModel.findActiveAccount = async (id) => accounts.get(String(id)) || null;

  return {
    cookieFor(role, id = defaultIds[role]) {
      const account = { id, role, email: `${role}@example.test` };
      accounts.set(String(id), account);
      const token = jwt.sign(account, process.env.JWT_SECRET, {
        expiresIn: "15m",
        jwtid: randomUUID(),
      });
      return `dineari_session=${token}`;
    },
    cookieParser,
    restore() {
      authModel.isTokenRevoked = originalIsTokenRevoked;
      authModel.findActiveAccount = originalFindActiveAccount;
    },
  };
}

module.exports = { installSessionAuth };
