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
let reservationPhoneInput = null;
let reservationPhoneUtilsReady = false;
let floorPlanZoomIndex = 0;
let floorPlanResizeObserver = null;
let floorPlanResizeFrame = 0;
let floorPlanFallbackResizeHandler = null;
let floorPlanScalingAbortController = null;

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
  void logoutTo("index.html");
}

function hideCustomerSections() {
  [
    "choicePanel",
    "reservationSection",
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
  document.querySelectorAll(".flow-step").forEach((step, index) => {
    const isActive = index + 1 === stepNumber;
    step.classList.toggle("active", isActive);
    step.classList.toggle("done", index + 1 < stepNumber);
    step.setAttribute("aria-current", isActive ? "step" : "false");
  });
  const currentStepLabel = document.getElementById("currentStepLabel");
  const labels = ["Choose Mode", "Select Table", "Order Food", "Payment", "Receipt"];
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
  orderType = null;
  selectedChairIds = [];
  selectedTableId = null;
  cart = [];
  reservationDetails = null;

  const qrBox = document.querySelector(".receipt-qr-box");
  if (qrBox) qrBox.style.display = "block";

  const qrImage = document.getElementById("qrImage");
  if (qrImage) {
    qrImage.style.display = "block";
    qrImage.removeAttribute("src");
  }

  const thankYouMessage = document.getElementById("thankYouMessage");
  if (thankYouMessage) thankYouMessage.textContent = "";
  updateReceiptSummary({});

  showSection("choicePanel", 1, "grid");
  updateChairSelectionUI();
  updateCartTotal();
}

function showReservationSection() {
  orderType = "reservation";
  selectedChairIds = [];
  selectedTableId = null;
  reservationDetails = null;
  updateChairSelectionUI();
  updateCartTotal();

  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("reservationDate");

  if (dateInput) {
    dateInput.min = today;
    dateInput.value = today;
  }

  updateReservationCustomerValidation();
  showSection("reservationSection", 1);
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
  input.addEventListener("input", updateValidation);
  input.addEventListener("blur", updateValidation);
  input.addEventListener("countrychange", updateValidation);

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
  const nameValid = updateReservationField(
    "reservationName",
    "reservationNameError",
    validateReservationName(name),
    "Enter your full name."
  );
  const contactValidation = validateReservationContact();
  const contactValid = updateReservationField(
    "reservationContact",
    "reservationContactError",
    contactValidation.valid,
    contactValidation.message
  );
  const continueButton = document.getElementById("continueReservationButton");
  if (continueButton) continueButton.disabled = !(nameValid && contactValid);
  return nameValid && contactValid;
}

async function continueReservationToChairs() {
  if (!updateReservationCustomerValidation()) {
    document.getElementById("reservationName")?.focus();
    return;
  }

  const date = document.getElementById("reservationDate")?.value;
  const time = document.getElementById("reservationTime")?.value;
  const name = document.getElementById("reservationName")?.value.trim();
  const contact = reservationPhoneInput?.getNumber();
  const contactCountry = reservationPhoneInput?.getSelectedCountryData().iso2;

  if (!date || !time) {
    alert("Please select reservation date and time.");
    return;
  }

  reservationDetails = {
    date,
    time,
    name,
    contact,
    contactCountry
  };

  showSection("floorSection", 2);

  const guestCount = document.getElementById("guestCount");
  if (guestCount) guestCount.textContent = "0";

  await loadFloorPlan();
}

async function chooseType(type) {
  orderType = type;
  selectedChairIds = [];
  selectedTableId = null;
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

function getChairPosition(chairCount, index, shape) {
  const radiusX = shape === "rect-large" ? 112 : shape === "rect-medium" ? 100 : shape === "circle" ? 78 : 68;
  const radiusY = shape === "rect-large" ? 70 : shape === "rect-medium" ? 64 : shape === "circle" ? 78 : 48;
  const angle = (-Math.PI / 2) + (2 * Math.PI * index) / Math.max(chairCount, 1);
  return {
    x: Math.round(Math.cos(angle) * radiusX),
    y: Math.round(Math.sin(angle) * radiusY)
  };
}

async function loadFloorPlan() {
  let chairs = [];
  let tables = [];

  try {
    const [chairData, tableData] = await Promise.all([
      request("/chairs"),
      request("/tables")
    ]);

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
    );

    const chairSource = tableChairs;

    const isAvailable =
      String(realTable.status || "vacant").toLowerCase() === "vacant" &&
      chairSource.length > 0 &&
      chairSource.every((chair) => String(chair.status || "vacant").toLowerCase() === "vacant");

    const tableGroup = document.createElement("div");
    tableGroup.className = "table-group";
    tableGroup.style.left = `${blueprintTable.x}%`;
    tableGroup.style.top = `${blueprintTable.y}%`;

    const tableBox = document.createElement("button");
    tableBox.type = "button";
    tableBox.className = `table-box ${blueprintTable.shape} table-select`;
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
    }

    tableGroup.appendChild(tableBox);

    chairSource.forEach((chair, index) => {
      const status = String(chair.status || "vacant").toLowerCase();

      const pos = getChairPosition(chairSource.length, index, blueprintTable.shape);

      const chairEl = document.createElement("span");
      chairEl.type = "button";
      chairEl.className = `chair ${status}`;
      if (selectedTableId === realTableId) chairEl.classList.add("selected");
      chairEl.textContent = chair.chair_label || `C${index + 1}`;
      chairEl.style.left = `calc(50% + ${pos.x}px)`;
      chairEl.style.top = `calc(50% + ${pos.y}px)`;
      chairEl.title = `${realTable.table_name || `Table ${realTableId}`} - Chair ${chair.chair_label || index + 1}`;
      chairEl.dataset.tableId = realTableId;
      chairEl.setAttribute("aria-label", `${realTable.table_name || `Table ${realTableId}`}, chair ${chair.chair_label || index + 1}, ${status}`);
      chairEl.tabIndex = 0;

      tableGroup.appendChild(chairEl);
    });

    floorPlan.appendChild(tableGroup);
  });

  if (!renderedTables) {
    floorPlan.innerHTML = `<p class="floor-empty-message">No restaurant tables are configured on Floor ${activeFloor}. Add tables and chairs in the database, then reload this page.</p>`;
  }

  queueFloorPlanScaleUpdate();
}

