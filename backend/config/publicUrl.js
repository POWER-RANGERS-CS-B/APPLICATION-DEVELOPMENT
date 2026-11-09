const os = require("os");

<<<<<<< HEAD
=======
function configurationError(message) {
  const error = new Error(message);
  error.code = "PUBLIC_BASE_URL_CONFIGURATION_ERROR";
  return error;
}

>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
function isLoopbackHost(hostname = "") {
  const normalized = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "::1" || normalized === "127.0.0.1";
}

function isPrivateIpv4(address = "") {
  return address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address);
}

<<<<<<< HEAD
=======
function getConfiguredBaseUrl(value, { production = false } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw configurationError("PUBLIC_BASE_URL must be a valid absolute URL.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw configurationError("PUBLIC_BASE_URL must be an HTTP(S) URL without credentials, query, or fragment.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const privateIpv6 = /^(fc|fd|fe[89ab])/i.test(hostname);
  if (production && (
    url.protocol !== "https:" ||
    isLoopbackHost(hostname) ||
    isPrivateIpv4(hostname) ||
    privateIpv6
  )) {
    throw configurationError("Production receipts require a publicly reachable HTTPS PUBLIC_BASE_URL.");
  }

  return url.origin;
}

>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
function findLanIpv4() {
  const interfaces = Object.values(os.networkInterfaces()).flat();
  const candidates = interfaces.filter((network) =>
    network &&
    network.family === "IPv4" &&
    !network.internal &&
    isPrivateIpv4(network.address)
  );

  return candidates[0]?.address || null;
}

<<<<<<< HEAD
function getPublicBaseUrl(req) {
  const configuredUrls = [
    process.env.PUBLIC_BASE_URL,
    process.env.BASE_URL,
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  const configuredUrl = configuredUrls.find((value) => {
    try {
      return !isLoopbackHost(new URL(value).hostname);
    } catch {
      return false;
    }
  });

  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
=======
function getPublicBaseUrl(req, environment = process.env) {
  const production = environment.NODE_ENV === "production";
  const publicBaseUrl = environment.PUBLIC_BASE_URL?.trim();
  if (production) {
    if (publicBaseUrl) {
      return getConfiguredBaseUrl(publicBaseUrl, { production: true });
    }
    throw configurationError("Set PUBLIC_BASE_URL to the public HTTPS application URL before creating receipts.");
  }

  const configuredUrls = [publicBaseUrl, environment.BASE_URL, environment.FRONTEND_URL]
    .map((value) => value?.trim())
    .filter(Boolean);
  for (const value of configuredUrls) {
    if (value === publicBaseUrl) {
      const baseUrl = getConfiguredBaseUrl(value);
      if (!isLoopbackHost(new URL(value).hostname)) {
        return baseUrl;
      }
      continue;
    }

    try {
      const url = new URL(value);
      if (!isLoopbackHost(url.hostname)) {
        return getConfiguredBaseUrl(value);
      }
    } catch {
      continue;
    }
  }
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

  const requestHost = req.get("host");
  const requestHostname = req.hostname || requestHost?.split(":")[0];
  const protocol = req.protocol || "http";

  if (requestHost && requestHostname && !isLoopbackHost(requestHostname)) {
    return `${protocol}://${requestHost}`;
  }

  const lanAddress = findLanIpv4();
  if (lanAddress) {
<<<<<<< HEAD
    const port = process.env.PORT || 3000;
    return `${protocol}://${lanAddress}:${port}`;
  }

  if (configuredUrls.length) {
    return configuredUrls[0].replace(/\/+$/, "");
  }

  return requestHost
    ? `${protocol}://${requestHost}`
    : `${protocol}://localhost:${process.env.PORT || 3000}`;
}

module.exports = { getPublicBaseUrl };
=======
    const port = environment.PORT || 3000;
    return `${protocol}://${lanAddress}:${port}`;
  }

  throw configurationError(
    "No reachable receipt URL is available. Set PUBLIC_BASE_URL to the application URL customers can open."
  );
}

function buildReceiptUrl(baseUrl, orderCode, receiptToken) {
  const receiptUrl = new URL("/receipt.html", baseUrl);
  receiptUrl.searchParams.set("code", orderCode);
  receiptUrl.searchParams.set("token", receiptToken);
  return receiptUrl.toString();
}

module.exports = { buildReceiptUrl, getPublicBaseUrl };
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
