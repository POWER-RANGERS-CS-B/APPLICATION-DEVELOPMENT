function showAuthMessage(message, isError = false) {
  const messageBox = document.getElementById("authMessage");

  if (!messageBox) return;

  messageBox.textContent = message;
  messageBox.style.color = isError
    ? "var(--danger)"
    : "var(--gold-2)";
}

async function login() {

  const email =
    document.getElementById("email")?.value.trim();

  const password =
    document.getElementById("password")?.value;

  if (!email || !password) {
    showAuthMessage(
      "Please enter your email and password.",
      true
    );
    return;
  }

  try {

    showAuthMessage("Logging in...");

    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    });

    console.log("LOGIN RESPONSE:", data);

    const user = saveSession(data);

    console.log("SAVED USER:", user);

    if (!getToken()) {

      showAuthMessage(
        "Login response has no token.",
        true
      );

      return;
    }

    const role = String(
      user.role ||
      user.user_role ||
      user.account_type ||
      user.type ||
      localStorage.getItem("role") ||
      "customer"
    )
      .trim()
      .toLowerCase();

    console.log("FINAL ROLE:", role);

    showAuthMessage(
      `Login successful as ${role}. Redirecting...`
    );

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
        "./choice.html";

    }, 400);

  } catch (error) {

    console.error("LOGIN ERROR:", error);

    showAuthMessage(
      error.message || "Login failed.",
      true
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