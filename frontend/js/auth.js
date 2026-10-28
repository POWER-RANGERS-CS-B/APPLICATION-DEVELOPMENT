function showAuthMessage(message, isError = false, messageId = "authMessage") {
  const messageBox = document.getElementById(messageId);

  if (!messageBox) return;

  messageBox.textContent = message;
  messageBox.style.color = isError
    ? "var(--danger)"
    : "var(--gold-2)";
}

async function login(accountType = "admin") {

  const inputPrefix = accountType === "staff" ? "staff" : "admin";
  const messageId = `${inputPrefix}AuthMessage`;

  const email =
    document.getElementById(`${inputPrefix}Email`)?.value.trim();

  const password =
    document.getElementById(`${inputPrefix}Password`)?.value;

  if (!email || !password) {
    showAuthMessage(
      "Please enter your email and password.",
      true,
      messageId
    );
    return;
  }

  try {

    showAuthMessage("Logging in...", false, messageId);

    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const role = String(
      data.user?.role ||
      data.user?.user_role ||
      data.user?.account_type ||
      data.user?.type ||
      data.role ||
      ""
    )
      .trim()
      .toLowerCase();

    const isAdmin = role === "admin" || role.includes("admin");
    const isStaff = role === "staff" || role.includes("staff") ||
      role.includes("kitchen") || role.includes("employee") || role.includes("crew");

    if ((accountType === "admin" && !isAdmin) || (accountType === "staff" && !isStaff)) {
      showAuthMessage(`This account is not registered as ${accountType}. Use the ${isAdmin ? "Admin" : "Staff"} folder.`, true, messageId);
      return;
    }

    const user = saveSession(data);

    if (!getToken()) {
      showAuthMessage("Login response has no token.", true, messageId);
      return;
    }

    showAuthMessage(`Login successful as ${role}. Redirecting...`, false, messageId);

    setTimeout(() => {

      // ===== ADMIN =====
      if (
        role === "admin" ||
        role.includes("admin")
      ) {

        window.location.href =
          "./admin-dashboard.html";

        return;
      }

      // ===== STAFF =====
      if (
        role === "staff" ||
        role.includes("staff") ||
        role.includes("kitchen") ||
        role.includes("employee") ||
        role.includes("crew")
      ) {

        window.location.href =
          "./staff-kds.html";

        return;
      }

      // ===== CUSTOMER =====
      window.location.href =
        "/";

    }, 400);

  } catch (error) {

    console.error("LOGIN ERROR:", error);

      showAuthMessage(
        error.message || "Login failed.",
        true,
        messageId
      );
  }
}

async function signup() {

  const fullName =
    document.getElementById("fullName")?.value?.trim()
    || "Customer User";

  const email =
    document.getElementById("email")?.value.trim();

  const password =
    document.getElementById("password")?.value;

  if (!email || !password) {

    showAuthMessage(
      "Please enter email and password before signing up.",
      true
    );

    return;
  }

  try {

    showAuthMessage("Creating account...");

    await apiRequest("/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        fullName,
        full_name: fullName,
        email,
        password,
        role: "customer",
      }),
    });

    showAuthMessage(
      "Signup successful. You may now login."
    );

  } catch (error) {

    console.error("Signup failed:", error);

    showAuthMessage(
      error.message || "Signup failed.",
      true
    );
  }
}
function togglePasswordVisibility() {
  const passwordInput = document.getElementById("password");
  const toggleButton = document.querySelector(".password-toggle");

  if (!passwordInput || !toggleButton) return;

  const isVisible = passwordInput.type === "text";
  passwordInput.type = isVisible ? "password" : "text";
  toggleButton.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
  toggleButton.setAttribute("aria-pressed", String(!isVisible));
}

