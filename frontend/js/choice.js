let orderType = null;
let selectedChairIds = [];
let cart = [];
let menuItems = [];
let activeCategory = "All";
let reservationDetails = null;
let activeFloor = 1;
let floorChairs = [];
let floorTables = [];
let selectedTableId = null;
<<<<<<< HEAD
=======
let dineInHeldTableId = null;
let reservationPhoneInput = null;
let reservationPhoneUtilsReady = false;
let reservationCustomerProfilePromise = null;
let reservationCustomerNameEdited = false;
let reservationCustomerContactEdited = false;
let reservationContinueInProgress = false;
let reservationSubmissionInProgress = false;
let reservationStatusPollTimer = null;
let reservationCompletionRedirectTimer = null;
let reservationStatusToken = null;
let dineInOrderStatusTimer = null;
let dineInCountdownTimer = null;
let activeDineInOrderId = null;
let customerReservationToken = null;
let customerNotificationRefreshTimer = null;
let customerNotificationRefreshPromise = null;
let customerNotificationMutationVersion = 0;
let customerUnreadNotificationCount = 0;
let customerMarkAllNotificationsInFlight = false;
const customerNotificationRequestsInFlight = new Set();
let customerAccountMenuCloseTimer = null;
let customerAuthMenuCloseTimer = null;
let customerNavigationRefreshId = 0;
let chairHoldInProgress = false;
let orderSubmissionInProgress = false;
let paymentConfirmationInProgress = false;
let floorPlanZoomIndex = 0;
let floorPlanResizeObserver = null;
let floorPlanResizeFrame = 0;
let floorPlanFallbackResizeHandler = null;
let floorPlanScalingAbortController = null;
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

const FLOOR_PLAN_DESIGN_WIDTH = 760;
const FLOOR_PLAN_ZOOM_LEVELS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];

function syncLucideIcons() {
  if (window.lucide) window.lucide.createIcons();
}

const foodImages = {
  "Halo-Halo": "images/menu-images/halo-halo.png",
  "Leche Flan": "images/menu-images/leche-flan.png",
  "Bibingka": "images/menu-images/bibingka.png",
  "Sisig Fries": "images/menu-images/sisig-fries.png",
  "Turon": "images/menu-images/turon.png",


  "Coke": "images/menu-images/coke.png",
  "Iced Tea": "images/menu-images/iced-tea.png",
  "Buko Juice": "images/menu-images/buko-juice.png",
  "Mango Shake": "images/menu-images/mango-shake.png",

  "Lumpiang Shanghai": "images/menu-images/lumpiang-shanghai.png",
  "Chicken Wings": "images/menu-images/chicken-wings.png",
  "Garlic Butter Shrimp": "images/menu-images/garlic-butter-shrimp.png",

  "Chicken Adobo": "images/menu-images/chicken-adobo.png",
  "Bulalo": "images/menu-images/bulalo.png",
  "Grilled Bangus": "images/menu-images/grilled-bangus.png",
  "Pork Caldereta": "images/menu-images/pork-caldereta.png",
  "Pork Sinigang": "images/menu-images/pork-sinigang.png",
  "Beef Kare-Kare": "images/menu-images/beef-kare-kare.png",
  "Lechon Kawali": "images/menu-images/lechon-kawali.png",

  "Chicken Inasal Meal": "images/menu-images/chicken-inasal-meal.png",
  "Pork BBQ Meal": "images/menu-images/pork-bbq-meal.png",
  "Tapsilog": "images/menu-images/tapsilog.png"
};

async function request(path, options = {}) {
  if (typeof apiRequest === "function") {
    return apiRequest(path, options);
  }

  const base = `${window.location.origin}/api`;
  const token = localStorage.getItem("token");

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (isDineIn) {
    showDineInOrderPending(order);
    return;
  }

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) throw new Error(data.message || "Request failed.");
  return data;
}

function logout() {
  void logoutTo("choice.html");
}

function requireCustomerSession(flow = null) {
  const user = typeof getUser === "function" ? getUser() : {};
  if (user.role === "customer" && localStorage.getItem("token")) return true;
  const returnFlow = flow === "dine_in" ? "?flow=dine_in" : "";
  window.location.href = `customer-auth.html${returnFlow}#login`;
  return false;
}

function positionCustomerThemeSwitch(signedIn) {
  const themeSwitch = document.getElementById("themeSwitch")?.closest(".theme-switch");
  const actions = document.querySelector(".home-topbar-actions");
  const sessionActions = document.getElementById("customerSessionActions");
  const accountMenu = sessionActions?.querySelector(".customer-account-menu-wrap");
  if (!themeSwitch || !actions || !sessionActions) return;

  if (signedIn && accountMenu) {
    sessionActions.insertBefore(themeSwitch, accountMenu.nextSibling);
  } else {
    actions.insertBefore(themeSwitch, sessionActions);
  }
}

async function updateCustomerNavigation() {
  const cachedUser = typeof getUser === "function" ? getUser() : {};
  const token = typeof getToken === "function" ? getToken() : localStorage.getItem("token");
  const authLinks = document.getElementById("customerAuthLinks");
  const sessionActions = document.getElementById("customerSessionActions");
  const welcome = document.getElementById("customerWelcomeName");
  const refreshId = ++customerNavigationRefreshId;
  let user = {};
  let signedIn = false;

  if (cachedUser.role === "customer" && token) {
    if (authLinks) authLinks.hidden = true;
    if (sessionActions) sessionActions.hidden = true;
    try {
      const profile = await request("/customers/profile");
      if (refreshId !== customerNavigationRefreshId) return;
      user = { ...cachedUser, ...profile };
      signedIn = true;
    } catch (error) {
      if (refreshId !== customerNavigationRefreshId) return;
      console.error("Could not verify the customer session:", error.message);
    }
  }

  if (authLinks) authLinks.hidden = signedIn;
  if (sessionActions) sessionActions.hidden = !signedIn;
  positionCustomerThemeSwitch(signedIn);
  if (welcome) welcome.textContent = signedIn
    ? user.full_name || user.fullName || user.name || ""
    : "";
  if (signedIn) setCustomerAuthMenuOpen(false);
  const avatarImage = document.getElementById("customerAvatarImage");
  const avatarIcon = document.querySelector("#customerAvatar [data-lucide]");
  const avatarUrl = user.picture || user.avatar_url || user.profile_picture_url || "";
  const safeAvatarUrl = typeof avatarUrl === "string" && /^https:\/\//i.test(avatarUrl);
  if (avatarImage) {
    avatarImage.hidden = !signedIn || !safeAvatarUrl;
    if (signedIn && safeAvatarUrl && avatarImage.src !== avatarUrl) {
      avatarImage.src = avatarUrl;
      avatarImage.onerror = () => {
        avatarImage.hidden = true;
        if (avatarIcon) avatarIcon.hidden = false;
      };
    } else if (!safeAvatarUrl) {
      avatarImage.removeAttribute("src");
    }
  }
  if (avatarIcon) avatarIcon.hidden = signedIn && safeAvatarUrl && avatarImage && !avatarImage.hidden;
  if (!signedIn && customerNotificationRefreshTimer) {
    clearInterval(customerNotificationRefreshTimer);
    customerNotificationRefreshTimer = null;
    updateCustomerNotificationCounts(0);
  } else if (signedIn && !customerNotificationRefreshTimer) {
    void refreshCustomerNotifications();
    customerNotificationRefreshTimer = setInterval(refreshCustomerNotifications, 30000);
  }
}

