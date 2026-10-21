const os = require("os");

function isLoopbackHost(hostname = "") {
  const normalized = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "::1" || normalized === "127.0.0.1";
}

function isPrivateIpv4(address = "") {
  return address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address);
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

  const requestHost = req.get("host");
  const requestHostname = req.hostname || requestHost?.split(":")[0];
  const protocol = req.protocol || "http";

  if (requestHost && requestHostname && !isLoopbackHost(requestHostname)) {
    return `${protocol}://${requestHost}`;
  }

  const lanAddress = findLanIpv4();
  if (lanAddress) {
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
