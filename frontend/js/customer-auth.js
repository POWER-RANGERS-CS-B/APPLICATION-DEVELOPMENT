const customerRegistrationForm = document.getElementById("customerRegistrationForm");
const customerPhoneInput = document.getElementById("customerContactNumber");
const customerPhoneError = document.getElementById("customerContactNumberError");
const googleIdentityScriptUrl = "https://accounts.google.com/gsi/client?hl=en";
let googleIdentityInitPromise = null;
let googleIdentityInitialized = false;
let googleTokenClient = null;
let googleAuthPending = false;
let googleAuthIntent = null;
let googleThemeListenerRegistered = false;
let customerPhoneInputInstance = null;
let customerPhoneUtilsReady = false;
let customerPhoneUtilsFailed = false;

function setGoogleAuthMessage(sectionId, message, isError = false) {
  const messageBox = document.getElementById(`customerGoogle${sectionId}Message`);
  if (!messageBox) return;
  messageBox.textContent = message;
  messageBox.classList.toggle("is-error", isError);
  messageBox.classList.toggle("is-success", !isError && /successful/i.test(message));
}

function setGoogleAuthBusy(isBusy) {
  document.querySelectorAll(".customer-google-button").forEach((button) => {
    button.disabled = isBusy;
    button.setAttribute("aria-busy", String(isBusy));
  });
}

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  const existingScript = document.querySelector(`script[src="${googleIdentityScriptUrl}"]`);
  const script = existingScript || document.createElement("script");

  return new Promise((resolve, reject) => {
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Google sign-in could not be loaded. Check your connection and try again.")),
      { once: true }
    );
    if (!existingScript) {
      script.src = googleIdentityScriptUrl;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

function renderGoogleAuthButtons() {
  const buttonTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  document.querySelectorAll(".customer-google-button-slot").forEach((slot) => {
    slot.dataset.googleButtonTheme = buttonTheme;
  });
}

function handleGoogleAuthError(error) {
  const intent = googleAuthIntent;
  googleAuthIntent = null;
  googleAuthPending = false;
  setGoogleAuthBusy(false);
  if (intent) {
    const sectionName = intent === "signup" ? "Signup" : "Login";
    const reason = error?.reason ? ` (${error.reason})` : "";
    const userCancelled = ["cancelled", "popup_closed"].includes(error?.type) ||
      (error?.type === "skipped" && ["user_cancel", "tap_outside"].includes(error.reason));
    const message = userCancelled
      ? "Google sign-in was cancelled."
      : error?.type === "popup_failed_to_open"
        ? "Google sign-in popup was blocked. Allow popups for this site and try again."
        : `Google sign-in could not be opened${reason}. Check the browser console and the OAuth client's authorized origin.`;
    setGoogleAuthMessage(sectionName, message, !userCancelled);
  }
}

function handleGoogleTokenResponse(response) {
  const intent = googleAuthIntent;
  googleAuthIntent = null;
  if (!intent) {
    googleAuthPending = false;
    setGoogleAuthBusy(false);
    return;
  }

  const sectionName = intent === "signup" ? "Signup" : "Login";
  if (response.error || typeof response.access_token !== "string" || !response.access_token) {
    googleAuthPending = false;
    setGoogleAuthBusy(false);
    setGoogleAuthMessage(sectionName, "Google sign-in was not completed. Please try again.", true);
    return;
  }

  const message = intent === "signup"
    ? "Creating your account with Google..."
    : "Signing in with Google...";
  setGoogleAuthMessage(sectionName, message);

  apiRequest("/auth/google", {
    method: "POST",
    headers: { "X-Requested-With": "XmlHttpRequest" },
    body: JSON.stringify({
      accessToken: response.access_token,
      intent,
    }),
  })
    .then((data) => {
      saveSession(data);
      setGoogleAuthMessage(sectionName, "Google authentication successful. Redirecting...");
      window.location.replace(getCustomerPostAuthUrl());
    })
    .catch((error) => {
      const fallback = intent === "signup"
        ? "Google sign-up failed. Please try again or use the registration form."
        : "Google sign-in failed. Please try again or use your email and password.";
      setGoogleAuthMessage(sectionName, error.message || fallback, true);
      googleAuthPending = false;
      setGoogleAuthBusy(false);
    });
}

function startGoogleAuth(intent) {
  if (googleAuthPending) return;
  if (!googleIdentityInitialized || !googleTokenClient) {
    setGoogleAuthMessage(
      intent === "signup" ? "Signup" : "Login",
      "Google sign-in did not initialize. Check the diagnostic message above and try reloading.",
      true
    );
    return;
  }

  googleAuthIntent = intent;
  googleAuthPending = true;
  setGoogleAuthBusy(true);
  setGoogleAuthMessage(
    intent === "signup" ? "Signup" : "Login",
    "Waiting for Google account selection..."
  );
  try {
    googleTokenClient.requestAccessToken({ prompt: "select_account" });
  } catch (error) {
    handleGoogleAuthError({ type: "prompt_error", reason: error.message });
  }
}

function initializeGoogleAuth() {
  if (googleIdentityInitPromise) return googleIdentityInitPromise;

  googleIdentityInitPromise = (async () => {
    const loginMessage = "Login";
    const signupMessage = "Signup";
    setGoogleAuthMessage(loginMessage, "Loading Google sign-in...");
    setGoogleAuthMessage(signupMessage, "Loading Google sign-up...");
    renderGoogleAuthButtons();
    if (!googleThemeListenerRegistered) {
      window.addEventListener("dineari:themechange", renderGoogleAuthButtons);
      googleThemeListenerRegistered = true;
    }
    document.querySelectorAll(".customer-google-button").forEach((button) => {
      if (button.dataset.googleHandlerRegistered === "true") return;
      button.addEventListener("click", () => startGoogleAuth(button.dataset.googleIntent));
      button.dataset.googleHandlerRegistered = "true";
    });

    try {
      const config = await apiRequest("/auth/google/client-id");
      if (
        typeof config?.clientId !== "string" ||
        !config.clientId.trim() ||
        config.enabled === false
      ) {
        throw new Error("Google sign-in is not configured. Set GOOGLE_CLIENT_ID in the backend environment.");
      }

      await loadGoogleIdentityServices();
      if (!googleIdentityInitialized) {
        if (!window.google?.accounts?.oauth2) {
          throw new Error("Google Identity Services loaded without the OAuth API. Check the browser console and network access.");
        }
        googleTokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: config.clientId,
          scope: "openid email profile",
          callback: handleGoogleTokenResponse,
          error_callback: handleGoogleAuthError,
        });
        googleIdentityInitialized = true;
      }
      if (!document.querySelector(".customer-google-button")) {
        throw new Error("Google sign-in buttons could not be displayed. Please reload and try again.");
      }
      setGoogleAuthMessage(loginMessage, "");
      setGoogleAuthMessage(signupMessage, "");
    } catch (error) {
      const message = error.message || "Google sign-in is unavailable. Please use email and password.";
      setGoogleAuthMessage(loginMessage, message, true);
      setGoogleAuthMessage(signupMessage, message, true);
      console.error("Google Identity Services initialization failed.", error);
      throw error;
    }
  })();

  googleIdentityInitPromise.catch(() => {
    googleIdentityInitPromise = null;
  });
  return googleIdentityInitPromise;
}

