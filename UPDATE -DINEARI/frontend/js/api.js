const API_BASE = `${window.location.protocol}//${window.location.hostname}:3000/api`;

function getToken() {
  const token = localStorage.getItem("token");
  if (!token || token === "undefined" || token === "null") return "";
  return token;
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(
      "Cannot connect to backend. Make sure your server is running at http://localhost:3000"
    );
  }

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(
      data?.message || `Request failed with status ${response.status}`
    );
  }

  return data;
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function saveSession(data) {
  const user = data?.user || data?.account || data;

  if (!user || typeof user !== "object") {
    throw new Error("Login succeeded but no user object was returned.");
  }

  if (data?.token) {
    localStorage.setItem("token", data.token);
  } else {
    localStorage.removeItem("token");
  }

  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("role", user.role || "customer");
  localStorage.setItem("user_id", user.id || user.user_id || "");
  localStorage.setItem("full_name", user.fullName || user.full_name || user.name || "Customer");
  localStorage.setItem("email", user.email || "");

  return user;
}

function logout() {
  localStorage.clear();
  location.href = "index.html";
}
