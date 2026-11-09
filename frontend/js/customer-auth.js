const customerRegistrationForm = document.getElementById("customerRegistrationForm");
const customerPhoneInput = document.getElementById("customerContactNumber");
const customerPhoneError = document.getElementById("customerContactNumberError");
let customerPhoneInputInstance = null;
let customerPhoneUtilsReady = false;
let customerPhoneUtilsFailed = false;

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
