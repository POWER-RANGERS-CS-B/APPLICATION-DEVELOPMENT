const auditModel = require("../models/auditModel");

function validDate(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value
    ? false
    : value;
}

exports.getAuditLogs = async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 25);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  const action = typeof req.query.action === "string" ? req.query.action : "";
  const module = typeof req.query.module === "string" ? req.query.module : "";
  const startDate = validDate(req.query.startDate);
  const endDate = validDate(req.query.endDate);

  if (!Number.isSafeInteger(page) || page < 1) {
    return res.status(400).json({ message: "page must be a positive integer." });
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ message: "pageSize must be between 1 and 100." });
  }
  if (search.length > 200 || action.length > 100 || module.length > 100) {
    return res.status(400).json({ message: "Audit filters exceed the allowed length." });
  }
  if (userId && userId !== "anonymous" && (
    !/^\d+$/.test(userId) ||
    !Number.isSafeInteger(Number(userId)) ||
    Number(userId) < 1
  )) {
    return res.status(400).json({ message: "userId must be a valid user ID." });
  }
  if (startDate === false || endDate === false) {
    return res.status(400).json({ message: "Dates must use the YYYY-MM-DD format." });
  }
  if (startDate && endDate && startDate > endDate) {
    return res.status(400).json({ message: "startDate cannot be after endDate." });
  }

  try {
    res.json(await auditModel.findPage({
      page,
      pageSize,
      search,
      userId,
      action,
      module,
      startDate,
      endDate,
    }));
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    res.status(500).json({ message: "Failed to fetch audit logs." });
  }
};