function hideCustomerSections() {
  [
    "choicePanel",
    "reservationSection",
    "reservationPaymentSection",
    "floorSection",
    "menuSection",
    "paymentSection",
    "receiptSection"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

function updateFlowStep(stepNumber) {
  const labels = orderType === "reservation"
    ? ["Choose Mode", "Reservation Details", "Select Table", "Payment Method", "Status"]
    : ["Choose Mode", "Select Table", "Order Food", "Payment", "Receipt"];
  document.querySelectorAll(".flow-step").forEach((step, index) => {
    const isActive = index + 1 === stepNumber;
    step.classList.toggle("active", isActive);
    step.classList.toggle("done", index + 1 < stepNumber);
    step.setAttribute("aria-current", isActive ? "step" : "false");
    const label = step.querySelector("span");
    if (label) label.textContent = labels[index];
  });
  const currentStepLabel = document.getElementById("currentStepLabel");
  if (currentStepLabel) currentStepLabel.textContent = `Step ${stepNumber} of 5 · ${labels[stepNumber - 1] || labels[0]}`;
}

function showSection(sectionId, flowStep = 1, display = "block") {
  hideCustomerSections();

  const cartDialog = document.getElementById("cartDialog");
  const floatingCartButton = document.getElementById("floatingCartButton");
  if (cartDialog?.open && sectionId !== "menuSection") cartDialog.close();
  if (floatingCartButton) floatingCartButton.hidden = sectionId !== "menuSection";

  const section = document.getElementById(sectionId);
  if (section) section.style.display = display;

  const customerLayout = document.querySelector(".customer-layout");

  if (customerLayout) {
    customerLayout.classList.toggle("payment-mode", sectionId === "paymentSection");
  }

  updateFlowStep(flowStep);
}

function showChoicePanel() {
  if (reservationCompletionRedirectTimer) {
    clearTimeout(reservationCompletionRedirectTimer);
    reservationCompletionRedirectTimer = null;
  }
  orderType = null;
  selectedChairIds = [];
  selectedTableId = null;
<<<<<<< HEAD
=======
  dineInHeldTableId = null;
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  cart = [];
  reservationDetails = null;

  const qrBox = document.querySelector(".receipt-qr-box");
  if (qrBox) qrBox.hidden = false;

  const qrImage = document.getElementById("qrImage");
  if (qrImage) {
    qrImage.style.display = "block";
    qrImage.removeAttribute("src");
  }

  const thankYouMessage = document.getElementById("thankYouMessage");
  if (thankYouMessage) thankYouMessage.textContent = "";
  const dineInStatusPanel = document.getElementById("dineInOrderStatusPanel");
  if (dineInStatusPanel) dineInStatusPanel.hidden = true;
  const receiptIntro = document.getElementById("receiptIntro");
  if (receiptIntro) receiptIntro.hidden = false;
  stopDineInOrderStatusPolling();
  const receiptHomeButton = document.getElementById("receiptNewOrderButton");
  if (receiptHomeButton) receiptHomeButton.textContent = "New Order";
  document.getElementById("receiptSection")?.classList.remove("reservation-completion-mode");
  const completionPanel = document.getElementById("reservationCompletionPanel");
  if (completionPanel) completionPanel.hidden = true;
  updateReceiptSummary({});

  showSection("choicePanel", 1, "grid");
  updateChairSelectionUI();
  updateCartTotal();
}

function showReservationSection() {
  if (!requireCustomerSession()) return;
  orderType = "reservation";
  selectedChairIds = [];
  selectedTableId = null;
<<<<<<< HEAD
=======
  dineInHeldTableId = null;
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  reservationDetails = null;
  updateChairSelectionUI();
  updateCartTotal();

  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
  const dateInput = document.getElementById("reservationDate");

  if (dateInput) {
    dateInput.min = today;
    dateInput.value = today;
  }

  updateReservationCustomerValidation();
  showSection("reservationSection", 2);
  void populateReservationCustomerInfo();
}

function setReservationProfileMessage(message) {
  const status = document.getElementById("reservationProfileMessage");
  if (!status) return;
  status.textContent = message;
  status.hidden = !message;
}

async function populateReservationCustomerInfo() {
  const nameInput = document.getElementById("reservationName");
  const contactInput = document.getElementById("reservationContact");
  if (!nameInput || !contactInput) return;

  const initialName = nameInput.value;
  const initialContact = contactInput.value;
  if (!reservationCustomerProfilePromise) {
    reservationCustomerProfilePromise = request("/customers/profile");
  }

  try {
    const profile = await reservationCustomerProfilePromise;
    const profileName =
      typeof profile?.full_name === "string" ? profile.full_name.trim() : "";
    const profileContact =
      typeof profile?.contact_number === "string" ? profile.contact_number.trim() : "";
    if (!profileName && !profileContact) {
      throw new Error("The customer profile is missing reservation contact details.");
    }

    if (
      !reservationCustomerNameEdited &&
      !initialName.trim() &&
      nameInput.value === initialName &&
      profileName
    ) {
      nameInput.value = profileName;
    }

    if (
      !reservationCustomerContactEdited &&
      !initialContact.trim() &&
      contactInput.value === initialContact &&
      profileContact
    ) {
      if (reservationPhoneInput) {
        reservationPhoneInput.setNumber(profileContact);
      } else {
        contactInput.value = profileContact;
      }
    }

    setReservationProfileMessage(
      profileName && profileContact
        ? ""
        : "Some saved details are unavailable. Enter the missing information manually."
    );
    updateReservationCustomerValidation();
  } catch (error) {
    reservationCustomerProfilePromise = null;
    console.error("Could not load the customer profile for reservation details.", error);
    setReservationProfileMessage(
      "Your saved details could not be loaded. Enter your name and contact number manually."
    );
    updateReservationCustomerValidation();
  }
}

function backToReservationDetails() {
  orderType = "reservation";
  selectedChairIds = [];
  selectedTableId = null;
  updateChairSelectionUI();
  showSection("reservationSection", 2);
}

function initializeReservationPhoneInput() {
  const input = document.getElementById("reservationContact");
  if (!input) return;

  if (typeof window.intlTelInput !== "function") {
    console.error("International phone input failed to load.");
    updateReservationField(
      "reservationContact",
      "reservationContactError",
      false,
      "Phone number validation is unavailable. Please reload and try again."
    );
    return;
  }

  reservationPhoneInput = window.intlTelInput(input, {
    initialCountry: "ph",
    countrySearch: true,
    separateDialCode: true,
    countrySelectorMode: "AUTO",
    dropdownParent: document.body,
    placeholderNumberPolicy: "AGGRESSIVE",
    formatAsYouType: true,
    loadUtils: () => import("/vendor/intl-tel-input/js/utils.js")
  });

  const updateValidation = () => updateReservationCustomerValidation();
  input.addEventListener("input", () => {
    reservationCustomerContactEdited = true;
    updateValidation();
  });
  input.addEventListener("blur", updateValidation);
  input.addEventListener("countrychange", () => {
    reservationCustomerContactEdited = true;
    updateValidation();
  });

  reservationPhoneInput.promise.then(() => {
    reservationPhoneUtilsReady = true;
    updateValidation();
  }).catch((error) => {
    console.error("International phone number validation could not be loaded.", error);
    updateReservationField(
      "reservationContact",
      "reservationContactError",
      false,
      "Phone number validation is unavailable. Please reload and try again."
    );
    const continueButton = document.getElementById("continueReservationButton");
    if (continueButton) continueButton.disabled = true;
  });
}

function validateReservationName(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateReservationContact() {
  const value = document.getElementById("reservationContact")?.value ?? "";
  if (!value.trim()) return { valid: false, message: "Enter your contact number." };
  if (!reservationPhoneUtilsReady || !reservationPhoneInput) {
    return { valid: false, message: "Phone number validation is still loading." };
  }
  if (!reservationPhoneInput.isValidNumberPrecise()) {
    return { valid: false, message: "Enter a valid phone number for the selected country." };
  }
  return { valid: true, message: "" };
}

function updateReservationField(inputId, errorId, isValid, message) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (!input || !error) return isValid;

  input.setAttribute("aria-invalid", String(!isValid));
  error.textContent = isValid ? "" : message;
  error.hidden = isValid;
  return isValid;
}

function updateReservationCustomerValidation() {
  const name = document.getElementById("reservationName")?.value ?? "";
  const trimmedName = name.trim();
  const nameMessage = !trimmedName
    ? "Enter your full name."
    : trimmedName.length > 128
      ? "Your full name must be 128 characters or fewer."
      : "";
  const nameValid = updateReservationField(
    "reservationName",
    "reservationNameError",
    validateReservationName(name) && !nameMessage,
    nameMessage
  );
  const contactValidation = validateReservationContact();
  const contactValid = updateReservationField(
    "reservationContact",
    "reservationContactError",
    contactValidation.valid,
    contactValidation.message
  );
  const continueButton = document.getElementById("continueReservationButton");
  if (continueButton) {
    continueButton.disabled =
      reservationContinueInProgress || !(nameValid && contactValid);
  }
  if (nameValid && contactValid) setReservationProfileMessage("");
  return nameValid && contactValid;
}

async function continueReservationToChairs() {
  if (reservationContinueInProgress) return;

  if (!updateReservationCustomerValidation()) {
    const name = document.getElementById("reservationName");
    const contact = document.getElementById("reservationContact");
    (name?.getAttribute("aria-invalid") === "true" ? name : contact)?.focus();
    return;
  }

  const date = document.getElementById("reservationDate")?.value;
  const time = document.getElementById("reservationTime")?.value;
<<<<<<< HEAD
  const name =
    document.getElementById("reservationName")?.value.trim() ||
    localStorage.getItem("full_name") ||
    "Customer";
  const contactInput = document.getElementById("reservationContact");
  const localMobileNumber = contactInput?.value.trim() || "";
=======
  const name = document.getElementById("reservationName")?.value.trim();
  const contact = reservationPhoneInput?.getNumber();
  const selectedCountry = reservationPhoneInput?.getSelectedCountry();
  const contactCountry = selectedCountry?.iso2;
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

  if (!date || !time) {
    alert("Please select reservation date and time.");
    document.getElementById(!date ? "reservationDate" : "reservationTime")?.focus();
    return;
  }

  if (!contact || !contactCountry) {
    alert("Please enter a valid contact number and select its country.");
    document.getElementById("reservationContact")?.focus();
    return;
  }

  if (!/^9\d{9}$/.test(localMobileNumber)) {
    alert("Enter a valid 10-digit Philippine mobile number starting with 9.");
    contactInput?.focus();
    return;
  }

  const contact = `+63${localMobileNumber}`;

  reservationDetails = {
    date,
    time,
    name,
    contact,
    contactCountry
  };

  reservationContinueInProgress = true;
  const continueButton = document.getElementById("continueReservationButton");
  if (continueButton) {
    continueButton.disabled = true;
    continueButton.textContent = "Loading tables...";
  }

  try {
    showSection("floorSection", 3);
    await loadFloorPlan();
  } finally {
    reservationContinueInProgress = false;
    if (continueButton) {
      continueButton.textContent = "Continue to Select Table";
      updateReservationCustomerValidation();
    }
  }
}

function continueFromTableSelection() {
  if (orderType !== "reservation") {
    void lockSelectedChairs();
    return;
  }
  if (!reservationDetails) {
    alert("Reservation details are missing.");
    return;
  }
  if (!selectedTableId) {
    alert("Please select an available table.");
    return;
  }

  updateReservationPaymentSummary();
  showSection("reservationPaymentSection", 4);
  syncLucideIcons();
}

function backToReservationTableSelection() {
  if (orderType !== "reservation") return;
  showSection("floorSection", 3);
}

async function chooseType(type) {
  if (type === "dine_in") {
    window.history.replaceState(null, "", `${window.location.pathname}?flow=dine_in`);
  }
  if (!requireCustomerSession(type === "dine_in" ? "dine_in" : null)) return;

  if (type === "dine_in") {
    try {
      await request("/customers/profile");
    } catch (error) {
      if (error.status !== 401) {
        alert(error.message || "Unable to verify your customer account.");
      }
      return;
    }
  }

  orderType = type;
  selectedChairIds = [];
  selectedTableId = null;
<<<<<<< HEAD
=======
  dineInHeldTableId = null;
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  cart = [];
  updateChairSelectionUI();
  updateCartTotal();

  if (type === "dine_in") {
    showSection("floorSection", 2);
    const guestCount = document.getElementById("guestCount");
    if (guestCount) guestCount.textContent = "0";
    await loadFloorPlan();
    return;
  }

  showSection("menuSection", 3);
  await loadMenu();
}

const restaurantBlueprint = {
  tables: [
    // ===== TOP ROW =====
    { id: 1, x: 14, y: 30, chairs: 4, shape: "circle", floor: 1 },
    { id: 2, x: 50, y: 30, chairs: 4, shape: "circle", floor: 1 },
    { id: 3, x: 86, y: 30, chairs: 4, shape: "circle", floor: 1 },

    // ===== MIDDLE ROW =====
    { id: 4, x: 24, y: 70, chairs: 4, shape: "circle", floor: 1 },
    { id: 5, x: 58, y: 70, chairs: 4, shape: "circle", floor: 1 },
    { id: 6, x: 86, y: 70, chairs: 4, shape: "circle", floor: 1 },

    // ===== TWO-SEAT TABLES ON FLOOR 1 =====
    { id: 11, x: 14, y: 90, chairs: 2, shape: "small", floor: 1 },
    { id: 12, x: 38, y: 90, chairs: 2, shape: "small", floor: 1 },
    { id: 13, x: 62, y: 90, chairs: 2, shape: "small", floor: 1 },
    { id: 14, x: 86, y: 90, chairs: 2, shape: "small", floor: 1 },

    // ===== FLOOR 2 GROUP TABLES =====
    { id: 7, x: 22, y: 32, chairs: 8, shape: "rect-medium", floor: 2 },
    { id: 8, x: 78, y: 32, chairs: 8, shape: "rect-medium", floor: 2 },
    { id: 9, x: 22, y: 72, chairs: 10, shape: "rect-large", floor: 2 },
    { id: 10, x: 78, y: 72, chairs: 10, shape: "rect-large", floor: 2 }
  ]
};

<<<<<<< HEAD
function getChairPosition(chairCount, index) {
  const positions = {
    2: [
      { x: -55, y: 0 },
      { x: 55, y: 0 }
    ],

    4: [
      { x: 0, y: -65 },
      { x: 65, y: 0 },
      { x: 0, y: 65 },
      { x: -65, y: 0 }
    ],

    6: [
      { x: -75, y: -40 },
      { x: 0, y: -55 },
      { x: 75, y: -40 },
      { x: -75, y: 40 },
      { x: 0, y: 55 },
      { x: 75, y: 40 }
    ],

    8: [
      { x: -85, y: -55 },
      { x: -28, y: -55 },
      { x: 28, y: -55 },
      { x: 85, y: -55 },
      { x: -85, y: 55 },
      { x: -28, y: 55 },
      { x: 28, y: 55 },
      { x: 85, y: 55 }
    ],

    10: [
      { x: -48, y: -65 },
      { x: 0, y: -65 },
      { x: 48, y: -65 },
      { x: -48, y: 65 },
      { x: 0, y: 65 },
      { x: 48, y: 65 },
      { x: -105, y: 0 },
      { x: 105, y: 0 },
      { x: -85, y: -65 },
      { x: 85, y: 65 }
    ]
=======
function getChairPosition(chairCount, index, shape) {
  const radiusX = shape === "rect-large" ? 112 : shape === "rect-medium" ? 100 : shape === "circle" ? 78 : 68;
  const radiusY = shape === "rect-large" ? 70 : shape === "rect-medium" ? 64 : shape === "circle" ? 78 : 48;
  const angle = (-Math.PI / 2) + (2 * Math.PI * index) / Math.max(chairCount, 1);
  return {
    x: Math.round(Math.cos(angle) * radiusX),
    y: Math.round(Math.sin(angle) * radiusY)
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  };
}

async function loadFloorPlan() {
  let chairs = [];
  let tables = [];

  try {
    const tableQuery = new URLSearchParams();
    if (orderType === "reservation" && reservationDetails?.date && reservationDetails?.time) {
      tableQuery.set("reservation_date", reservationDetails.date);
      tableQuery.set("reservation_time", reservationDetails.time);
    }
    const tableQueryString = tableQuery.toString();
    const tablePath = tableQueryString ? `/tables?${tableQueryString}` : "/tables";
    const chairData = await request("/chairs");
    const tableData = await request(tablePath);

    floorChairs = Array.isArray(chairData) ? chairData : [];
    floorTables = Array.isArray(tableData) ? tableData : [];
  } catch (error) {
    console.warn("Using local floor layout because backend chairs/tables failed:", error.message);
    floorChairs = [];
    floorTables = [];
  }

  renderFloorPlan();
}

function switchFloor(floor) {
  activeFloor = Number(floor) === 2 ? 2 : 1;

  [1, 2].forEach((floorNumber) => {
    const tab = document.getElementById(`floor${floorNumber}Tab`);
    if (!tab) return;
    const isActive = floorNumber === activeFloor;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  renderFloorPlan();
}

function renderFloorPlan() {
  const floorPlan = document.getElementById("floorPlan");
  if (!floorPlan) return;

  floorPlan.dataset.floor = String(activeFloor);
  floorPlan.innerHTML = "";

<<<<<<< HEAD
  const tablesOnFloor = restaurantBlueprint.tables.filter(
    (table) => table.floor === activeFloor
  );

  tablesOnFloor.forEach((blueprintTable) => {
    const realTable =
      floorTables.find((t) => Number(t.id ?? t.table_id) === Number(blueprintTable.id)) || {
        id: blueprintTable.id,
        table_id: blueprintTable.id,
        table_name: `T${blueprintTable.id}`
      };

    const tableChairs = floorChairs.filter(
      (c) => Number(c.table_id ?? c.tableId) === Number(blueprintTable.id)
=======
  const configuredTables = [...floorTables].sort(
    (first, second) => Number(first.id ?? first.table_id) - Number(second.id ?? second.table_id)
  );
  const tablesOnFloor = restaurantBlueprint.tables.filter(
    (table) => table.floor === activeFloor
  );
  const floorOffset = activeFloor === 1 ? 0 : 10;
  const floorTableSlots = configuredTables.slice(floorOffset, floorOffset + tablesOnFloor.length);
  const usedTableIds = new Set();
  let renderedTables = 0;

  tablesOnFloor.forEach((blueprintTable, index) => {
    const realTableIdForSlot = (table) => Number(table.id ?? table.table_id);
    const tableNameForSlot = `T${blueprintTable.id}`;
    const realTable = configuredTables.find((table) =>
      !usedTableIds.has(realTableIdForSlot(table)) &&
      String(table.table_name || table.name || "").trim().toLowerCase() === tableNameForSlot.toLowerCase()
    ) || configuredTables.find((table) =>
      !usedTableIds.has(realTableIdForSlot(table)) &&
      realTableIdForSlot(table) === Number(blueprintTable.id)
    ) || floorTableSlots.find((table) =>
      !usedTableIds.has(realTableIdForSlot(table))
    );
    if (!realTable) return;
    const realTableId = realTableIdForSlot(realTable);
    usedTableIds.add(realTableId);
    renderedTables += 1;

    const tableChairs = floorChairs.filter(
      (c) => Number(c.table_id ?? c.tableId) === realTableId
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    );

    const chairSource = tableChairs;

    const isAvailable =
      String(realTable.status || "vacant").toLowerCase() === "vacant" &&
      chairSource.length > 0 &&
      chairSource.every((chair) => String(chair.status || "vacant").toLowerCase() === "vacant");

    const isAvailable =
      String(realTable.effective_status || realTable.status || "vacant").toLowerCase() === "vacant" &&
      chairSource.length > 0 &&
      chairSource.every((chair) => String(chair.status || "vacant").toLowerCase() === "vacant");

    const tableGroup = document.createElement("div");
    tableGroup.className = "table-group";
    tableGroup.style.left = `${blueprintTable.x}%`;
    tableGroup.style.top = `${blueprintTable.y}%`;

    const tableBox = document.createElement("button");
    tableBox.type = "button";
    tableBox.className = `table-box ${blueprintTable.shape} table-select`;
<<<<<<< HEAD
    tableBox.dataset.tableId = blueprintTable.id;
    tableBox.classList.toggle("selected", selectedTableId === Number(blueprintTable.id));
    tableBox.classList.toggle("unavailable", !isAvailable);
    tableBox.disabled = !isAvailable;
    tableBox.setAttribute("aria-pressed", String(selectedTableId === Number(blueprintTable.id)));
    tableBox.title = isAvailable
      ? `Select ${realTable.table_name || realTable.name || `Table ${blueprintTable.id}`} with ${chairSource.length} seats`
      : `${realTable.table_name || realTable.name || `Table ${blueprintTable.id}`} is unavailable`;
    tableBox.innerHTML = `<span>${realTable.table_name || realTable.name || `Table ${blueprintTable.id}`}</span><small>${chairSource.length} seats</small>`;
    if (isAvailable) {
      tableBox.addEventListener("click", () => selectTable(blueprintTable, chairSource));
=======
    tableBox.dataset.tableId = realTableId;
    tableBox.classList.toggle("selected", selectedTableId === realTableId);
    tableBox.classList.toggle("unavailable", !isAvailable);
    tableBox.disabled = !isAvailable;
    tableBox.setAttribute("aria-pressed", String(selectedTableId === realTableId));
    tableBox.title = isAvailable
      ? `Select ${realTable.table_name || realTable.name || `Table ${realTableId}`} with ${chairSource.length} seats`
      : `${realTable.table_name || realTable.name || `Table ${realTableId}`} is unavailable`;
    const occupiedLabel = isAvailable ? "" : '<small class="table-status-label"><span aria-hidden="true">●</span> Occupied</small>';
    tableBox.innerHTML = `<span>${realTable.table_name || realTable.name || `Table ${realTableId}`}</span><small>${chairSource.length} seats</small>${occupiedLabel}`;
    if (isAvailable) {
      tableBox.addEventListener("click", () => selectTable(realTable, chairSource));
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    }

    tableGroup.appendChild(tableBox);

    chairSource.forEach((chair, index) => {
      const status = String(chair.status || "vacant").toLowerCase();

<<<<<<< HEAD
      const pos = getChairPosition(chairSource.length, index);
=======
      const pos = getChairPosition(chairSource.length, index, blueprintTable.shape);
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

      const chairEl = document.createElement("span");
      chairEl.type = "button";
      chairEl.className = `chair ${status}`;
<<<<<<< HEAD
      if (selectedTableId === Number(blueprintTable.id)) chairEl.classList.add("selected");
      chairEl.textContent = `C${index + 1}`;
      chairEl.style.left = `calc(50% + ${pos.x}px)`;
      chairEl.style.top = `calc(50% + ${pos.y}px)`;
      chairEl.title = `Table ${blueprintTable.id} - Chair ${index + 1}`;
      chairEl.dataset.tableId = blueprintTable.id;
      chairEl.setAttribute("aria-hidden", "true");
=======
      if (selectedTableId === realTableId) chairEl.classList.add("selected");
      chairEl.textContent = chair.chair_label || `C${index + 1}`;
      chairEl.style.left = `calc(50% + ${pos.x}px)`;
      chairEl.style.top = `calc(50% + ${pos.y}px)`;
      chairEl.title = `${realTable.table_name || `Table ${realTableId}`} - Chair ${chair.chair_label || index + 1}`;
      chairEl.dataset.tableId = realTableId;
      chairEl.setAttribute("aria-label", `${realTable.table_name || `Table ${realTableId}`}, chair ${chair.chair_label || index + 1}, ${status}`);
      chairEl.tabIndex = 0;
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

      tableGroup.appendChild(chairEl);
    });

    floorPlan.appendChild(tableGroup);
  });
<<<<<<< HEAD

  if (!tablesOnFloor.length) {
    floorPlan.innerHTML = `<p class="floor-empty-message">No tables are configured on Floor ${activeFloor} yet.</p>`;
  }
}

function selectTable(table, chairs) {
  selectedTableId = Number(table.id);
  selectedChairIds = chairs.map((chair) => chair.id);
  renderFloorPlan();
  updateChairSelectionUI();
}

function updateChairSelectionUI() {
  const selectedTable = restaurantBlueprint.tables.find(
    (table) => Number(table.id) === Number(selectedTableId)
  );
  const realTable = selectedTable && floorTables.find(
    (table) => Number(table.id ?? table.table_id) === Number(selectedTableId)
  );
  const selectedTableLabel = document.getElementById("selectedTableLabel");
  const lockButton = document.getElementById("lockChairsButton");

  if (selectedTableLabel) {
    selectedTableLabel.textContent = selectedTable
      ? `${realTable?.table_name || realTable?.name || `Table ${selectedTable.id}`} · ${selectedChairIds.length} seats`
      : "None";
  }
  if (lockButton) {
    lockButton.textContent = selectedTable
      ? `Reserve Table ${selectedTable.id} & continue`
      : "Select a table to continue";
    lockButton.disabled = !selectedTable;
  }
}

async function lockSelectedChairs() {
=======

  if (!renderedTables) {
    floorPlan.innerHTML = `<p class="floor-empty-message">No restaurant tables are configured on Floor ${activeFloor}. Add tables and chairs in the database, then reload this page.</p>`;
  }

  queueFloorPlanScaleUpdate();
}

function updateFloorPlanScale() {
  const wrapper = document.querySelector("#floorSection .floor-scroll-wrapper");
  const scaleContent = document.querySelector("#floorSection .floor-plan-scale-content");
  const floorPlan = document.getElementById("floorPlan");
  if (!wrapper || !scaleContent || !floorPlan) return;

  const zoomLevel = document.getElementById("floorPlanZoomLevel");
  const zoomOut = document.getElementById("floorPlanZoomOut");
  const zoomIn = document.getElementById("floorPlanZoomIn");

  if (window.innerWidth > 1024) {
    floorPlan.style.removeProperty("--floor-plan-scale");
    floorPlan.style.removeProperty("margin-left");
    scaleContent.style.removeProperty("width");
    scaleContent.style.removeProperty("height");
    wrapper.style.removeProperty("height");
    wrapper.style.removeProperty("overflow-x");
    wrapper.style.removeProperty("overflow-y");
    if (zoomLevel) zoomLevel.textContent = "Fit";
    if (zoomOut) zoomOut.disabled = true;
    if (zoomIn) zoomIn.disabled = false;
    return;
  }

  const availableWidth = wrapper.clientWidth;
  if (!availableWidth) return;

  const fitScale = Math.min(1, availableWidth / FLOOR_PLAN_DESIGN_WIDTH);
  const requestedZoomFactor = FLOOR_PLAN_ZOOM_LEVELS[floorPlanZoomIndex] || 1;
  const zoomFactor = Math.min(requestedZoomFactor, 1 / fitScale);
  const scale = fitScale * zoomFactor;
  const scaledWidth = FLOOR_PLAN_DESIGN_WIDTH * scale;
  const styles = window.getComputedStyle(wrapper);
  const verticalPadding =
    (Number.parseFloat(styles.paddingTop) || 0) +
    (Number.parseFloat(styles.paddingBottom) || 0);
  const scaledHeight = floorPlan.offsetHeight * scale;
  const maxVisibleHeight = Math.max(240, Math.min(560, window.innerHeight * 0.55));

  floorPlan.style.setProperty("--floor-plan-scale", String(scale));
  floorPlan.style.removeProperty("margin-left");
  scaleContent.style.width = `${scaledWidth}px`;
  scaleContent.style.height = `${scaledHeight}px`;
  wrapper.style.height = `${Math.min(scaledHeight + verticalPadding, maxVisibleHeight)}px`;
  wrapper.style.setProperty("overflow-x", scale > fitScale ? "auto" : "hidden", "important");
  wrapper.style.setProperty("overflow-y", "auto", "important");

  if (zoomLevel) {
    zoomLevel.textContent = floorPlanZoomIndex === 0
      ? "Fit"
      : `${Math.round(zoomFactor * 100)}%`;
  }
  if (zoomOut) zoomOut.disabled = floorPlanZoomIndex === 0;
  if (zoomIn) {
    zoomIn.disabled =
      scale >= 1 || floorPlanZoomIndex === FLOOR_PLAN_ZOOM_LEVELS.length - 1;
  }
}

function queueFloorPlanScaleUpdate() {
  if (floorPlanResizeFrame) cancelAnimationFrame(floorPlanResizeFrame);
  floorPlanResizeFrame = requestAnimationFrame(() => {
    floorPlanResizeFrame = 0;
    updateFloorPlanScale();
  });
}

function initializeFloorPlanScaling() {
  const wrapper = document.querySelector("#floorSection .floor-scroll-wrapper");
  if (!wrapper || floorPlanScalingAbortController) return;

  const setZoomIndex = (nextIndex) => {
    floorPlanZoomIndex = Math.max(
      0,
      Math.min(FLOOR_PLAN_ZOOM_LEVELS.length - 1, nextIndex)
    );
    queueFloorPlanScaleUpdate();
  };

  floorPlanScalingAbortController = new AbortController();
  const { signal } = floorPlanScalingAbortController;

  document.getElementById("floorPlanZoomOut")?.addEventListener("click", () => {
    setZoomIndex(floorPlanZoomIndex - 1);
  }, { signal });
  document.getElementById("floorPlanZoomIn")?.addEventListener("click", () => {
    setZoomIndex(floorPlanZoomIndex + 1);
  }, { signal });
  document.getElementById("floorPlanZoomFit")?.addEventListener("click", () => {
    setZoomIndex(0);
  }, { signal });

  if ("ResizeObserver" in window) {
    floorPlanResizeObserver = new ResizeObserver(queueFloorPlanScaleUpdate);
    floorPlanResizeObserver.observe(wrapper);
  } else {
    floorPlanFallbackResizeHandler = queueFloorPlanScaleUpdate;
    window.addEventListener("resize", floorPlanFallbackResizeHandler, {
      passive: true,
      signal
    });
  }

  window.addEventListener("pagehide", () => {
    floorPlanResizeObserver?.disconnect();
    floorPlanResizeObserver = null;
    floorPlanFallbackResizeHandler = null;
    floorPlanScalingAbortController?.abort();
    floorPlanScalingAbortController = null;
    if (floorPlanResizeFrame) {
      cancelAnimationFrame(floorPlanResizeFrame);
      floorPlanResizeFrame = 0;
    }
  }, { once: true });

  queueFloorPlanScaleUpdate();
}

function selectTable(table, chairs) {
  selectedTableId = Number(table.id);
  selectedChairIds = chairs.map((chair) => chair.id);
  renderFloorPlan();
  updateChairSelectionUI();
}

function updateChairSelectionUI() {
  const realTable = floorTables.find(
    (table) => Number(table.id ?? table.table_id) === Number(selectedTableId)
  );
  const selectedTableLabel = document.getElementById("selectedTableLabel");
  const lockButton = document.getElementById("lockChairsButton");
  const backButton = document.getElementById("chairSelectionBackButton");

  if (selectedTableLabel) {
    selectedTableLabel.textContent = realTable
      ? `${realTable.table_name || realTable.name || `Table ${selectedTableId}`} · ${selectedChairIds.length} seats`
      : "None";
  }
  if (lockButton) {
    lockButton.textContent = chairHoldInProgress
      ? "Reserving table..."
      : realTable
        ? orderType === "reservation"
          ? "Continue to Payment Method"
          : `Reserve ${realTable.table_name || realTable.name || `Table ${selectedTableId}`} & continue`
        : "Select a table to continue";
    lockButton.disabled = chairHoldInProgress || reservationContinueInProgress || !realTable;
  }
  if (backButton) backButton.disabled = chairHoldInProgress;
}

async function lockSelectedChairs() {
  if (chairHoldInProgress) return;

>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  if (!selectedTableId) {
    alert("Please select an available table.");
    return;
  }

  if (
    orderType === "dine_in" &&
    dineInHeldTableId === Number(selectedTableId)
  ) {
    showSection("menuSection", 3);
    await loadMenu();
    return;
  }

  chairHoldInProgress = true;
  updateChairSelectionUI();

  try {
    const lockedChairs = await request("/chairs/lock", {
      method: "POST",
<<<<<<< HEAD
      body: JSON.stringify({ tableId: selectedTableId })
    });
    selectedChairIds = lockedChairs.map((chair) => chair.id);
=======
      body: JSON.stringify({ tableId: selectedTableId, orderType })
    });
    selectedChairIds = lockedChairs.map((chair) => chair.id);
    if (orderType === "reservation") {
      await confirmReservationOnly();
      return;
    }

    dineInHeldTableId = Number(selectedTableId);
    showSection("menuSection", 3);
    await loadMenu();
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  } catch (error) {
    alert("Cannot reserve table: " + error.message);
    selectedTableId = null;
    selectedChairIds = [];
<<<<<<< HEAD
    updateChairSelectionUI();
    await loadFloorPlan();
    return;
=======
    await loadFloorPlan();
  } finally {
    chairHoldInProgress = false;
    updateChairSelectionUI();
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  }
}

function updateReservationPaymentSummary() {
  const selectedTable = floorTables.find(
    (table) => Number(table.id ?? table.table_id) === Number(selectedTableId)
  );
  const summary = {
    reservationPaymentCustomer: reservationDetails?.name || "—",
    reservationPaymentDateTime: reservationDetails
      ? `${reservationDetails.date} · ${reservationDetails.time}`
      : "—",
    reservationPaymentTable: selectedTable?.table_name || (selectedTableId ? `Table ${selectedTableId}` : "—"),
    reservationPaymentGuests: selectedChairIds.length || "—",
  };
  Object.entries(summary).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
}

async function confirmReservationOnly() {
  if (reservationSubmissionInProgress) return;
  if (!reservationDetails) {
    alert("Reservation details are missing.");
    return;
  }

  if (!selectedChairIds.length) {
    alert("Please select at least one chair.");
    return;
  }

  const selectedPayment = "GCash";
  const paymentReference = reservationDetails.paymentReference || "";
  const senderName = reservationDetails.senderName || "";
  if (selectedPayment === "GCash" && (!paymentReference || !senderName)) {
    alert("Enter both the GCash reference number and sender's name before submitting the reservation.");
    return;
  }

  const submitButton = selectedPayment === "GCash"
    ? document.getElementById("reservationProcessedButton")
    : document.getElementById("reservationCardProcessedButton");
  reservationSubmissionInProgress = true;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitButton.textContent = "Submitting reservation…";
  }

  try {
    const reservation = await request("/reservations", {
      method: "POST",
      body: JSON.stringify({
        chairIds: selectedChairIds,
        reservation_date: reservationDetails.date,
        reservation_time: reservationDetails.time,
        customer_name: reservationDetails.name,
        contact_number: reservationDetails.contact,
        contact_country: reservationDetails.contactCountry,
        num_guests: selectedChairIds.length,
        payment_method: selectedPayment,
        gcash_reference: selectedPayment === "GCash" ? paymentReference : null,
        gcash_sender_name: selectedPayment === "GCash" ? senderName : null
      })
    });

    showSection("receiptSection", 5);

    const receiptTitle = document.getElementById("receiptTitle");
    if (receiptTitle) {
      receiptTitle.textContent = "Reservation Submitted";
    }

    const receiptIntro = document.getElementById("receiptIntro");
    if (receiptIntro) {
      receiptIntro.textContent = "Your payment information has been submitted successfully. Your reservation is currently waiting for administrator verification. Please wait while we verify your payment.";
    }

    const qrBox = document.querySelector(".receipt-qr-box");
    if (qrBox) {
      qrBox.style.display = "none";
    }

    const thankYouMessage = document.getElementById("thankYouMessage");
    if (thankYouMessage) {
      thankYouMessage.textContent = "";
    }
    if (reservation.reservation_token) {
      localStorage.setItem("dineariReservationStatusToken", reservation.reservation_token);
    }
    updateCustomerNavigation();
    document.getElementById("receiptSection")?.classList.add("reservation-completion-mode");
    document.getElementById("reservationCompletionPanel").hidden = false;
    document.getElementById("reservationStatusPanel").hidden = true;
    document.getElementById("receiptIntro").hidden = true;
    document.querySelector("#receiptSection > .section-kicker").hidden = true;
    document.getElementById("receiptTitle").hidden = true;
    document.querySelector("#receiptSection > .receipt-actions").hidden = true;
    updateReceiptSummary({
      orderNumber: reservation.reservation_code || reservation.id || "Reservation submitted",
      table: floorTables.find((table) => Number(table.id ?? table.table_id) === Number(selectedTableId))?.table_name || `Table ${selectedTableId}`,
      paymentMethod: selectedPayment
    });
    reservationCompletionRedirectTimer = setTimeout(() => {
      window.location.assign("choice.html");
    }, 4500);
    void refreshCustomerNotifications();
  } catch (error) {
    alert("Cannot create reservation: " + error.message);
  } finally {
    reservationSubmissionInProgress = false;
    if (submitButton) {
      submitButton.removeAttribute("aria-busy");
      if (!chairHoldInProgress) updateChairSelectionUI();
    }
  }
}

async function processReservationPayment(event) {
  event?.preventDefault();
  if (orderType !== "reservation" || chairHoldInProgress || reservationSubmissionInProgress) return;

  const selectedPayment = "GCash";
  const referenceInput = document.getElementById("reservationGcashReference");
  const senderInput = document.getElementById("reservationGcashSenderName");
  const reference = referenceInput?.value.trim() || "";
  const senderName = senderInput?.value.trim() || "";
  const referenceError = document.getElementById("reservationGcashReferenceError");
  const senderError = document.getElementById("reservationGcashSenderNameError");
  const referenceValid = Boolean(reference);
  const senderValid = Boolean(senderName);

  if (referenceError) {
    referenceError.textContent = referenceValid ? "" : "Enter the GCash reference number.";
    referenceError.hidden = referenceValid;
  }
  if (senderError) {
    senderError.textContent = senderValid ? "" : "Enter the sender's name.";
    senderError.hidden = senderValid;
  }
  referenceInput?.setAttribute("aria-invalid", String(!referenceValid));
  senderInput?.setAttribute("aria-invalid", String(!senderValid));
  if (!referenceValid || !senderValid) {
    (referenceValid ? senderInput : referenceInput)?.focus();
    return;
  }

  reservationDetails.paymentMethod = selectedPayment;
  reservationDetails.paymentReference = reference;
  reservationDetails.senderName = senderName;
  const processedButton = document.getElementById("reservationProcessedButton");
  if (processedButton) {
    processedButton.disabled = true;
    processedButton.setAttribute("aria-busy", "true");
  }
  try {
    await lockSelectedChairs();
  } finally {
    if (processedButton) {
      processedButton.disabled = false;
      processedButton.removeAttribute("aria-busy");
    }
  }
}

function renderReservationStatus(reservation) {
  const panel = document.getElementById("reservationStatusPanel");
  const statusText = document.getElementById("reservationStatusText");
  const rejectionReason = document.getElementById("reservationRejectionReason");
  const pendingMessage = document.getElementById("reservationPendingMessage");
  const paymentStatusMessage = document.getElementById("reservationPaymentStatusMessage");
  const qrReceipt = document.getElementById("reservationQrReceipt");
  const resubmitForm = document.getElementById("reservationResubmitForm");
  if (!panel || !statusText || !rejectionReason) return;

  const status = String(reservation.status || "").toLowerCase();
  const labels = {
    pending_verification: "Pending Confirmation",
    confirmed: "Confirmed",
    verified: "Confirmed",
    active: "Checked In",
    completed: "Completed",
    rejected: "Rejected",
  };
  statusText.textContent = labels[status] || "Pending Confirmation";
  statusText.classList.toggle("is-rejected", status === "rejected");
  statusText.classList.toggle("is-confirmed", ["confirmed", "verified", "active", "completed"].includes(status));
  panel.hidden = false;
  if (status === "rejected" && reservation.reservation_rejection_reason) {
    rejectionReason.textContent = `Reason: ${reservation.reservation_rejection_reason}`;
    rejectionReason.hidden = false;
  } else {
    rejectionReason.textContent = "";
    rejectionReason.hidden = true;
  }
  if (pendingMessage) pendingMessage.hidden = status !== "pending_verification";
  if (paymentStatusMessage) {
    const paymentStatus = String(reservation.payment_status || "").toLowerCase();
    paymentStatusMessage.textContent = status === "rejected"
      ? "Your payment was rejected. Please review the administrator's reason and follow the instructions provided."
      : status === "active"
        ? "Your arrival has been confirmed. We look forward to serving you."
      : paymentStatus === "paid"
        ? "Your payment has been verified! Your reservation is confirmed."
        : "Your payment is currently being reviewed by our administrator.";
    paymentStatusMessage.hidden = status !== "pending_verification" && status !== "rejected" && paymentStatus !== "paid";
  }
  const canShowQrReceipt =
    ["confirmed", "verified", "active", "completed"].includes(status) &&
    String(reservation.payment_status || "").toLowerCase() === "paid" &&
    Boolean(reservation.qr_code);
  if (qrReceipt) qrReceipt.hidden = !canShowQrReceipt;
  const qrImage = document.getElementById("reservationQrReceiptImage");
  if (qrImage) {
    if (canShowQrReceipt) qrImage.src = reservation.qr_code;
    else qrImage.removeAttribute("src");
  }
  if (canShowQrReceipt) {
    const receiptValues = {
      reservationReceiptCustomer: reservation.customer_name,
      reservationReceiptContact: reservation.contact_number,
      reservationReceiptTable: reservation.table_name,
      reservationReceiptDate: reservation.reservation_date,
      reservationReceiptTime: reservation.reservation_time,
      reservationReceiptGuests: reservation.num_guests,
      reservationReceiptPaymentStatus: "PAID",
      reservationReceiptStatus: status === "active" ? "CHECKED IN" : "CONFIRMED",
      reservationReceiptArrivalTime: reservation.arrived_at
        ? new Date(reservation.arrived_at).toLocaleString()
        : "Not checked in",
    };
    Object.entries(receiptValues).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value ?? "N/A";
    });
  }
  if (resubmitForm) resubmitForm.hidden = status !== "rejected";
}

function startReservationStatusUpdates(token) {
  reservationStatusToken = token;
  if (reservationStatusPollTimer) clearInterval(reservationStatusPollTimer);
  const refresh = async () => {
    try {
      const reservation = await request(`/reservations/status/${encodeURIComponent(token)}`);
      renderReservationStatus(reservation);
      if (["active", "completed", "rejected", "cancelled", "canceled"].includes(String(reservation.status).toLowerCase())) {
        void refreshCustomerNotifications();
        clearInterval(reservationStatusPollTimer);
        reservationStatusPollTimer = null;
      }
    } catch (error) {
      console.error("Could not refresh reservation status:", error.message);
    }
  };
  void refresh();
  reservationStatusPollTimer = setInterval(refresh, 10000);
}

async function resubmitReservationPayment(event) {
  event?.preventDefault();
  const token = reservationStatusToken || localStorage.getItem("dineariReservationStatusToken");
  const referenceInput = document.getElementById("reservationResubmitReference");
  const senderInput = document.getElementById("reservationResubmitSenderName");
  const error = document.getElementById("reservationResubmitError");
  const submitButton = document.getElementById("reservationResubmitButton");
  const reference = referenceInput?.value.trim() || "";
  const senderName = senderInput?.value.trim() || "";
  if (!reference || !senderName) {
    if (error) {
      error.textContent = "Enter both the GCash reference number and sender's name.";
      error.hidden = false;
    }
    (!reference ? referenceInput : senderInput)?.focus();
    return;
  }
  if (!token) {
    if (error) {
      error.textContent = "This reservation cannot be identified. Start a new reservation.";
      error.hidden = false;
    }
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
  }
  if (error) error.hidden = true;
  try {
    const reservation = await request(`/reservations/status/${encodeURIComponent(token)}/payment`, {
      method: "PATCH",
      body: JSON.stringify({
        gcash_reference: reference,
        gcash_sender_name: senderName,
      }),
    });
    referenceInput.value = "";
    senderInput.value = "";
    renderReservationStatus(reservation);
    startReservationStatusUpdates(token);
    void refreshCustomerNotifications();
  } catch (requestError) {
    if (error) {
      error.textContent = requestError.message || "Payment details could not be resubmitted.";
      error.hidden = false;
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
    }
  }
}

async function restoreReservationStatus() {
  const token = localStorage.getItem("dineariReservationStatusToken");
  if (!token) return;
  reservationStatusToken = token;
  try {
    const reservation = await request(`/reservations/status/${encodeURIComponent(token)}`);
    showSection("receiptSection", 5);
    document.getElementById("receiptTitle").textContent = "Reservation Status";
    document.getElementById("receiptIntro").textContent = "Your latest reservation status is shown below.";
    const qrBox = document.querySelector(".receipt-qr-box");
    if (qrBox) qrBox.style.display = "none";
    updateReceiptSummary({
      orderNumber: reservation.reservation_code || "Reservation",
      table: reservation.table_name || "See reservation details",
      paymentMethod: reservation.payment_method || "—",
    });
    renderReservationStatus(reservation);
    startReservationStatusUpdates(token);
  } catch (error) {
    localStorage.removeItem("dineariReservationStatusToken");
    updateCustomerNavigation();
    console.error("Could not restore reservation status:", error.message);
  }
}

function setCustomerAccountMenuOpen(isOpen) {
  const menu = document.getElementById("customerAccountMenu");
  const button = document.getElementById("customerAccountButton");
  if (!menu || !button) return;
  if (customerAccountMenuCloseTimer) {
    clearTimeout(customerAccountMenuCloseTimer);
    customerAccountMenuCloseTimer = null;
  }
  button.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    menu.hidden = false;
    menu.getBoundingClientRect();
    menu.classList.add("is-open");
  } else {
    menu.classList.remove("is-open");
    customerAccountMenuCloseTimer = setTimeout(() => {
      menu.hidden = true;
      customerAccountMenuCloseTimer = null;
    }, 170);
  }
}

function setCustomerAuthMenuOpen(isOpen) {
  const menu = document.getElementById("customerAuthMenu");
  const button = document.getElementById("customerAuthMenuButton");
  if (!menu || !button) return;
  if (customerAuthMenuCloseTimer) {
    clearTimeout(customerAuthMenuCloseTimer);
    customerAuthMenuCloseTimer = null;
  }
  button.setAttribute("aria-expanded", String(isOpen));
  button.setAttribute(
    "aria-label",
    isOpen ? "Close authentication menu" : "Open authentication menu"
  );
  if (isOpen) {
    menu.hidden = false;
    menu.getBoundingClientRect();
    menu.classList.add("is-open");
  } else {
    menu.classList.remove("is-open");
    customerAuthMenuCloseTimer = setTimeout(() => {
      menu.hidden = true;
      customerAuthMenuCloseTimer = null;
    }, 190);
  }
}

function setCustomerAccountView(view) {
  const views = {
    profile: ["customerProfileView", "My Profile"],
    notifications: ["customerNotificationsView", "Notifications"],
    reservation: ["customerReservationView", "Reservation details"],
    settings: ["customerSettingsView", "Account Settings"],
  };
  const selected = views[view];
  if (!selected) return;

  document.getElementById("customerAccountDialogTitle").textContent = selected[1];
  Object.entries(views).forEach(([name, [id]]) => {
    document.getElementById(id).hidden = name !== view;
  });
  document.querySelectorAll(".customer-account-nav-item").forEach((item) => {
    const isActive = item.dataset.customerView === view ||
      (view === "reservation" && item.dataset.customerView === "notifications");
    item.classList.toggle("is-active", isActive);
    if (isActive) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  setCustomerAccountMenuOpen(false);
  const dialog = document.getElementById("customerAccountDialog");
  dialog.classList.toggle("has-notifications-view", view === "notifications");
  if (!dialog.open) dialog.showModal();

  if (view === "profile") void loadCustomerProfile();
  else void loadCustomerAccountIdentity();
  if (view === "notifications") void loadCustomerNotifications();
  if (view === "settings") void loadCustomerSettings();
  syncLucideIcons();
}

function updateCustomerAccountIdentity(profile) {
  const name = document.getElementById("customerAccountDisplayName");
  const email = document.getElementById("customerAccountDisplayEmail");
  if (name) name.textContent = profile.full_name || profile.fullName || "—";
  if (email) {
    email.textContent = profile.email || "";
    email.hidden = !profile.email;
  }
}

async function loadCustomerAccountIdentity() {
  const cachedUser = typeof getUser === "function" ? getUser() : {};
  updateCustomerAccountIdentity(cachedUser);
  try {
    const profile = await request("/customers/profile");
    updateCustomerAccountIdentity(profile);
  } catch (requestError) {
    console.error("Could not load customer account identity:", requestError.message);
  }
}

async function loadCustomerProfile() {
  const error = document.getElementById("customerProfileError");
  error.hidden = true;
  try {
    const profile = await request("/customers/profile");
    updateCustomerAccountIdentity(profile);
    document.getElementById("customerProfileName").textContent = profile.full_name || "—";
    document.getElementById("customerProfileEmail").textContent = profile.email || "—";
    document.getElementById("customerProfileContact").textContent = profile.contact_number || "—";
  } catch (requestError) {
    error.textContent = requestError.message || "Your profile could not be loaded.";
    error.hidden = false;
  }
}

async function loadCustomerSettings() {
  const message = document.getElementById("customerSettingsMessage");
  const themeInput = document.getElementById("customerPreferredTheme");
  message.hidden = true;
  try {
    const profile = await request("/customers/profile");
    themeInput.value = profile.preferred_theme || document.documentElement.dataset.theme || "light";
  } catch (requestError) {
    message.textContent = requestError.message || "Settings could not be loaded.";
    message.hidden = false;
  }
}

async function saveCustomerSettings(event) {
  event.preventDefault();
  const theme = document.getElementById("customerPreferredTheme").value;
  const message = document.getElementById("customerSettingsMessage");
  message.hidden = true;
  try {
    await request("/customers/settings", {
      method: "PATCH",
      body: JSON.stringify({ preferred_theme: theme }),
    });
    window.setTheme(theme);
    message.textContent = "Your appearance settings have been saved.";
    message.hidden = false;
  } catch (requestError) {
    message.textContent = requestError.message || "Settings could not be saved.";
    message.hidden = false;
  }
}

function updateCustomerNotificationCounts(unreadCount) {
  const parsedCount = Number(unreadCount);
  const count = Number.isSafeInteger(parsedCount) && parsedCount > 0 ? parsedCount : 0;
  customerUnreadNotificationCount = count;
  const displayCount = count > 99 ? "99+" : String(count);
  const accountBadge = document.getElementById("customerAccountUnreadCount");
  const menuCount = document.getElementById("customerMenuUnreadCount");
  const dialogCount = document.getElementById("customerDialogUnreadCount");
  const accountButton = document.getElementById("customerAccountButton");
  if (accountBadge) {
    accountBadge.textContent = displayCount;
    accountBadge.hidden = count === 0;
  }
  if (menuCount) {
    menuCount.textContent = displayCount;
    menuCount.hidden = count === 0;
  }
  if (dialogCount) {
    dialogCount.textContent = displayCount;
    dialogCount.hidden = count === 0;
  }
  if (accountButton) {
    accountButton.setAttribute(
      "aria-label",
      count === 0
        ? "Open user profile menu"
        : `Open user profile menu, ${count} unread notification${count === 1 ? "" : "s"}`
    );
  }
  syncCustomerMarkAllReadButton();
}

function syncCustomerMarkAllReadButton() {
  const button = document.getElementById("customerMarkAllNotificationsRead");
  if (button) {
    button.disabled =
      customerUnreadNotificationCount === 0 ||
      customerMarkAllNotificationsInFlight ||
      customerNotificationRequestsInFlight.size > 0;
  }
}

function setCustomerNotificationMenuOpen(item, isOpen) {
  const trigger = item.querySelector(".customer-notification-menu-trigger");
  const menu = document.getElementById(trigger?.getAttribute("aria-controls"));
  if (!trigger || !menu) return;
  const menuWrap = trigger.closest(".customer-notification-menu-wrap");
  if (!menuWrap) return;
  const dialog = document.getElementById("customerAccountDialog");
  menuWrap.classList.toggle("is-open", isOpen);
  trigger.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    dialog.classList.add("has-notification-menu");
    dialog.append(menu);
    menu.hidden = false;
    menu.classList.add("is-portal");
    positionCustomerNotificationMenu(trigger, menu);
  } else {
    dialog.classList.remove("has-notification-menu");
    menu.hidden = true;
    menu.classList.remove("is-portal");
    menu.removeAttribute("style");
    menuWrap.append(menu);
  }
}

function positionCustomerNotificationMenu(trigger, menu) {
  const dialog = document.getElementById("customerAccountDialog");
  const dialogRect = dialog.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();
  const gutter = 8;
  const gap = 6;
  const width = Math.min(224, dialogRect.width - gutter * 2);
  menu.style.width = `${width}px`;

  const left = Math.max(
    dialogRect.left + gutter,
    Math.min(triggerRect.right - width, dialogRect.right - width - gutter)
  );
  const menuHeight = menu.getBoundingClientRect().height;
  const belowTop = triggerRect.bottom + gap;
  const belowAvailable = dialogRect.bottom - gutter - belowTop;
  const aboveAvailable = triggerRect.top - gap - (dialogRect.top + gutter);
  const openBelow = belowAvailable >= menuHeight || belowAvailable >= aboveAvailable;
  const top = openBelow
    ? Math.min(belowTop, dialogRect.bottom - menuHeight - gutter)
    : Math.max(dialogRect.top + gutter, triggerRect.top - menuHeight - gap);

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function closeCustomerNotificationMenus(restoreFocus = false) {
  document.querySelectorAll('.customer-notification-menu-trigger[aria-expanded="true"]').forEach((trigger) => {
    const item = trigger.closest(".customer-notification-menu-wrap");
    setCustomerNotificationMenuOpen(item, false);
    if (restoreFocus) trigger?.focus();
  });
}

async function refreshCustomerNotifications() {
  const user = typeof getUser === "function" ? getUser() : {};
  const token = localStorage.getItem("token");
  if (user.role !== "customer" || !token) return;
  if (customerNotificationRefreshPromise) return customerNotificationRefreshPromise;
  const mutationVersion = customerNotificationMutationVersion;
  customerNotificationRefreshPromise = (async () => {
    try {
      const result = await request("/customers/notifications");
      const currentUser = typeof getUser === "function" ? getUser() : {};
      if (
        localStorage.getItem("token") === token &&
        currentUser.role === "customer" &&
        mutationVersion === customerNotificationMutationVersion
      ) {
        updateCustomerNotificationCounts(result.unreadCount);
      }
    } catch (error) {
      console.error("Could not refresh customer notifications:", error.message);
    } finally {
      customerNotificationRefreshPromise = null;
    }
  })();
  return customerNotificationRefreshPromise;
}

function renderCustomerNotifications(notifications) {
  closeCustomerNotificationMenus();
  const list = document.getElementById("customerNotificationsList");
  const empty = document.getElementById("customerNotificationsEmpty");
  list.replaceChildren();
  empty.hidden = notifications.length > 0;
  const createActionButton = (label, iconName, styleClass, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `customer-notification-action-button ${styleClass}`;
    const icon = document.createElement("i");
    icon.dataset.lucide = iconName;
    icon.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = label;
    button.append(icon, text);
    button.addEventListener("click", onClick);
    return button;
  };
  notifications.forEach((notification) => {
    const item = document.createElement("li");
    item.className = notification.read_at ? "customer-notification is-read" : "customer-notification";
    const content = document.createElement("div");
    content.className = "customer-notification-content";
    const heading = document.createElement("strong");
    heading.textContent = notification.title;
    const message = document.createElement("p");
    message.textContent = notification.message;
    const date = document.createElement("time");
    date.dateTime = notification.created_at;
    date.textContent = new Date(notification.created_at).toLocaleString();
    content.append(heading, message, date);
    item.append(content);
    const menuWrap = document.createElement("div");
    menuWrap.className = "customer-notification-menu-wrap";
    const menuId = `customer-notification-menu-${notification.id}`;
    const menuTrigger = document.createElement("button");
    menuTrigger.type = "button";
    menuTrigger.className = "customer-notification-menu-trigger";
    menuTrigger.setAttribute("aria-label", `Actions for ${notification.title}`);
    menuTrigger.setAttribute("aria-haspopup", "menu");
    menuTrigger.setAttribute("aria-expanded", "false");
    menuTrigger.setAttribute("aria-controls", menuId);
    const moreIcon = document.createElement("i");
    moreIcon.dataset.lucide = "ellipsis-vertical";
    moreIcon.setAttribute("aria-hidden", "true");
    menuTrigger.append(moreIcon);
    const menu = document.createElement("div");
    menu.id = menuId;
    menu.className = "customer-notification-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", `Actions for ${notification.title}`);
    menu.hidden = true;
    const createMenuAction = (label, iconName, isDestructive, onClick) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = isDestructive
        ? "customer-notification-menu-action is-destructive"
        : "customer-notification-menu-action";
      button.setAttribute("role", "menuitem");
      const icon = document.createElement("i");
      icon.dataset.lucide = iconName;
      icon.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.textContent = label;
      button.append(icon, text);
      button.addEventListener("click", () => {
        closeCustomerNotificationMenus();
        void onClick();
      });
      return button;
    };
    menu.append(createMenuAction(
      notification.read_at ? "Mark as Unread" : "Mark as Read",
      notification.read_at ? "mail-open" : "check",
      false,
      () => markCustomerNotificationRead(notification.id, !notification.read_at)
    ));
    menu.append(createMenuAction(
      "Delete this notification",
      "trash-2",
      true,
      () => deleteCustomerNotification(notification.id)
    ));
    menuTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const shouldOpen = menu.hidden;
      closeCustomerNotificationMenus();
      if (shouldOpen) {
        setCustomerNotificationMenuOpen(item, true);
      }
    });
    menuWrap.append(menuTrigger, menu);
    item.append(menuWrap);
    const actions = document.createElement("div");
    actions.className = "customer-notification-actions";
    if (notification.reservation_id) {
      actions.append(createActionButton(
        "View reservation",
        "eye",
        "is-secondary",
        () => void openCustomerReservation(notification)
      ));
    }
    if (notification.order_id) {
      actions.append(createActionButton(
        "View Dine-in order",
        "eye",
        "is-secondary",
        () => void openCustomerDineInOrder(notification.order_id)
      ));
    }
    if (!notification.read_at) {
      actions.append(createActionButton(
        "Mark as Read",
        "check",
        "is-primary",
        () => void markCustomerNotificationRead(notification.id)
      ));
    }
    if (actions.childElementCount) item.append(actions);
    list.append(item);
  });
  syncLucideIcons();
}

async function openCustomerReservation(notification) {
  const error = document.getElementById("customerReservationError");
  error.hidden = true;
  const views = ["customerProfileView", "customerNotificationsView", "customerSettingsView", "customerReservationView"];
  views.forEach((id) => {
    document.getElementById(id).hidden = id !== "customerReservationView";
  });
  document.getElementById("customerAccountDialogTitle").textContent = "Reservation details";
  document.getElementById("customerAccountDialog").classList.remove("has-notifications-view");
  document.querySelectorAll(".customer-account-nav-item").forEach((item) => {
    const isActive = item.dataset.customerView === "notifications";
    item.classList.toggle("is-active", isActive);
    if (isActive) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  customerReservationToken = notification.metadata?.reservation_token || null;

  try {
    const reservation = await request(
      `/customers/reservations/${encodeURIComponent(notification.reservation_id)}`
    );
    const values = {
      customerReservationCode: reservation.reservation_code || "—",
      customerReservationName: reservation.customer_name || "—",
      customerReservationContact: reservation.contact_number || "—",
      customerReservationTable: reservation.table_name || "—",
      customerReservationDateTime: `${reservation.reservation_date || "—"} · ${reservation.reservation_time || "—"}`,
      customerReservationGuests: reservation.num_guests || "—",
      customerReservationPaymentMethod: reservation.payment_method || "—",
      customerReservationGcashReference: reservation.gcash_reference || "—",
      customerReservationPaymentStatus: String(reservation.payment_status || "pending").replaceAll("_", " ").toUpperCase(),
      customerReservationStatus: String(reservation.status || "pending").toLowerCase() === "active"
        ? "CHECKED IN"
        : String(reservation.status || "pending").replaceAll("_", " ").toUpperCase(),
      customerReservationArrivalTime: reservation.arrived_at
        ? new Date(reservation.arrived_at).toLocaleString()
        : "Not checked in",
    };
    Object.entries(values).forEach(([id, value]) => {
      document.getElementById(id).textContent = value;
    });
    const reason = document.getElementById("customerReservationRejectionReason");
    reason.textContent = reservation.reservation_rejection_reason
      ? `Rejection reason: ${reservation.reservation_rejection_reason}`
      : "";
    reason.hidden = !reservation.reservation_rejection_reason;

    const receiptIsAvailable =
      ["confirmed", "verified", "active", "completed"].includes(String(reservation.status).toLowerCase()) &&
      String(reservation.payment_status).toLowerCase() === "paid" &&
      Boolean(reservation.qr_code);
    const qr = document.getElementById("customerReservationQr");
    qr.hidden = !receiptIsAvailable;
    if (receiptIsAvailable) qr.src = reservation.qr_code;
    else qr.removeAttribute("src");
    document.getElementById("customerReservationQrMessage").hidden =
      receiptIsAvailable || ["rejected"].includes(String(reservation.status).toLowerCase());

    const correctionButton = document.getElementById("customerReservationCorrectionButton");
    correctionButton.hidden =
      String(reservation.status).toLowerCase() !== "rejected" || !customerReservationToken;
  } catch (requestError) {
    error.textContent = requestError.message || "Reservation details could not be loaded.";
    error.hidden = false;
  }
}

async function loadCustomerNotifications() {
  const error = document.getElementById("customerNotificationsError");
  error.hidden = true;
  const mutationVersion = customerNotificationMutationVersion;
  try {
    const result = await request("/customers/notifications");
    if (mutationVersion !== customerNotificationMutationVersion) return;
    renderCustomerNotifications(result.notifications || []);
    updateCustomerNotificationCounts(result.unreadCount);
  } catch (requestError) {
    if (mutationVersion !== customerNotificationMutationVersion) return;
    error.textContent = requestError.message || "Notifications could not be loaded.";
    error.hidden = false;
  }
}

async function markCustomerNotificationRead(notificationId, isRead = true) {
  const requestKey = String(notificationId);
  if (customerMarkAllNotificationsInFlight || customerNotificationRequestsInFlight.has(requestKey)) return;
  customerNotificationRequestsInFlight.add(requestKey);
  syncCustomerMarkAllReadButton();
  const error = document.getElementById("customerNotificationsError");
  error.hidden = true;
  try {
    await request(`/customers/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: "PATCH",
      body: JSON.stringify({ read: isRead }),
    });
    customerNotificationMutationVersion += 1;
    await loadCustomerNotifications();
  } catch (requestError) {
    error.textContent = requestError.message || "This notification could not be updated.";
    error.hidden = false;
  } finally {
    customerNotificationRequestsInFlight.delete(requestKey);
    syncCustomerMarkAllReadButton();
  }
}

async function markAllCustomerNotificationsRead() {
  if (
    customerMarkAllNotificationsInFlight ||
    customerNotificationRequestsInFlight.size > 0 ||
    customerUnreadNotificationCount === 0
  ) return;
  customerMarkAllNotificationsInFlight = true;
  syncCustomerMarkAllReadButton();
  const error = document.getElementById("customerNotificationsError");
  error.hidden = true;
  try {
    await request("/customers/notifications/read-all", { method: "PATCH" });
    customerNotificationMutationVersion += 1;
    await loadCustomerNotifications();
  } catch (requestError) {
    error.textContent = requestError.message || "Notifications could not be marked as read.";
    error.hidden = false;
  } finally {
    customerMarkAllNotificationsInFlight = false;
    syncCustomerMarkAllReadButton();
  }
}

async function deleteCustomerNotification(notificationId) {
  const requestKey = String(notificationId);
  if (customerMarkAllNotificationsInFlight || customerNotificationRequestsInFlight.has(requestKey)) return;
  customerNotificationRequestsInFlight.add(requestKey);
  syncCustomerMarkAllReadButton();
  try {
    const confirmed = await window.DineAriNotifications.confirm({
      type: "warning",
      title: "Delete this notification?",
      message: "This notification will be permanently removed from your account.",
      confirmLabel: "Delete notification",
      cancelLabel: "Keep notification",
      destructive: true,
    });
    if (!confirmed) return;
    const error = document.getElementById("customerNotificationsError");
    error.hidden = true;
    await request(`/customers/notifications/${encodeURIComponent(notificationId)}`, {
      method: "DELETE",
    });
    customerNotificationMutationVersion += 1;
    await loadCustomerNotifications();
  } catch (requestError) {
    const error = document.getElementById("customerNotificationsError");
    error.textContent = requestError.message || "This notification could not be deleted.";
    error.hidden = false;
  } finally {
    customerNotificationRequestsInFlight.delete(requestKey);
    syncCustomerMarkAllReadButton();
  }
}

async function loadMenu() {
  try {
    const data = await request("/menu");
    menuItems = Array.isArray(data) ? data : [];

    renderMenu(menuItems);
  } catch (error) {
    console.warn("Menu API failed:", error.message);

    menuItems = [];

    const menuGrid = document.getElementById("menuGrid");

    if (menuGrid) {
      menuGrid.innerHTML = `
        <div class="panel empty-menu">
          <h3>Menu cannot load</h3>
          <p>${error.message}</p>
          <p>Please check if your backend /api/menu route is running.</p>
        </div>
      `;
    }
  }
}

function getCategory(item) {
  return item.category || item.category_name || item.categoryName || "All";
}

function getItemName(item) {
  return item.item_name || item.name || "Menu Item";
}

function getItemDescription(item) {
  const description = String(item.description || "").trim();
  return description.startsWith("Fictional local-development sample;") ? "" : description;
}

function renderMenuCardActions(name, itemId, stock, cartLine) {
  if (stock <= 0) {
    return `<button class="out-of-stock danger" disabled>Sold Out</button>`;
  }

  if (!cartLine) {
    return `<button type="button" onclick="addToCart(${itemId})"><i data-lucide="plus" aria-hidden="true"></i> Add</button>`;
  }

  return `<div class="menu-quantity-control" aria-label="${name} quantity">
    <button type="button" aria-label="Remove one ${name}" onclick="changeQuantity(${itemId}, -1)"><i data-lucide="minus" aria-hidden="true"></i></button>
    <span aria-live="polite">${cartLine.quantity}</span>
    <button type="button" aria-label="Add one ${name}" onclick="changeQuantity(${itemId}, 1)"><i data-lucide="plus" aria-hidden="true"></i></button>
  </div>`;
}

function updateMenuCartControls() {
  const menuGrid = document.getElementById("menuGrid");
  if (!menuGrid) return;

  menuGrid.querySelectorAll(".menu-card").forEach((card) => {
    const itemId = Number(card.dataset.menuItemId);
    const item = menuItems.find((menuItem) => Number(menuItem.id ?? menuItem.item_id) === itemId);
    const actions = card.querySelector(".menu-card-actions");
    if (!item || !actions) return;

    const stock = Number(item.stock_count ?? item.stock ?? 99);
    const cartLine = cart.find((line) => Number(line.menu_item_id) === itemId);
    actions.innerHTML = renderMenuCardActions(getItemName(item), itemId, stock, cartLine);
  });
}

function renderMenu(items) {
  const menuGrid = document.getElementById("menuGrid");
  if (!menuGrid) return;

  const query = (document.getElementById("menuSearch")?.value || "").trim().toLowerCase();

  const filtered = items.filter((item) => {
    const name = getItemName(item).toLowerCase();
    const category = getCategory(item);
    const matchesCategory = activeCategory === "All" || category === activeCategory;
    const matchesSearch = !query || name.includes(query) || getItemDescription(item).toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  menuGrid.innerHTML = filtered.map((item, index) => {
    const name = getItemName(item);
<<<<<<< HEAD
    // Existing catalog images use local filename mappings; admin uploads use
    // backend-relative paths, so resolve those against the API server origin.
    const backendOrigin = `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname || "localhost"}:3000/`;
    const uploadedImageUrl = item.image_url
      ? new URL(item.image_url, backendOrigin).href
      : "";
    const imageUrl = foodImages[name] || uploadedImageUrl || "images/menu-images/default-food.png";
=======
    const fallbackImageUrl = foodImages[name] || "";
    const storedImageUrl = item.image_url || "";
    const staleLocalJpeg = /^\/?images\/menu-images\/.+\.jpe?g$/i.test(storedImageUrl);
    const selectedImageUrl = staleLocalJpeg && fallbackImageUrl
      ? fallbackImageUrl
      : storedImageUrl || fallbackImageUrl || "images/menu-images/default-food.png";
    const localPngImage = /^(\/?images\/menu-images\/[^?#]+)\.png([?#].*)?$/i.exec(selectedImageUrl);
    const imageUrl = localPngImage
      ? `${localPngImage[1]}.webp${localPngImage[2] || ""}`
      : selectedImageUrl;
    const imageFallbackUrl = localPngImage ? selectedImageUrl : fallbackImageUrl;
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    const stock = Number(item.stock_count ?? item.stock ?? 99);
    const price = Number(item.price || 0);
    const description = getItemDescription(item);
    const itemId = Number(item.id ?? item.item_id);
    const cartLine = cart.find((line) => Number(line.menu_item_id) === itemId);

    return `
      <div class="panel menu-card" data-menu-item-id="${itemId}" style="animation-delay:${index * 0.04}s">
        <div class="menu-image-wrapper">
          <img src="${imageUrl}" data-fallback-src="${imageFallbackUrl}" alt="${name}" width="960" height="640" loading="lazy" decoding="async" onerror="if(this.dataset.fallbackSrc && !this.src.endsWith(this.dataset.fallbackSrc)){this.src=this.dataset.fallbackSrc;this.dataset.fallbackSrc=''}else{this.hidden=true;this.parentElement.classList.add('image-fallback')}">
          <span class="menu-image-fallback" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none"><path d="M5 17h22c0 6-4.5 10-11 10S5 23 5 17Z" stroke="currentColor" stroke-width="1.7"/><path d="M8 13c1.4 1 2.8 1 4.2 0s2.8-1 4.2 0 2.8 1 4.2 0 2.8-1 4.2 0M16 5v4m-5-2 2 3m8-3-2 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          </span>
        </div>
        <h3>${name}</h3>
        ${description ? `<p>${description}</p>` : ""}
        <div class="price-stock">
          <strong>₱${price.toFixed(2)}</strong>
          <span class="stock">${stock > 0 ? `${stock} left` : "Sold Out"}</span>
        </div>
        <div class="menu-card-actions">${renderMenuCardActions(name, itemId, stock, cartLine)}</div>
      </div>
    `;
  }).join("") || `<div class="panel empty-menu" style="padding:24px;"><h3>No items found</h3><p>Try another search or category.</p></div>`;
  syncLucideIcons();
}

function filterMenuCategory(category, button) {
  activeCategory = category;

  document
    .querySelectorAll(".category-tabs button, .category-list button")
    .forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-selected", "false");
    });

  if (button) {
    button.classList.add("active");
    button.setAttribute("aria-selected", "true");
  }

  renderMenu(menuItems);
}

function filterMenuBySearch() {
  renderMenu(menuItems);
}

function addToCart(menuItemId) {
  const item = menuItems.find((menuItem) => Number(menuItem.id ?? menuItem.item_id) === Number(menuItemId));
  if (!item) return;

  const cartItem = cart.find((cartLine) => Number(cartLine.menu_item_id) === Number(menuItemId));
  if (cartItem) {
    cartItem.quantity += 1;
  } else {
    cart.push({
      menu_item_id: Number(menuItemId),
      item_name: getItemName(item),
      quantity: 1,
      price: Number(item.price)
    });
  }

  updateCartTotal();
  showCartToast(`${getItemName(item)} added to cart`);
}

function showCartToast(message) {
  window.DineAriNotifications?.show({
    type: "success",
    title: "Added to your order",
    description: message
  });
  const cartButton = document.getElementById("floatingCartButton");
  cartButton?.classList.remove("cart-bump");
  if (cartButton) {
    void cartButton.offsetWidth;
    cartButton.classList.add("cart-bump");
  }
}

function removeFromCart(menuItemId) {
  cart = cart.filter((line) => Number(line.menu_item_id) !== Number(menuItemId));
  updateCartTotal();
}

function changeQuantity(menuItemId, delta) {
  const cartItem = cart.find((line) => Number(line.menu_item_id) === Number(menuItemId));
  if (!cartItem) return;
  cartItem.quantity += delta;
  if (cartItem.quantity <= 0) removeFromCart(menuItemId);
  updateCartTotal();
}

function updateCartTotal() {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalEl = document.getElementById("cartTotal");
  if (totalEl) totalEl.textContent = total.toFixed(2);

  const cartCount = document.getElementById("floatingCartCount");
  if (cartCount) cartCount.textContent = itemCount > 99 ? "99+" : String(itemCount);

  const proceedButton = document.getElementById("cartProceedButton");
  if (proceedButton) proceedButton.disabled = cart.length === 0;

  const cartItems = document.getElementById("cartItems");
  if (!cartItems) return;

  cartItems.innerHTML = cart.length ? cart.map((line) => `
    <div class="cart-line">
      <div>
        <strong>${line.item_name}</strong><br>
        <small>₱${line.price.toFixed(2)} × ${line.quantity}</small>
      </div>
      <div class="cart-line-actions">
        <strong>₱${(line.price * line.quantity).toFixed(2)}</strong>
        <div class="cart-quantity-control">
          <button type="button" aria-label="Remove one ${line.item_name}" onclick="changeQuantity(${line.menu_item_id}, -1)"><i data-lucide="minus" aria-hidden="true"></i></button>
          <span aria-live="polite">${line.quantity}</span>
          <button type="button" aria-label="Add one ${line.item_name}" onclick="changeQuantity(${line.menu_item_id}, 1)"><i data-lucide="plus" aria-hidden="true"></i></button>
          <button type="button" class="danger remove-cart-item" aria-label="Remove ${line.item_name} from cart" onclick="removeFromCart(${line.menu_item_id})"><i data-lucide="trash-2" aria-hidden="true"></i></button>
        </div>
      </div>
    </div>
  `).join("") : `<div class="cart-empty-state"><strong>Your cart is empty</strong><span>Add a dish from the menu to get started.</span></div>`;
  updateMenuCartControls();
  syncLucideIcons();
}

function openCartDialog() {
  const dialog = document.getElementById("cartDialog");
  if (!dialog || dialog.open) return;
  dialog.showModal();
  document.getElementById("floatingCartButton")?.setAttribute("aria-expanded", "true");
}

function closeCartDialog() {
  const dialog = document.getElementById("cartDialog");
  if (dialog?.open) dialog.close();
  document.getElementById("floatingCartButton")?.setAttribute("aria-expanded", "false");
}

function closeCartDialogOnBackdrop(event) {
  if (event.target === event.currentTarget) closeCartDialog();
}

function openCartDialog() {
  const dialog = document.getElementById("cartDialog");
  if (!dialog || dialog.open) return;
  dialog.showModal();
  document.getElementById("floatingCartButton")?.setAttribute("aria-expanded", "true");
}

function closeCartDialog() {
  const dialog = document.getElementById("cartDialog");
  if (dialog?.open) dialog.close();
  document.getElementById("floatingCartButton")?.setAttribute("aria-expanded", "false");
}

function closeCartDialogOnBackdrop(event) {
  if (event.target === event.currentTarget) closeCartDialog();
}

function openPaymentPanel() {
  if (!cart.length) {
    alert("Please add at least one item before proceeding to payment.");
    return;
  }

  const paymentItems = document.getElementById("paymentItems");
  const paymentTotal = document.getElementById("paymentTotal");

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (paymentItems) {
    paymentItems.innerHTML = cart.map((item) => `
      <div class="payment-line">
        <div>
          <strong>${item.item_name || "Menu Item"}</strong>
          <small>₱${formatOrderAmount(item.price)} × ${item.quantity}</small>
        </div>
        <span>₱${formatOrderAmount(item.price * item.quantity)}</span>
      </div>
    `).join("");
  }

  if (paymentTotal) {
    paymentTotal.textContent = formatOrderAmount(total);
  }
  const paymentSubtotal = document.getElementById("paymentSubtotal");
  if (paymentSubtotal) paymentSubtotal.textContent = formatOrderAmount(total);
  const paymentOrderType = document.getElementById("paymentOrderType");
  if (paymentOrderType) paymentOrderType.textContent = orderType === "reservation" ? "Reservation" : orderType === "dine_in" ? "Dine-in" : "Takeout";
  const paymentTableNumber = document.getElementById("paymentTableNumber");
  if (paymentTableNumber) paymentTableNumber.textContent = selectedTableId
    ? floorTables.find((table) => Number(table.id ?? table.table_id) === Number(selectedTableId))?.table_name || `Table ${selectedTableId}`
    : "Takeout";

  const isDineIn = orderType === "dine_in";
  document.getElementById("dineInPaymentPanel").hidden = !isDineIn;
  document.getElementById("takeoutPaymentPanel").hidden = isDineIn;
  document.getElementById("dineInPaymentInstructions").hidden = !isDineIn;
  document.getElementById("dineInPaymentDisclaimer").hidden = !isDineIn;
  document.getElementById("paymentHeading").textContent = isDineIn
    ? "Online Payment"
    : "Choose Payment Method";
  document.getElementById("paymentHeadingDescription").textContent = isDineIn
    ? "Pay with GCash and submit your details for admin verification."
    : "Select how you want to pay for your order.";
  if (isDineIn) {
    const gcashOption = document.querySelector('input[name="paymentMethod"][value="GCash"]');
    if (gcashOption) gcashOption.checked = true;
  }

  closeCartDialog();
  showSection("paymentSection", 4);
}

function backToMenu() {
  showSection("menuSection", 3);
}

function backToSelectTable() {
  if (orderType !== "dine_in" || chairHoldInProgress) return;
  closeCartDialog();
  showSection("floorSection", 2);
  updateChairSelectionUI();
  queueFloorPlanScaleUpdate();
}

function selectPaymentCard(input) {
  document.querySelectorAll(".payment-method-card").forEach((card) => {
    card.classList.remove("active");
  });

  input.closest(".payment-method-card")?.classList.add("active");
}

<<<<<<< HEAD
function confirmPaymentAndOrder() {
  const selectedPayment =
    document.querySelector('input[name="paymentMethod"]:checked')?.value || "GCash";

  if (selectedPayment === "Cash") {
    alert("Cash payment is no longer available. Please choose GCash or Card.");
    return;
  }
=======
function validateDineInPaymentFields() {
  const referenceInput = document.getElementById("dineInGcashReference");
  const senderInput = document.getElementById("dineInGcashSenderName");
  const reference = referenceInput?.value.trim() || "";
  const senderName = senderInput?.value.trim() || "";
  const referenceError = document.getElementById("dineInGcashReferenceError");
  const senderError = document.getElementById("dineInGcashSenderNameError");
  const referenceValid = Boolean(reference) && reference.length <= 128;
  const senderValid = Boolean(senderName) && senderName.length <= 128;
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

  if (referenceError) {
    referenceError.textContent = referenceValid
      ? ""
      : reference ? "The reference number must be 128 characters or fewer." : "Enter the GCash reference number.";
    referenceError.hidden = referenceValid;
  }
  if (senderError) {
    senderError.textContent = senderValid
      ? ""
      : senderName ? "The sender's name must be 128 characters or fewer." : "Enter the sender's name.";
    senderError.hidden = senderValid;
  }
  referenceInput?.setAttribute("aria-invalid", String(!referenceValid));
  senderInput?.setAttribute("aria-invalid", String(!senderValid));
  if (!referenceValid || !senderValid) {
    (referenceValid ? senderInput : referenceInput)?.focus();
    return false;
  }
  return true;
}

function showDineInOrderPending(order) {
  activeDineInOrderId = Number(order.id);
  localStorage.setItem("dineariPendingDineInOrderId", String(activeDineInOrderId));
  document.getElementById("receiptTitle").textContent = "Dine-in Payment Status";
  document.getElementById("receiptIntro").hidden = true;
  document.querySelector(".receipt-qr-box").hidden = true;
  document.getElementById("reservationStatusPanel").hidden = true;
  document.getElementById("reservationCompletionPanel").hidden = true;
  document.getElementById("dineInOrderStatusPanel").hidden = false;
  document.getElementById("dineInOrderStatus").textContent = "Pending Verification";
  document.getElementById("dineInOrderMessage").textContent =
    "Thank you for choosing dine-in. Your payment request has been sent to the admin. Please wait for confirmation.";
  document.getElementById("dineInOrderRejectionReason").hidden = true;
  document.getElementById("dineInRefundStatus").hidden = true;
  document.getElementById("dineInCountdown").hidden = true;
  const confirmedQr = document.getElementById("dineInConfirmedQr");
  confirmedQr.hidden = true;
  confirmedQr.removeAttribute("src");
  document.getElementById("dineInVerifiedPayment").hidden = true;
  document.getElementById("thankYouMessage").textContent = "";
  updateReceiptSummary({
    orderNumber: order.order_code || order.id,
    table: order.table_name || (selectedTableId
      ? floorTables.find((table) => Number(table.id ?? table.table_id) === Number(selectedTableId))?.table_name || `Table ${selectedTableId}`
      : order.table_id ? `Table ${order.table_id}` : "Dine-in"),
    total: order.total_amount ?? cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    paymentMethod: order.payment_method || "GCash",
  });
  showSection("receiptSection", 5);
  startDineInOrderStatusPolling(activeDineInOrderId);
  void refreshDineInOrderStatus(activeDineInOrderId);
}

function renderDineInOrderStatus(order) {
  const panel = document.getElementById("dineInOrderStatusPanel");
  if (!panel) return;
  panel.hidden = false;
  document.getElementById("receiptTitle").textContent = "Dine-in Payment Status";
  document.getElementById("receiptIntro").hidden = true;
  document.querySelector(".receipt-qr-box").hidden = true;
  document.getElementById("reservationStatusPanel").hidden = true;
  document.getElementById("reservationCompletionPanel").hidden = true;
  const status = String(order.dine_in_status || order.payment_status || "").toLowerCase();
  const statusElement = document.getElementById("dineInOrderStatus");
  const message = document.getElementById("dineInOrderMessage");
  const arrivalTime = document.getElementById("dineInArrivalTime");
  const qr = document.getElementById("dineInConfirmedQr");
  const countdown = document.getElementById("dineInCountdown");
  const rejectionReason = document.getElementById("dineInOrderRejectionReason");
  const refundStatus = document.getElementById("dineInRefundStatus");
  const verifiedPayment = document.getElementById("dineInVerifiedPayment");
  const paymentIsVerified = order.payment_status === "paid" && Boolean(order.payment_verified_at);
  const qrCode = paymentIsVerified &&
    typeof order.qr_code === "string" &&
    /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(order.qr_code)
    ? order.qr_code
    : "";

  rejectionReason.hidden = true;
  refundStatus.hidden = true;
  qr.hidden = true;
  qr.removeAttribute("src");
  countdown.hidden = true;
  countdown.dataset.deadline = "";
  arrivalTime.hidden = true;
  verifiedPayment.hidden = !paymentIsVerified;
  if (paymentIsVerified) {
    document.getElementById("dineInVerifiedMethod").textContent = order.payment_method || "GCash";
    document.getElementById("dineInVerifiedReference").textContent = order.gcash_reference || "—";
    document.getElementById("dineInVerifiedSender").textContent = order.gcash_sender_name || "—";
    const confirmedAt = new Date(order.payment_verified_at);
    document.getElementById("dineInVerifiedAt").textContent = Number.isNaN(confirmedAt.getTime())
      ? "Unavailable"
      : confirmedAt.toLocaleString();
  }
  updateReceiptSummary({
    orderNumber: order.order_code || order.id,
    table: order.table_name || (order.table_id ? `Table ${order.table_id}` : "Dine-in"),
    total: order.total_amount,
    paymentMethod: order.payment_method || "GCash",
  });

  if (status === "pending_verification") {
    statusElement.textContent = "Pending Verification";
    message.textContent =
      "Thank you for choosing dine-in. Your payment request has been sent to the admin. Please wait for confirmation.";
    return;
  }
  if (status === "rejected" || order.payment_status === "rejected") {
    statusElement.textContent = "Payment Rejected";
    message.textContent = "Your GCash payment could not be verified. Please contact the restaurant for assistance.";
    rejectionReason.textContent = order.payment_rejection_reason || "";
    rejectionReason.hidden = !order.payment_rejection_reason;
    stopDineInOrderStatusPolling();
    return;
  }
  if (status === "expired") {
    statusElement.textContent = "Arrival Window Passed";
    message.textContent = "Your order is still valid. Show your QR code to staff to confirm your arrival; late arrival is accepted.";
    refundStatus.textContent = "Late — Need to Refund. A 50% refund will be due after staff confirms your late arrival.";
    refundStatus.hidden = false;
    qr.hidden = !qrCode;
    if (qrCode) qr.src = qrCode;
    return;
  }
  if (status === "arrived") {
    statusElement.textContent = "Customer Arrived";
    message.textContent = "Your arrival has been recorded. Your payment is confirmed.";
    const confirmedAt = order.arrived_at ? new Date(order.arrived_at) : null;
    arrivalTime.textContent = `Arrival confirmed: ${
      confirmedAt && !Number.isNaN(confirmedAt.getTime())
        ? confirmedAt.toLocaleString()
        : "time unavailable"
    }`;
    arrivalTime.hidden = false;
    if (order.refund_status === "pending" || order.refund_status === "completed") {
      refundStatus.textContent = order.refund_status === "completed"
        ? `50% refund: ₱${Number(order.refund_amount || 0).toFixed(2)}. Refund completed.`
        : `50% refund: ₱${Number(order.refund_amount || 0).toFixed(2)}. Refund pending manual processing.`;
      refundStatus.hidden = false;
    }
    qr.hidden = !qrCode;
    if (qrCode) qr.src = qrCode;
    stopDineInOrderStatusPolling();
    return;
  }
  if (!paymentIsVerified) {
    statusElement.textContent = "Payment Status Unavailable";
    message.textContent = "We could not verify the payment confirmation for this order. Please contact the restaurant before arriving.";
    stopDineInOrderStatusPolling();
    return;
  }

  statusElement.textContent = "Payment Confirmed";
  message.textContent = qrCode
    ? "Your payment is confirmed. Please arrive within 30 minutes. Your countdown started when the admin confirmed payment."
    : "Your payment is confirmed, but the QR receipt is unavailable. Please contact the restaurant for assistance.";
  qr.hidden = !qrCode;
  if (qrCode) qr.src = qrCode;
  if (status === "awaiting_arrival" && order.arrival_deadline_at) {
    const deadline = new Date(order.arrival_deadline_at);
    if (Number.isNaN(deadline.getTime())) return;
    countdown.dataset.deadline = order.arrival_deadline_at;
    countdown.hidden = false;
    updateDineInCountdown(order.arrival_deadline_at);
  }
}

function updateDineInCountdown(deadline) {
  const countdownValue = document.getElementById("dineInCountdownValue");
  if (!countdownValue) return;
  const remainingSeconds = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  countdownValue.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function refreshDineInOrderStatus(orderId) {
  try {
    const order = await request(`/orders/${encodeURIComponent(orderId)}/payment-status`);
    activeDineInOrderId = Number(order.id);
    renderDineInOrderStatus(order);
    return order;
  } catch (error) {
    console.error("Could not refresh Dine-in payment status:", error.message);
    document.getElementById("dineInOrderStatus").textContent = "Status Unavailable";
    document.getElementById("dineInOrderMessage").textContent =
      "The order status could not be refreshed. Check your connection and try again.";
    return null;
  }
}

function startDineInOrderStatusPolling(orderId) {
  activeDineInOrderId = Number(orderId);
  stopDineInOrderStatusPolling();
  dineInOrderStatusTimer = setInterval(() => {
    void refreshDineInOrderStatus(activeDineInOrderId);
  }, 5000);
  dineInCountdownTimer = setInterval(() => {
    const deadline = document.getElementById("dineInCountdown")?.dataset.deadline;
    if (deadline) updateDineInCountdown(deadline);
  }, 1000);
}

function stopDineInOrderStatusPolling() {
  if (dineInOrderStatusTimer) clearInterval(dineInOrderStatusTimer);
  if (dineInCountdownTimer) clearInterval(dineInCountdownTimer);
  dineInOrderStatusTimer = null;
  dineInCountdownTimer = null;
}

async function restoreDineInOrderStatus() {
  const orderId = Number(localStorage.getItem("dineariPendingDineInOrderId"));
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || getUser().role !== "customer") return;
  showSection("receiptSection", 5);
  document.getElementById("dineInOrderStatusPanel").hidden = false;
  startDineInOrderStatusPolling(orderId);
  await refreshDineInOrderStatus(orderId);
}

async function openCustomerDineInOrder(orderId) {
  localStorage.setItem("dineariPendingDineInOrderId", String(orderId));
  showSection("receiptSection", 5);
  document.getElementById("dineInOrderStatusPanel").hidden = false;
  startDineInOrderStatusPolling(orderId);
  await refreshDineInOrderStatus(orderId);
}

function formatOrderAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
}

function updateReceiptSummary({ orderNumber, table, total, paymentMethod } = {}) {
  const values = {
    receiptOrderNumber: orderNumber || "—",
    receiptTableNumber: table || "—",
    receiptTotal: total == null ? "—" : `₱${formatOrderAmount(total)}`,
    receiptPaymentMethod: paymentMethod || "—"
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
}

async function confirmPaymentAndOrder() {
  if (orderSubmissionInProgress || paymentConfirmationInProgress) return;
  const isDineIn = orderType === "dine_in";
  const selectedPayment = isDineIn
    ? "GCash"
    : document.querySelector('input[name="paymentMethod"]:checked')?.value || "GCash";

  if (selectedPayment === "Cash") {
    alert("Cash payment is no longer available. Please choose GCash or Card.");
    return;
  }

  if (isDineIn && !validateDineInPaymentFields()) return;

  const confirmButton = document.getElementById(
    isDineIn ? "confirmPaymentButton" : "takeoutConfirmPaymentButton"
  );
  paymentConfirmationInProgress = true;
  if (confirmButton) confirmButton.disabled = true;
  try {
    const confirmed = await window.DineAriNotifications.confirm({
      type: "warning",
      title: isDineIn ? "Submit GCash payment for verification?" : "Confirm your order?",
      message: isDineIn
        ? "Your payment details will be sent to the admin for verification. This does not confirm your payment."
        : `Payment Method: ${selectedPayment}\n\nAre you sure you want to place this order?`,
      confirmLabel: isDineIn ? "Submit for verification" : "Place order",
    });
    if (confirmed) {
      paymentConfirmationInProgress = false;
      await placeOrder();
    }
  } finally {
    paymentConfirmationInProgress = false;
    if (confirmButton) confirmButton.disabled = false;
  }
}

function downloadQrCode() {
  const qrImage = document.getElementById("qrImage");

  if (!qrImage || !qrImage.src) {
    alert("QR code is not available yet.");
    return;
  }

  const link = document.createElement("a");
  link.href = qrImage.src;
  link.download = "dinequeue-receipt-qr.png";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function placeOrder() {
  if (!cart.length) {
    alert("Please add at least one item.");
    return;
  }

  if (orderSubmissionInProgress) return;
  orderSubmissionInProgress = true;
  const isDineIn = orderType === "dine_in";
  const confirmButton = document.getElementById(
    isDineIn ? "confirmPaymentButton" : "takeoutConfirmPaymentButton"
  );
  const originalButtonText = confirmButton?.textContent;
  if (confirmButton) {
    confirmButton.disabled = true;
    confirmButton.setAttribute("aria-busy", "true");
    confirmButton.textContent = "Placing order…";
  }

  const selectedPayment = isDineIn
    ? "GCash"
    : document.querySelector('input[name="paymentMethod"]:checked')?.value || "Cash";

<<<<<<< HEAD
  // Gigamit nato ang anonymous async function module aron ma-process ang await nga walay error 🌟
  (async () => {
    try {
      order = await request("/orders", {
=======
  try {
      const order = await request("/orders", {
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
        method: "POST",
        body: JSON.stringify({
          type: orderType || (selectedChairIds.length ? "dine_in" : null),
          chairIds: selectedChairIds,
          payment_method: selectedPayment,
<<<<<<< HEAD
          
          // MAP RES DETAILS APIL ARON DILI MAG-NULL SA DATABASE 🌟
=======
          gcash_reference: isDineIn ? document.getElementById("dineInGcashReference").value.trim() : null,
          gcash_sender_name: isDineIn ? document.getElementById("dineInGcashSenderName").value.trim() : null,
          
          // Include reservation details so the database receives the selected booking.
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
          reservation_date: reservationDetails ? reservationDetails.date : null,
          reservation_time: reservationDetails ? reservationDetails.time : null,
          customer_name: reservationDetails ? reservationDetails.name : null,
          contact_number: reservationDetails ? reservationDetails.contact : null,
<<<<<<< HEAD
=======
          contact_country: reservationDetails ? reservationDetails.contactCountry : null,
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
          num_guests: selectedChairIds.length || 1,

          items: cart.map((item) => ({
            menu_item_id: item.menu_item_id,
            quantity: item.quantity
          }))
        })
      });

<<<<<<< HEAD
=======
      if (isDineIn) {
        showDineInOrderPending(order);
        return;
      }

>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
      // Human malampuson ang request, ipadayon ang UI workflow
      const receiptTitle = document.getElementById("receiptTitle");
      if (receiptTitle) {
        receiptTitle.textContent = "Dine-Ari Receipt QR";
      }

      const receiptIntro = document.getElementById("receiptIntro");
      if (receiptIntro) {
        receiptIntro.textContent = "Show this QR code to the staff to view the official receipt.";
      }

<<<<<<< HEAD
      showSection("receiptSection", 4);

      const qrBox = document.querySelector(".receipt-qr-box");
      if (qrBox) {
        qrBox.style.display = "block";
=======
      showSection("receiptSection", 5);

      const qrBox = document.querySelector(".receipt-qr-box");
      if (qrBox) {
        qrBox.hidden = false;
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
      }

      const qrImage = document.getElementById("qrImage");

      if (order.qr_code && qrImage) {
<<<<<<< HEAD
        qrImage.style.display = "block";
        qrImage.src = order.qr_code;
        qrImage.dataset.qr = order.qr_code;
      }

      document.getElementById("thankYouMessage").textContent =
        `Thank you for dining with Dine-Ari! Your order has been placed successfully using ${selectedPayment}. Please show the QR code to the staff to view your receipt.`;

    } catch (error) {
      alert("Cannot place order: " + error.message);
    }
  })();
=======
        qrImage.hidden = false;
        qrImage.style.display = "block";
        qrImage.src = order.qr_code;
        qrImage.dataset.qr = order.qr_code;
      } else if (qrImage) {
        qrImage.removeAttribute("src");
        delete qrImage.dataset.qr;
        qrImage.hidden = true;
      }

      updateReceiptSummary({
        orderNumber: order.order_code || order.order_number || order.id,
        table: selectedTableId
          ? floorTables.find((table) => Number(table.id ?? table.table_id) === Number(selectedTableId))?.table_name || `Table ${selectedTableId}`
          : "Takeout",
        total: order.total_amount ?? cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
        paymentMethod: order.payment_method || selectedPayment
      });

      document.getElementById("thankYouMessage").textContent =
        `Thank you for dining with Dine-Ari! Your order has been placed with ${selectedPayment} selected. Please complete payment with staff; scan the QR code to open your official receipt.`;

  } catch (error) {
    alert("Cannot place order: " + error.message);
  } finally {
    orderSubmissionInProgress = false;
    if (confirmButton) {
      confirmButton.disabled = false;
      confirmButton.removeAttribute("aria-busy");
      confirmButton.textContent = originalButtonText || "Confirm Payment";
    }
  }
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
}


document.addEventListener("DOMContentLoaded", () => {
<<<<<<< HEAD
=======
  initializeFloorPlanScaling();
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) initializeFloorPlanScaling();
  });

>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  const cartDialog = document.getElementById("cartDialog");
  cartDialog?.addEventListener("close", () => {
    document.getElementById("floatingCartButton")?.setAttribute("aria-expanded", "false");
  });
<<<<<<< HEAD

  updateCartTotal();

  setInterval(() => {
    const floorSection = document.getElementById("floorSection");
    if (floorSection && floorSection.style.display !== "none") {
      loadFloorPlan();
    }
  }, 5000);

  if (
    !localStorage.getItem("token") &&
    !localStorage.getItem("dinequeue_token") &&
    !location.pathname.includes("index.html")
  ) {
    console.warn("No token found. If auth redirects are handled by api.js, ignore this warning.");
  }

  showChoicePanel();
});
=======
  document.getElementById("customerAuthMenuButton")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const shouldOpen = button.getAttribute("aria-expanded") !== "true";
    setCustomerAuthMenuOpen(shouldOpen);
    if (shouldOpen && event.detail === 0) {
      document.querySelector('#customerAuthMenu [role="menuitem"]')?.focus();
    }
  });
  const customerAuthMenu = document.getElementById("customerAuthMenu");
  customerAuthMenu?.addEventListener("click", (event) => {
    const link = event.target.closest('a[role="menuitem"]');
    if (!link || event.defaultPrevented) return;
    const destination = link.href;
    setCustomerAuthMenuOpen(false);
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    setTimeout(() => window.location.assign(destination), 190);
  });
  customerAuthMenu?.addEventListener("keydown", (event) => {
    const items = [...customerAuthMenu.querySelectorAll('[role="menuitem"]')];
    const currentIndex = items.indexOf(document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (event.key === "Escape") {
      setCustomerAuthMenuOpen(false);
      document.getElementById("customerAuthMenuButton")?.focus();
    } else if (nextIndex !== currentIndex && items[nextIndex]) {
      event.preventDefault();
      items[nextIndex].focus();
    }
  });
  document.getElementById("customerAccountButton")?.addEventListener("click", () => {
    const menu = document.getElementById("customerAccountMenu");
    const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const shouldOpen = supportsHover ||
      document.getElementById("customerAccountButton").getAttribute("aria-expanded") !== "true";
    setCustomerAccountMenuOpen(shouldOpen);
    if (shouldOpen) menu.querySelector('[role="menuitem"]:not([hidden])')?.focus();
  });
  const customerAccountMenu = document.getElementById("customerAccountMenu");
  customerAccountMenu?.addEventListener("click", (event) => {
    const action = event.target.closest("[data-customer-view]");
    if (action) setCustomerAccountView(action.dataset.customerView);
  });
  document.querySelector(".customer-account-dialog-nav")?.addEventListener("click", (event) => {
    const action = event.target.closest("[data-customer-view]");
    if (action) setCustomerAccountView(action.dataset.customerView);
  });
  customerAccountMenu?.addEventListener("keydown", (event) => {
    const items = [...customerAccountMenu.querySelectorAll('[role="menuitem"]:not([hidden])')];
    const currentIndex = items.indexOf(document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (event.key === "Escape") {
      setCustomerAccountMenuOpen(false);
      document.getElementById("customerAccountButton").focus();
    } else if (nextIndex !== currentIndex && items[nextIndex]) {
      event.preventDefault();
      items[nextIndex].focus();
    }
  });
  document.getElementById("customerAccountDialogClose")?.addEventListener("click", () => {
    document.getElementById("customerAccountDialog").close();
  });
  document.getElementById("customerAccountLogoutButton")?.addEventListener("click", logout);
  document.getElementById("customerSettingsForm")?.addEventListener("submit", saveCustomerSettings);
  document.getElementById("customerMarkAllNotificationsRead")?.addEventListener(
    "click",
    () => void markAllCustomerNotificationsRead()
  );
  document.getElementById("customerReservationBackButton")?.addEventListener("click", () => {
    setCustomerAccountView("notifications");
  });
  document.getElementById("customerReservationCorrectionButton")?.addEventListener("click", () => {
    if (customerReservationToken) {
      localStorage.setItem("dineariReservationStatusToken", customerReservationToken);
      reservationStatusToken = customerReservationToken;
    }
    document.getElementById("customerAccountDialog").close();
    void restoreReservationStatus();
  });
  document.getElementById("customerNotificationsList")?.addEventListener(
    "scroll",
    () => closeCustomerNotificationMenus(),
    { passive: true }
  );
  window.addEventListener("resize", () => closeCustomerNotificationMenus());
  window.visualViewport?.addEventListener("resize", () => closeCustomerNotificationMenus());
  const accountMenuWrap = document.querySelector(".customer-account-menu-wrap");
  accountMenuWrap?.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") setCustomerAccountMenuOpen(true);
  });
  accountMenuWrap?.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") setCustomerAccountMenuOpen(false);
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".customer-notification-menu-wrap, .customer-notification-menu")) {
      closeCustomerNotificationMenus();
    }
    if (!event.target.closest(".customer-account-menu-wrap")) setCustomerAccountMenuOpen(false);
    if (!event.target.closest(".customer-auth-menu-wrap")) setCustomerAuthMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCustomerNotificationMenus(true);
      const authMenuWasOpen =
        document.getElementById("customerAuthMenuButton")?.getAttribute("aria-expanded") === "true";
      setCustomerAccountMenuOpen(false);
      setCustomerAuthMenuOpen(false);
      if (authMenuWasOpen) document.getElementById("customerAuthMenuButton")?.focus();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === null || ["token", "user", "role"].includes(event.key)) {
      updateCustomerNavigation();
      if (getUser().role === "customer" && localStorage.getItem("token")) {
        void refreshCustomerNotifications();
      }
    }
  });

  updateCartTotal();
  updateCustomerNavigation();
  void refreshCustomerNotifications();
  document.getElementById("reservationName")?.addEventListener("input", () => {
    reservationCustomerNameEdited = true;
    updateReservationCustomerValidation();
  });
  document.getElementById("reservationName")?.addEventListener("blur", updateReservationCustomerValidation);
  initializeReservationPhoneInput();
  updateReservationCustomerValidation();

  showChoicePanel();
  if (localStorage.getItem("dineariPendingDineInOrderId") && getUser().role === "customer") {
    void restoreDineInOrderStatus();
  } else if (new URLSearchParams(window.location.search).get("flow") === "dine_in") {
    void chooseType("dine_in");
  }
});
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
