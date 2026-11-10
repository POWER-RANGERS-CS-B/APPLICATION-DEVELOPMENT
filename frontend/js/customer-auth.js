const customerRegistrationForm = document.getElementById("customerRegistrationForm");
const customerPhoneInput = document.getElementById("customerContactNumber");
const customerPhoneError = document.getElementById("customerContactNumberError");
const googleIdentityScriptUrl = "https://accounts.google.com/gsi/client?hl=en";
let googleIdentityInitPromise = null;
let googleIdentityInitialized = false;
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
  document.querySelectorAll(".customer-google-button-slot").forEach((slot) => {
    slot.classList.toggle("is-loading", isBusy);
    slot.setAttribute("aria-busy", String(isBusy));
  });
}

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve();

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
  if (!googleIdentityInitialized || !window.google?.accounts?.id) return;

  const isDarkTheme = document.documentElement.dataset.theme === "dark";
  const buttonTheme = isDarkTheme ? "filled_black" : "outline";
  [
    { id: "customerGoogleLoginButton", section: "Login" },
    { id: "customerGoogleSignupButton", section: "Signup" },
  ].forEach(({ id, section }) => {
    const slot = document.getElementById(id);
    if (!slot || slot.closest("[hidden]")) return;
    if (
      slot.dataset.googleButtonRendered === "true" &&
      slot.dataset.googleButtonTheme === buttonTheme
    ) return;

    const width = Math.floor(slot.getBoundingClientRect().width);
    if (width < 1) return;

    slot.replaceChildren();
    window.google.accounts.id.renderButton(slot, {
      type: "standard",
      theme: buttonTheme,
      size: "large",
      shape: "rectangular",
      text: "continue_with",
      locale: "en",
      logo_alignment: "center",
      width: Math.min(width, 400),
    });
    if (slot.dataset.googleIntentListeners !== "true") {
      const intent = section.toLowerCase();
      const rememberIntent = () => {
        googleAuthIntent = intent;
      };
      slot.addEventListener("pointerdown", rememberIntent);
      slot.addEventListener("click", rememberIntent);
      slot.dataset.googleIntentListeners = "true";
    }
    slot.dataset.googleButtonRendered = "true";
    slot.dataset.googleButtonTheme = buttonTheme;
    setGoogleAuthMessage(section, "");
  });
}

function handleGoogleCredential(response) {
  if (googleAuthPending) return;
  const activeSection = document.querySelector(".customer-auth-section:not([hidden])");
  const isSignup = (googleAuthIntent || activeSection?.id) === "signup";
  googleAuthIntent = null;
  const sectionName = isSignup ? "Signup" : "Login";
  const message = isSignup
    ? "Creating your account with Google..."
    : "Signing in with Google...";
  googleAuthPending = true;
  setGoogleAuthBusy(true);
  setGoogleAuthMessage(sectionName, message);

  apiRequest("/auth/google", {
    method: "POST",
    body: JSON.stringify({
      credential: response.credential,
      intent: isSignup ? "signup" : "login",
    }),
  })
    .then((data) => {
      saveSession(data);
      setGoogleAuthMessage(sectionName, "Google authentication successful. Redirecting...");
      window.location.replace(getCustomerPostAuthUrl());
    })
    .catch((error) => {
      const fallback = isSignup
        ? "Google sign-up failed. Please try again or use the registration form."
        : "Google sign-in failed. Please try again or use your email and password.";
      setGoogleAuthMessage(sectionName, error.message || fallback, true);
      googleAuthPending = false;
      setGoogleAuthBusy(false);
    });
}

function initializeGoogleAuth() {
  if (googleIdentityInitPromise) return googleIdentityInitPromise;

  googleIdentityInitPromise = (async () => {
    const loginMessage = "Login";
    const signupMessage = "Signup";
    setGoogleAuthMessage(loginMessage, "Loading Google sign-in...");
    setGoogleAuthMessage(signupMessage, "Loading Google sign-up...");

    try {
      const config = await apiRequest("/auth/google/client-id");
      if (typeof config?.clientId !== "string" || !config.clientId.trim()) {
        throw new Error("Google sign-in is not configured. Please use email and password for now.");
      }

      await loadGoogleIdentityServices();
      if (!googleIdentityInitialized) {
        window.google.accounts.id.initialize({
          client_id: config.clientId,
          callback: handleGoogleCredential,
          auto_select: false,
          button_auto_select: false,
          use_fedcm_for_button: false,
        });
        googleIdentityInitialized = true;
      }
      renderGoogleAuthButtons();
      if (!googleThemeListenerRegistered) {
        window.addEventListener("dineari:themechange", renderGoogleAuthButtons);
        googleThemeListenerRegistered = true;
      }
      if (!document.querySelector(".customer-google-button-slot[data-google-button-rendered='true']")) {
        throw new Error("Google sign-in buttons could not be displayed. Please reload and try again.");
      }
    } catch (error) {
      const message = error.message || "Google sign-in is unavailable. Please use email and password.";
      setGoogleAuthMessage(loginMessage, message, true);
      setGoogleAuthMessage(signupMessage, message, true);
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
