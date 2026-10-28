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

  const base = "http://localhost:3000/api";
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
  localStorage.clear();
  location.href = "index.html";
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
    step.classList.toggle("active", index + 1 === stepNumber);
    step.classList.toggle("done", index + 1 < stepNumber);
  });
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

  showSection("reservationSection", 1);
}

async function continueReservationToChairs() {
  const date = document.getElementById("reservationDate")?.value;
  const time = document.getElementById("reservationTime")?.value;
  const name =
    document.getElementById("reservationName")?.value.trim() ||
    localStorage.getItem("full_name") ||
    "Customer";
  const contact =
    document.getElementById("reservationContact")?.value.trim() ||
    "N/A";

  if (!date || !time) {
    alert("Please select reservation date and time.");
    return;
  }

  reservationDetails = {
    date,
    time,
    name,
    contact
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
  };

  const set = positions[chairCount] || positions[4];
  return set[index % set.length];
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
    );

    const chairSource = tableChairs.length
      ? tableChairs
      : Array.from({ length: blueprintTable.chairs }, (_, i) => ({
        id: `local-${blueprintTable.id}-${i + 1}`,
        table_id: blueprintTable.id,
        status: "vacant"
      }));

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
    }

    tableGroup.appendChild(tableBox);

    chairSource.forEach((chair, index) => {
      const status = String(chair.status || "vacant").toLowerCase();

      const pos = getChairPosition(chairSource.length, index);

      const chairEl = document.createElement("span");
      chairEl.type = "button";
      chairEl.className = `chair ${status}`;
      if (selectedTableId === Number(blueprintTable.id)) chairEl.classList.add("selected");
      chairEl.textContent = `C${index + 1}`;
      chairEl.style.left = `calc(50% + ${pos.x}px)`;
      chairEl.style.top = `calc(50% + ${pos.y}px)`;
      chairEl.title = `Table ${blueprintTable.id} - Chair ${index + 1}`;
      chairEl.dataset.tableId = blueprintTable.id;
      chairEl.setAttribute("aria-hidden", "true");

      tableGroup.appendChild(chairEl);
    });

    floorPlan.appendChild(tableGroup);
  });

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
    await request("/reservations", {
      method: "POST",
      body: JSON.stringify({
        chairIds: selectedChairIds,
        reservation_date: reservationDetails.date,
        reservation_time: reservationDetails.time,
        customer_name: reservationDetails.name,
        contact_number: reservationDetails.contact,
        num_guests: selectedChairIds.length
      })
    });

    showSection("receiptSection", 4);

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

    document.getElementById("thankYouMessage").innerHTML = `
      <div class="official-receipt">
        <h3>Reservation Details</h3>
        <p><strong>Customer:</strong> ${reservationDetails.name}</p>
        <p><strong>Contact:</strong> ${reservationDetails.contact}</p>
        <p><strong>Date:</strong> ${reservationDetails.date}</p>
        <p><strong>Time:</strong> ${reservationDetails.time}</p>
        <p><strong>Guests:</strong> ${selectedChairIds.length}</p>
        <p class="receipt-note">
          Please arrive on time and present your name to the staff.
        </p>
      </div>
    `;
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

function renderMenu(items) {
  const menuGrid = document.getElementById("menuGrid");
  if (!menuGrid) return;

  const query = (document.getElementById("menuSearch")?.value || "").trim().toLowerCase();

  const filtered = items.filter((item) => {
    const name = getItemName(item).toLowerCase();
    const category = getCategory(item);
    const matchesCategory = activeCategory === "All" || category === activeCategory;
    const matchesSearch = !query || name.includes(query) || (item.description || "").toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  menuGrid.innerHTML = filtered.map((item, index) => {
    const name = getItemName(item);
    const imageUrl = foodImages[name] || "images/menu-images/default-food.png";
    const stock = Number(item.stock_count ?? item.stock ?? 99);
    const price = Number(item.price || 0);

    return `
      <div class="panel menu-card" style="animation-delay:${index * 0.04}s">
        <div class="menu-image-wrapper">
          <img src="${imageUrl}" alt="${name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=&quot;width:100%;height:100%;display:grid;place-items:center;color:var(--gold-2);font-size:44px;&quot;>♨</div>'">
        </div>
        <h3>${name}</h3>
        <p>${item.description || "Authentic Filipino flavors prepared fresh for every guest."}</p>
        <div class="price-stock">
          <strong>₱${price.toFixed(2)}</strong>
          <span class="stock">${stock > 0 ? `${stock} left` : "Sold Out"}</span>
        </div>
        <button class="${stock <= 0 ? "out-of-stock danger" : ""}" ${stock <= 0 ? "disabled" : ""} onclick="addToCart(${Number(item.id ?? item.item_id)})">
          ${stock <= 0 ? "Sold Out" : "+ Add"}
        </button>
      </div>
    `;
  }).join("") || `<div class="panel" style="padding:24px;"><h3>No dishes found</h3><p>Try another search or category.</p></div>`;
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
      <div style="display:grid; gap:6px; justify-items:end;">
        <strong>₱${(line.price * line.quantity).toFixed(2)}</strong>
        <div style="display:flex; gap:4px;">
          <button type="button" style="min-height:28px; padding:3px 9px;" onclick="changeQuantity(${line.menu_item_id}, -1)">−</button>
          <button type="button" style="min-height:28px; padding:3px 9px;" onclick="changeQuantity(${line.menu_item_id}, 1)">+</button>
          <button type="button" class="danger" style="min-height:28px; padding:3px 9px;" onclick="removeFromCart(${line.menu_item_id})">×</button>
        </div>
      </div>
    </div>
  `).join("") : `<p>No items added yet.</p>`;
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

  input.closest(".payment-method-card").classList.add("active");
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

  // Gigamit nato ang anonymous async function module aron ma-process ang await nga walay error 🌟
  (async () => {
    try {
      order = await request("/orders", {
        method: "POST",
        body: JSON.stringify({
          type: orderType || (selectedChairIds.length ? "dine_in" : null),
          chairIds: selectedChairIds,
          payment_method: selectedPayment,
          
          // MAP RES DETAILS APIL ARON DILI MAG-NULL SA DATABASE 🌟
          reservation_date: reservationDetails ? reservationDetails.date : null,
          reservation_time: reservationDetails ? reservationDetails.time : null,
          customer_name: reservationDetails ? reservationDetails.name : null,
          contact_number: reservationDetails ? reservationDetails.contact : null,
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

      showSection("receiptSection", 4);

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

      document.getElementById("thankYouMessage").textContent =
        `Thank you for dining with Dine-Ari! Your order has been placed successfully using ${selectedPayment}. Please show the QR code to the staff to view your receipt.`;

    } catch (error) {
      alert("Cannot place order: " + error.message);
    }
  })();
}


document.addEventListener("DOMContentLoaded", () => {
  const cartDialog = document.getElementById("cartDialog");
  cartDialog?.addEventListener("close", () => {
    document.getElementById("floatingCartButton")?.setAttribute("aria-expanded", "false");
  });

  updateCartTotal();

  if (
    !localStorage.getItem("token") &&
    !localStorage.getItem("dinequeue_token") &&
    !location.pathname.includes("index.html")
  ) {
    console.warn("No token found. If auth redirects are handled by api.js, ignore this warning.");
  }

  showChoicePanel();
});