const DEFAULT_ALLOWED_EMAIL_DOMAINS = [
  "dine-ari.com",
  "dinequeue.com",
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "protonmail.com",
];

function isValidEmailDomain(email) {
  if (typeof email !== "string") return false;

  const normalizedEmail = email.trim();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!normalizedEmail || !emailRegex.test(normalizedEmail)) return false;

  const domain = normalizedEmail.split("@")[1]?.toLowerCase();
  const blockedDomains = (process.env.BLOCKED_EMAIL_DOMAINS || "")
    .split(",")
    .map((domainName) => domainName.trim().toLowerCase())
    .filter(Boolean);

  if (!domain || blockedDomains.includes(domain)) return false;

  const configuredDomains = process.env.ALLOWED_EMAIL_DOMAINS;
  const allowedDomains = configuredDomains?.trim()
    ? configuredDomains.split(",").map((domainName) => domainName.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ALLOWED_EMAIL_DOMAINS;

  return allowedDomains.length === 0 || allowedDomains.includes(domain);
}

module.exports = { isValidEmailDomain };