function updateFloorPlanScale() {
  const wrapper = document.querySelector("#floorSection .floor-scroll-wrapper");
  const floorPlan = document.getElementById("floorPlan");
  if (!wrapper || !floorPlan) return;

  const zoomLevel = document.getElementById("floorPlanZoomLevel");
  const zoomOut = document.getElementById("floorPlanZoomOut");
  const zoomIn = document.getElementById("floorPlanZoomIn");

  if (window.innerWidth > 1024) {
    floorPlan.style.removeProperty("--floor-plan-scale");
    floorPlan.style.removeProperty("margin-left");
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

  floorPlan.style.setProperty("--floor-plan-scale", String(scale));
  floorPlan.style.marginLeft = `${Math.max(0, (availableWidth - scaledWidth) / 2)}px`;
  wrapper.style.height = `${floorPlan.offsetHeight * scale + verticalPadding}px`;
  wrapper.style.setProperty("overflow-x", scale > fitScale ? "auto" : "hidden", "important");
  wrapper.style.setProperty("overflow-y", "hidden", "important");

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

  if (selectedTableLabel) {
    selectedTableLabel.textContent = realTable
      ? `${realTable.table_name || realTable.name || `Table ${selectedTableId}`} · ${selectedChairIds.length} seats`
      : "None";
  }
  if (lockButton) {
    lockButton.textContent = realTable
      ? `Reserve ${realTable.table_name || realTable.name || `Table ${selectedTableId}`} & continue`
      : "Select a table to continue";
    lockButton.disabled = !realTable;
  }
}

async function lockSelectedChairs() {
  if (!selectedTableId) {
    alert("Please select an available table.");
    return;
  }

  try {
    const lockedChairs = await request("/chairs/lock", {
      method: "POST",
      body: JSON.stringify({ tableId: selectedTableId })
    });
    selectedChairIds = lockedChairs.map((chair) => chair.id);
  } catch (error) {
    alert("Cannot reserve table: " + error.message);
    selectedTableId = null;
    selectedChairIds = [];
    updateChairSelectionUI();
    await loadFloorPlan();
    return;
  }

  if (orderType === "reservation") {
    await confirmReservationOnly();
    return;
  }

  showSection("menuSection", 3);
  await loadMenu();
}

async function confirmReservationOnly() {
  if (!reservationDetails) {
    alert("Reservation details are missing.");
    return;
  }

  if (!selectedChairIds.length) {
    alert("Please select at least one chair.");
    return;
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
        num_guests: selectedChairIds.length
      })
    });

    showSection("receiptSection", 5);

    const receiptTitle = document.getElementById("receiptTitle");
    if (receiptTitle) {
      receiptTitle.textContent = "Reservation Confirmed";
    }

    const receiptIntro = document.getElementById("receiptIntro");
    if (receiptIntro) {
      receiptIntro.textContent = "Your table booking has been saved successfully.";
    }

    const qrBox = document.querySelector(".receipt-qr-box");
    if (qrBox) {
      qrBox.style.display = "none";
    }

    const thankYouMessage = document.getElementById("thankYouMessage");
    if (thankYouMessage) {
      const receiptDetails = document.createElement("div");
      receiptDetails.className = "official-receipt";

      const receiptHeading = document.createElement("h3");
      receiptHeading.textContent = "Reservation Details";
      receiptDetails.append(receiptHeading);

      const addReceiptDetail = (label, value) => {
        const row = document.createElement("p");
        const strong = document.createElement("strong");
        strong.textContent = `${label}:`;
        row.append(strong, ` ${value}`);
        receiptDetails.append(row);
      };

      addReceiptDetail("Customer", reservationDetails.name);
      addReceiptDetail("Contact", reservationDetails.contact);
      addReceiptDetail("Date", reservationDetails.date);
      addReceiptDetail("Time", reservationDetails.time);
      addReceiptDetail("Guests", selectedChairIds.length);

      const receiptNote = document.createElement("p");
      receiptNote.className = "receipt-note";
      receiptNote.textContent = "Please arrive on time and present your name to the staff.";
      receiptDetails.append(receiptNote);
      thankYouMessage.replaceChildren(receiptDetails);
    }
    updateReceiptSummary({
      orderNumber: reservation.reservation_code || reservation.id || "Reservation confirmed",
      table: floorTables.find((table) => Number(table.id ?? table.table_id) === Number(selectedTableId))?.table_name || `Table ${selectedTableId}`,
      paymentMethod: "Not applicable"
    });
  } catch (error) {
    alert("Cannot create reservation: " + error.message);
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

let cartToastTimer;
function showCartToast(message) {
  const toast = document.getElementById("cartToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  const cartButton = document.getElementById("floatingCartButton");
  cartButton?.classList.remove("cart-bump");
  if (cartButton) {
    void cartButton.offsetWidth;
    cartButton.classList.add("cart-bump");
  }
  window.clearTimeout(cartToastTimer);
  cartToastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2200);
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
          <small>₱${item.price.toFixed(2)} × ${item.quantity}</small>
        </div>
        <span>₱${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join("");
  }

  if (paymentTotal) {
    paymentTotal.textContent = total.toFixed(2);
  }
  const paymentSubtotal = document.getElementById("paymentSubtotal");
  if (paymentSubtotal) paymentSubtotal.textContent = total.toFixed(2);
  const paymentOrderType = document.getElementById("paymentOrderType");
  if (paymentOrderType) paymentOrderType.textContent = orderType === "reservation" ? "Reservation" : orderType === "dine_in" ? "Dine-in" : "Takeout";
  const paymentTableNumber = document.getElementById("paymentTableNumber");
  if (paymentTableNumber) paymentTableNumber.textContent = selectedTableId
    ? floorTables.find((table) => Number(table.id ?? table.table_id) === Number(selectedTableId))?.table_name || `Table ${selectedTableId}`
    : "Takeout";

  closeCartDialog();
  showSection("paymentSection", 4);
}

function backToMenu() {
  showSection("menuSection", 3);
}

function selectPaymentCard(input) {
  document.querySelectorAll(".payment-method-card").forEach((card) => {
    card.classList.remove("active");
  });

  input.closest(".payment-method-card")?.classList.add("active");
}

function updateReceiptSummary({ orderNumber, table, total, paymentMethod } = {}) {
  const values = {
    receiptOrderNumber: orderNumber || "—",
    receiptTableNumber: table || "—",
    receiptTotal: total == null ? "—" : `₱${Number(total).toFixed(2)}`,
    receiptPaymentMethod: paymentMethod || "—"
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
}

function confirmPaymentAndOrder() {
  const selectedPayment =
    document.querySelector('input[name="paymentMethod"]:checked')?.value || "GCash";

  if (selectedPayment === "Cash") {
    alert("Cash payment is no longer available. Please choose GCash or Card.");
    return;
  }

  const confirmMessage =
    `Payment Method: ${selectedPayment}\n\nAre you sure you want to place this order?`;

  const confirmed = confirm(confirmMessage);

  if (!confirmed) return;

  placeOrder();
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

  let order;

  const selectedPayment =
    document.querySelector('input[name="paymentMethod"]:checked')?.value || "Cash";

  // Use an async function so the flow can await its database requests.
  (async () => {
    try {
      order = await request("/orders", {
        method: "POST",
        body: JSON.stringify({
          type: orderType || (selectedChairIds.length ? "dine_in" : null),
          chairIds: selectedChairIds,
          payment_method: selectedPayment,
          
          // Include reservation details so the database receives the selected booking.
          reservation_date: reservationDetails ? reservationDetails.date : null,
          reservation_time: reservationDetails ? reservationDetails.time : null,
          customer_name: reservationDetails ? reservationDetails.name : null,
          contact_number: reservationDetails ? reservationDetails.contact : null,
          contact_country: reservationDetails ? reservationDetails.contactCountry : null,
          num_guests: selectedChairIds.length || 1,

          items: cart.map((item) => ({
            menu_item_id: item.menu_item_id,
            quantity: item.quantity
          }))
        })
      });

      // Human malampuson ang request, ipadayon ang UI workflow
      const receiptTitle = document.getElementById("receiptTitle");
      if (receiptTitle) {
        receiptTitle.textContent = "Dine-Ari Receipt QR";
      }

      const receiptIntro = document.getElementById("receiptIntro");
      if (receiptIntro) {
        receiptIntro.textContent = "Show this QR code to the staff to view the official receipt.";
      }

      showSection("receiptSection", 5);

      const qrBox = document.querySelector(".receipt-qr-box");
      if (qrBox) {
        qrBox.style.display = "block";
      }

      const qrImage = document.getElementById("qrImage");

      if (order.qr_code && qrImage) {
        qrImage.style.display = "block";
        qrImage.src = order.qr_code;
        qrImage.dataset.qr = order.qr_code;
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
    }
  })();
}


document.addEventListener("DOMContentLoaded", () => {
  initializeFloorPlanScaling();
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) initializeFloorPlanScaling();
  });

  const cartDialog = document.getElementById("cartDialog");
  cartDialog?.addEventListener("close", () => {
    document.getElementById("floatingCartButton")?.setAttribute("aria-expanded", "false");
  });

  updateCartTotal();
  document.getElementById("reservationName")?.addEventListener("input", updateReservationCustomerValidation);
  document.getElementById("reservationName")?.addEventListener("blur", updateReservationCustomerValidation);
  initializeReservationPhoneInput();
  updateReservationCustomerValidation();

  if (
    !localStorage.getItem("token") &&
    !localStorage.getItem("dinequeue_token") &&
    !location.pathname.includes("index.html")
  ) {
    console.warn("No token found. If auth redirects are handled by api.js, ignore this warning.");
  }

  showChoicePanel();
});