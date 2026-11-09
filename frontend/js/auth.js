function showAuthMessage(message, isError = false, messageId = "authMessage") {
  const messageBox = document.getElementById(messageId);

  if (!messageBox) return;

  messageBox.textContent = message;
  messageBox.classList.toggle("is-error", isError);
  messageBox.classList.toggle(
    "is-success",
    !isError && /\bsuccessful\b/i.test(message)
  );
}

function getCustomerPostAuthUrl() {
  const flow = new URLSearchParams(window.location.search).get("flow");
  return flow === "dine_in" ? "./choice.html?flow=dine_in" : "./choice.html";
}

async function login(accountType = "admin") {

  const inputPrefix = accountType === "customer" ? "customer" : accountType === "staff" ? "staff" : "admin";
  const messageId = `${inputPrefix}AuthMessage`;
  const submitButton = document.getElementById(`${inputPrefix}LoginButton`);

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

  if (submitButton?.disabled) return;

  const originalButtonText = submitButton?.textContent || "Sign In";
  let redirecting = false;

  try {

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Signing in...";
      submitButton.setAttribute("aria-busy", "true");
    }

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

    const isAdmin = role === "admin";
    const isStaff = role === "staff" || role === "cashier";
    const isCustomer = role === "customer";

    if (
      (accountType === "admin" && !isAdmin) ||
      (accountType === "staff" && !isStaff) ||
      (accountType === "customer" && !isCustomer)
    ) {
      showAuthMessage(
        accountType === "customer"
          ? "This is not a customer account. Use the staff or administrator login."
          : `This account is not registered as ${accountType}. Use the ${isAdmin ? "Admin" : "Staff or Cashier"} folder.`,
        true,
        messageId
      );
      return;
    }

    const user = saveSession(data);

    if (!getToken()) {
      showAuthMessage("Login response has no token.", true, messageId);
      return;
    }

    showAuthMessage(`Login successful as ${role}. Redirecting...`, false, messageId);
    redirecting = true;

    setTimeout(() => {

      // ===== ADMIN =====
      if (role === "admin") {
        window.location.href =
          "./admin-dashboard.html";
        return;
      }

      if (role === "staff" || role === "cashier") {
        window.location.href =
          "./staff-kds.html";
        return;
      }

      if (role === "customer") {
        window.location.href = getCustomerPostAuthUrl();
      }
    }, 400);

  } catch (error) {

    if (![400, 401].includes(error?.status)) {
      console.error("Login request failed with status", error?.status || "network error");
    }
    showAuthMessage(
      error?.status === 401
        ? "Email or password is incorrect."
        : error?.status === 400
          ? "Please enter a valid email address."
        : "Sign-in failed. Please try again or contact your administrator.",
      true,
      messageId
    );
  } finally {
    if (submitButton && !redirecting) {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitButton.textContent = originalButtonText;
    }
  }
}

document.querySelectorAll(".login-form").forEach((form) => {
  const message = form.querySelector('[role="status"]');

  form.addEventListener("input", () => {
    if (message) message.textContent = "";
  });
});
