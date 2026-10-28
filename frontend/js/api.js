const API_BASE = `${window.location.protocol}//${window.location.hostname}:3000/api`;

function getToken() {
  const token = localStorage.getItem("token");
  if (!token || token === "undefined" || token === "null") return "";
  return token;
}

function redirectForAuthorizationFailure(status) {
  if (!window.location.pathname.endsWith("/admin-dashboard.html")) return;

  if (status === 401) {
    window.location.replace("/login.html");
  } else if (status === 403) {
    window.location.replace("/choice.html");
  }
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
    redirectForAuthorizationFailure(response.status);
    const error = new Error(
      data?.message || `Request failed with status ${response.status}`
    );
    error.status = response.status;
    throw error;
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

function togglePasswordVisibility(inputId, toggleButton) {
  const passwordInput = document.getElementById(inputId);

  if (!passwordInput || !toggleButton) return;

  const isVisible = passwordInput.type === "text";
  passwordInput.type = isVisible ? "password" : "text";
  toggleButton.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
  toggleButton.setAttribute("aria-pressed", String(!isVisible));

  const svg = toggleButton.querySelector("svg");
  if (svg) {
    if (isVisible) {
      // Eye Open icon (Password Hidden)
      svg.innerHTML = `
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      `;
    } else {
      // Eye Off / Slash icon (Password Visible)
      svg.innerHTML = `
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      `;
    }
  }
}