function showCustomerPhoneError(message) {
  if (!customerPhoneInput || !customerPhoneError) return;
  customerPhoneInput.setAttribute("aria-invalid", String(Boolean(message)));
  customerPhoneError.textContent = message;
  customerPhoneError.hidden = !message;
}

if (customerPhoneInput && typeof window.intlTelInput === "function") {
  customerPhoneInputInstance = window.intlTelInput(customerPhoneInput, {
    initialCountry: "ph",
    countrySearch: true,
    separateDialCode: true,
    countrySelectorMode: "AUTO",
    dropdownParent: document.body,
    placeholderNumberPolicy: "POLITE",
    formatAsYouType: true,
    loadUtils: () => import("/vendor/intl-tel-input/js/utils.js"),
  });

  const validateCustomerPhone = () => {
    const value = customerPhoneInput.value.trim();
    if (!value) {
      showCustomerPhoneError("");
      return false;
    }
    if (/[^\d+().\s-]/.test(value)) {
      showCustomerPhoneError("Use digits only; spaces, +, parentheses, and hyphens are allowed.");
      return false;
    }
    if (customerPhoneUtilsFailed) {
      showCustomerPhoneError("Phone number validation is unavailable. Please reload and try again.");
      return false;
    }
    if (!customerPhoneUtilsReady) {
      showCustomerPhoneError("Phone number validation is still loading.");
      return false;
    }
    if (!customerPhoneInputInstance.isValidNumberPrecise()) {
      showCustomerPhoneError("Enter a valid phone number for the selected country.");
      return false;
    }

    showCustomerPhoneError("");
    return true;
  };

  customerPhoneInput.addEventListener("input", validateCustomerPhone);
  customerPhoneInput.addEventListener("blur", validateCustomerPhone);
  customerPhoneInput.addEventListener("countrychange", validateCustomerPhone);

  customerPhoneInputInstance.promise
    .then(() => {
      customerPhoneUtilsReady = true;
      if (customerPhoneInput.value.trim()) validateCustomerPhone();
    })
    .catch((error) => {
      customerPhoneUtilsFailed = true;
      console.error("Customer phone number validation could not be loaded.", error);
      showCustomerPhoneError("Phone number validation is unavailable. Please reload and try again.");
    });
} else if (customerPhoneInput) {
  customerPhoneUtilsFailed = true;
  showCustomerPhoneError("Phone number validation is unavailable. Please reload and try again.");
}

customerRegistrationForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fullName = document.getElementById("customerFullName")?.value.trim() || "";
  const email = document.getElementById("customerRegistrationEmail")?.value.trim() || "";
  const contactNumber = customerPhoneInput?.value.trim() || "";
  const password = document.getElementById("customerRegistrationPassword")?.value || "";
  const confirmPassword = document.getElementById("customerConfirmPassword")?.value || "";
  const messageId = "customerRegistrationMessage";
  const button = document.getElementById("customerRegistrationButton");

  if (!fullName || !email || !contactNumber || !password || !confirmPassword) {
    showAuthMessage("Complete all required fields.", true, messageId);
    return;
  }
  if (
    !customerPhoneInputInstance ||
    !customerPhoneUtilsReady ||
    customerPhoneUtilsFailed ||
    /[^\d+().\s-]/.test(contactNumber) ||
    !customerPhoneInputInstance.isValidNumberPrecise()
  ) {
    if (!customerPhoneUtilsReady || customerPhoneUtilsFailed || !customerPhoneInputInstance) {
      showCustomerPhoneError("Phone number validation is unavailable or still loading. Please try again.");
    } else if (/[^\d+().\s-]/.test(contactNumber)) {
      showCustomerPhoneError("Use digits only; spaces, +, parentheses, and hyphens are allowed.");
    } else {
      showCustomerPhoneError("Enter a valid phone number for the selected country.");
    }
    customerPhoneInput?.focus();
    return;
  }
  showCustomerPhoneError("");
  if (password !== confirmPassword) {
    showAuthMessage("Passwords do not match.", true, messageId);
    return;
  }
  if (password.length < 8) {
    showAuthMessage("Password must be at least 8 characters.", true, messageId);
    return;
  }
  if (button?.disabled) return;

  if (button) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Creating account...";
  }
  try {
    const data = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        full_name: fullName,
        email,
        contact_number: customerPhoneInputInstance.getNumber(),
        password,
        confirm_password: confirmPassword,
      }),
    });
    saveSession(data);
    showAuthMessage("Account created. Redirecting to Dine-Ari...", false, messageId);
    window.location.replace(getCustomerPostAuthUrl());
  } catch (error) {
    showAuthMessage(error.message || "Account registration failed.", true, messageId);
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = "Create Account";
    }
  }
});

const customerAuthTabs = document.querySelectorAll(".customer-auth-tabs [role='tab']");

function activateCustomerAuthTab(tab) {
  const targetId = tab.getAttribute("aria-controls");
  const targetPanel = targetId ? document.getElementById(targetId) : null;
  if (!targetPanel) return;

  customerAuthTabs.forEach((candidate) => {
    const isActive = candidate === tab;
    candidate.setAttribute("aria-selected", String(isActive));
    candidate.tabIndex = isActive ? 0 : -1;

    const panel = document.getElementById(candidate.getAttribute("aria-controls"));
    if (panel) panel.hidden = !isActive;
  });
  if (googleIdentityInitialized) renderGoogleAuthButtons();
}

customerAuthTabs.forEach((tab) => {
  tab.addEventListener("click", (event) => {
    event.preventDefault();
    activateCustomerAuthTab(tab);
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}${tab.getAttribute("href")}`);
  });
});

document.querySelectorAll("[data-customer-auth-target]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const tab = document.getElementById(link.dataset.customerAuthTarget);
    if (!tab) return;
    activateCustomerAuthTab(tab);
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}${tab.getAttribute("href")}`);
  });
});

const initialCustomerAuthTab = document.querySelector(
  `.customer-auth-tabs [href="${window.location.hash === "#signup" ? "#signup" : "#login"}"]`
);
if (initialCustomerAuthTab) activateCustomerAuthTab(initialCustomerAuthTab);

void initializeGoogleAuth().catch((error) => {
  console.error("Google Identity Services initialization failed.", error);
});
