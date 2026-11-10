const API_BASE = `${window.location.origin}/api`;

function redirectForAuthorizationFailure(status) {
  const pathname = window.location.pathname;
  const isAdminDashboard = pathname.endsWith("/admin-dashboard.html");
  const isStaffDashboard = pathname.endsWith("/staff-kds.html");

  if (status === 401) {
    if (isAdminDashboard || isStaffDashboard) {
      window.location.replace("/login.html");
    }
  } else if (status === 403 && isAdminDashboard) {
    window.location.replace("/choice.html");
  } else if (status === 403 && isStaffDashboard) {
    window.location.replace("/login.html");
  }
}

async function apiRequest(path, options = {}) {
  const { suppressAuthRedirect = false, ...fetchOptions } = options;
  const headers = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers || {}),
  };

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      credentials: "same-origin",
    });
  } catch (error) {
    throw new Error(
      `Cannot connect to backend at ${API_BASE}. Make sure the server is running.`
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
    if (!suppressAuthRedirect) redirectForAuthorizationFailure(response.status);
    const error = new Error(
      data?.message || `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.responseData = data;
    throw error;
  }

  return data;
}

function getUser() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.role === "customer") {
      ["token", "user", "role", "user_id", "full_name", "email"].forEach((key) => localStorage.removeItem(key));
      return {};
    }
    return user;
  } catch {
    return {};
  }
}

function saveSession(data) {
  const user = data?.user || data?.account || data;

  if (!user || typeof user !== "object") {
    throw new Error("Login succeeded but no user object was returned.");
  }

  localStorage.removeItem("token");
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("role", user.role || "");
  localStorage.setItem("user_id", user.id || user.user_id || "");
  localStorage.setItem("full_name", user.fullName || user.full_name || user.name || "");
  localStorage.setItem("email", user.email || "");

  return user;
}

async function logoutTo(destination) {
  try {
    await apiRequest("/auth/logout", { method: "POST", suppressAuthRedirect: true });
  } catch {
    console.error("Logout audit event could not be confirmed.");
  } finally {
    localStorage.clear();
    sessionStorage.clear();
    location.href = destination;
  }
}

function logout() {
  void logoutTo("index.html");
}

function togglePasswordVisibility(inputId, toggleButton) {
  const passwordInput = document.getElementById(inputId);

  if (!passwordInput || !toggleButton) return;

  const isVisible = passwordInput.type === "text";
  passwordInput.type = isVisible ? "password" : "text";
  toggleButton.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
  toggleButton.setAttribute("aria-pressed", String(!isVisible));

  const icon = toggleButton.querySelector("svg");
  if (icon && window.lucide) {
    icon.outerHTML = `<i data-lucide="${isVisible ? "eye" : "eye-off"}" aria-hidden="true"></i>`;
    window.lucide.createIcons();
    return;
  }

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
