const os = require("os");

function configurationError(message) {
  const error = new Error(message);
  error.code = "PUBLIC_BASE_URL_CONFIGURATION_ERROR";
  return error;
}

function isLoopbackHost(hostname = "") {
  const normalized = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "::1" || normalized === "127.0.0.1";
}

function isPrivateIpv4(address = "") {
  return address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address);
}

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

  const requestHost = req.get("host");
  const requestHostname = req.hostname || requestHost?.split(":")[0];
  const protocol = req.protocol || "http";

  if (requestHost && requestHostname && !isLoopbackHost(requestHostname)) {
    return `${protocol}://${requestHost}`;
  }

  const lanAddress = findLanIpv4();
  if (lanAddress) {
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
