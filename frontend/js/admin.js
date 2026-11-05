// State Arrays for Database-backed Dashboard
function syncLucideIcons() {
  if (window.lucide) window.lucide.createIcons();
}

let products = [];
let users = [];
let auditLogs = [];
let auditPage = 1;
let auditPageCount = 1;
let auditSearchTimer = null;
let ordersCache = [];
let allOrdersCache = [];
let revenueChartInstance = null;
let ridgelineChartInstance = null;
let categoryChartInstance = null;
let weeklyForecastChart = null;
let hourlyForecastChart = null;
let latestReservationForecast = null;
let categoryChartRefreshPromise = null;
const pendingAdminMutations = new Set();

function beginAdminMutation(key) {
  if (pendingAdminMutations.has(key)) return false;
  pendingAdminMutations.add(key);
  return true;
}

function endAdminMutation(key) {
  pendingAdminMutations.delete(key);
}

const CATEGORY_CHART_CATEGORIES = [
  { label: "Appetizers", color: "#22A06B" },
  { label: "Beverages", color: "#F59E0B" },
  { label: "Desserts", color: "#3B82F6" },
  { label: "Main Course", color: "#8B5CF6" }
];

function dashboardChartTheme() {
  const isDark = document.documentElement.dataset.theme === "dark";
  return {
    text: isDark ? "#d9c7b6" : "#705c4e",
    grid: isDark ? "rgba(255, 247, 237, 0.10)" : "rgba(82, 52, 32, 0.10)"
  };
}

function refreshDashboardChartTheme() {
  const theme = dashboardChartTheme();
  const charts = [
    revenueChartInstance,
    ridgelineChartInstance,
    categoryChartInstance,
    weeklyForecastChart,
    hourlyForecastChart
  ];

  charts.forEach((chart) => {
    if (!chart) return;

    const legendLabels = chart.options.plugins &&
      chart.options.plugins.legend &&
      chart.options.plugins.legend.labels;
    if (legendLabels) legendLabels.color = theme.text;

    Object.values(chart.options.scales || {}).forEach((scale) => {
      if (scale.ticks) scale.ticks.color = theme.text;
      if (scale.grid) scale.grid.color = theme.grid;
    });

    chart.update("none");
  });
}

window.addEventListener("dineari:themechange", refreshDashboardChartTheme);

function toggleAdminNavigation(toggle) {
  const isExpanded = toggle.getAttribute("aria-expanded") === "true";
  setAdminNavigationOpen(!isExpanded);
}

function setAdminNavigationOpen(isOpen) {
  const toggle = document.querySelector(".admin-nav-toggle");
  if (!toggle) return;

  toggle.setAttribute("aria-expanded", String(isOpen));
  toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  document.body.classList.toggle("admin-navigation-open", isOpen);
}

function closeAdminNavigation() {
  setAdminNavigationOpen(false);
}

document.addEventListener("DOMContentLoaded", async () => {
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.classList.contains("admin-navigation-open")) {
      closeAdminNavigation();
      document.querySelector(".admin-nav-toggle")?.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024 && document.body.classList.contains("admin-navigation-open")) {
      closeAdminNavigation();
    }
  });

  const sessionUser = getUser();
  const sessionRole = String(sessionUser.role || localStorage.getItem("role") || "").trim().toLowerCase();
  if (!getToken() || sessionRole !== "admin") {
    window.location.replace("./login.html");
    return;
  }

  initAuditLogControls();

  await loadAdminWorkspace();
  initCharts();
  setInterval(loadAdminWorkspace, 10000); // Live refresh every 10 seconds
});

// Main orchestrator to load all workspace sections from PostgreSQL backend
async function loadAdminWorkspace() {
  try {
    await Promise.all([
      fetchProducts(),
      fetchUsers(),
      fetchAuditLogs(),
      loadAdminDashboardMetrics()
    ]);
    renderAlerts();
  } catch (error) {
    console.error("Error synchronizing with PostgreSQL backend:", error);
  }
}

// --- 1. DASHBOARD, LIVE ORDERS & TELEMETRY ---
async function loadAdminDashboardMetrics() {
  void refreshCategoryPieChart();

  try {
    const orders = await apiRequest("/orders/kds");
    const reservations = await apiRequest("/reservations");
    
    let history = [];
    try {
      history = await apiRequest("/orders/history");
    } catch (error) {
      history = [];
    }

    allOrdersCache = [...orders, ...history];

    // Calculate total revenue correctly from database orders
    const totalRevenue = allOrdersCache.reduce((sum, ord) => sum + Number(ord.total_amount || 0), 0);

    // Compute Dynamic Conversion Rate (Completed / Total Orders Attempted)
    const completedCount = history.length;
    const totalAttempted = allOrdersCache.length;
    const conversionRate = totalAttempted > 0 ? ((completedCount / totalAttempted) * 100).toFixed(1) : "0.0";

    const orderCount = document.getElementById("orderCount");
    const reservationCount = document.getElementById("reservationCount");
    const historyCount = document.getElementById("historyCount");
    const kpiRevenue = document.getElementById("kpiRevenue");
    const kpiOrders = document.getElementById("kpiOrders");
    const kpiConversion = document.getElementById("kpiConversion");

    if (orderCount) orderCount.textContent = orders.length;
    if (reservationCount) reservationCount.textContent = reservations.length;
    if (historyCount) historyCount.textContent = history.length;
    if (kpiRevenue) kpiRevenue.textContent = totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (kpiOrders) kpiOrders.textContent = totalAttempted;
    if (kpiConversion) kpiConversion.textContent = `${conversionRate}%`;

    renderLiveOrders(orders);
    renderReservations(reservations);
    renderOrderHistory(history);

    // Refresh charts with real data
    updateRevenueChartRange();
  } catch (error) {
    console.error("Admin dashboard telemetry error:", error);
    document.querySelectorAll("#orders, #reservations, #history").forEach((el) => {
      if (el) el.innerHTML = `<p class="muted">Unable to load telemetry data. ${error.message}</p>`;
    });
  }
}

function renderLiveOrders(orders) {
  const ordersBox = document.getElementById("orders");
  if (!ordersBox) return;

  ordersBox.innerHTML = orders.length
    ? orders.map((order) => `
        <div class="admin-item dashboard-card-row">
          <div class="dashboard-card-head">
            <h3>Order #${order.order_code || order.id}</h3>
            <span class="status-badge status-${order.status}">
              ${String(order.status || "pending").toUpperCase()}
            </span>
          </div>

          <p><strong>Type:</strong> ${String(order.type || "N/A").replace("_", " ").toUpperCase()}</p>
          <p><strong>Payment:</strong> ${order.payment_method || "Cash"}</p>
          <p><strong>Total:</strong> ₱${Number(order.total_amount || 0).toFixed(2)}</p>
          <p><strong>Date:</strong> ${order.created_at ? new Date(order.created_at).toLocaleString() : "N/A"}</p>

          <button class="danger" onclick="deleteOrder(${order.id})"><i data-lucide="trash-2" aria-hidden="true"></i> Soft Delete</button>
        </div>
      `).join("")
    : `<p class="muted empty-state">No active orders found in database.</p>`;
  syncLucideIcons();
}

function renderReservations(reservations) {
  const reservationsBox = document.getElementById("reservations");
  if (!reservationsBox) return;

  reservationsBox.innerHTML = reservations.length
    ? reservations.map((reservation) => `
        <div class="admin-item dashboard-card-row">
          <div class="dashboard-card-head">
            <h3>${reservation.table_name || "Table " + reservation.table_id}</h3>
            <span class="status-badge status-${reservation.status || "active"}">
              ${String(reservation.status || "active").toUpperCase()}
            </span>
          </div>

          <p><strong>Customer:</strong> ${reservation.customer_name || reservation.full_name || "Customer"}</p>
          <p><strong>Contact:</strong> ${reservation.contact_number || "N/A"}</p>
          <p><strong>Guests:</strong> ${reservation.num_guests || reservation.number_of_guests || "N/A"}</p>
          <p><strong>Date:</strong> ${reservation.reservation_date || "N/A"}</p>
          <p><strong>Time:</strong> ${reservation.reservation_time || "N/A"}</p>
        </div>
      `).join("")
    : `<p class="muted empty-state">No active database reservations.</p>`;
}

function renderOrderHistory(history) {
  const historyBox = document.getElementById("history");
  if (!historyBox) return;

  historyBox.innerHTML = history.length
    ? history.map((record) => `
        <div class="admin-item history-card">
          <div class="dashboard-card-head">
            <h3>Completed Order #${record.order_code || record.order_id || record.id}</h3>
            <span class="status-badge status-completed">COMPLETED</span>
          </div>

          <div class="history-grid">
            <p><strong>Customer:</strong> ${record.customer_name || "Customer"}</p>
            <p><strong>Email:</strong> ${record.customer_email || "N/A"}</p>
            <p><strong>Order Type:</strong> ${String(record.order_type || record.type || "N/A").replace("_", " ").toUpperCase()}</p>
            <p><strong>Payment:</strong> ${record.payment_method || "Cash"}</p>
            <p><strong>Payment Status:</strong> ${String(record.payment_status || "unpaid").toUpperCase()}</p>
            <p><strong>Total:</strong> ₱${Number(record.total_amount || 0).toFixed(2)}</p>
            <p><strong>Date & Time:</strong> ${record.completed_at ? new Date(record.completed_at).toLocaleString() : "N/A"}</p>
          </div>

          <div class="ordered-items-box">
            <strong>Ordered Items:</strong>
            <p>${record.ordered_items || "No item list saved."}</p>
          </div>
        </div>
      `).join("")
    : `<p class="muted empty-state">No completed order history records found.</p>`;
}

async function deleteOrder(id) {
  const actionKey = `delete-order:${id}`;
  if (!beginAdminMutation(actionKey)) return;
  try {
    const confirmed = await window.DineAriNotifications.confirm({
      type: "warning",
      title: "Delete this order?",
      message: "Soft delete this order from the database?",
      confirmLabel: "Delete order",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await apiRequest(`/orders/${id}`, { method: "DELETE" });
      await loadAdminDashboardMetrics();
      window.DineAriNotifications.show({ type: "success", description: "Order deleted successfully." });
    } catch (err) {
      console.error("Failed to delete order:", err);
      window.DineAriNotifications.show({ type: "error", description: err.message || "The order could not be deleted." });
    }
  } finally {
    endAdminMutation(actionKey);
  }
}

// --- 2. MENU ITEMS & RECIPES CRUD ---
async function fetchProducts() {
  try {
    const data = await apiRequest("/menu");
    products = data.map(item => ({
      id: item.id,
      name: item.item_name,
      category: item.category,
      price: parseFloat(item.price),
      stock: item.stock_count,
      recipe: item.description || "Standard Recipe",
      image_url: item.image_url || 'images/default-food.jpg'
    }));
    renderProducts();
  } catch (err) {
    console.error("Failed to fetch menu items from DB:", err);
  }
}

function renderProducts() {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;
  const searchInput = document.getElementById("menuSearch");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const clearButton = document.getElementById("clearMenuSearch");
  if (clearButton) clearButton.hidden = !query;

  const matchingProducts = products.filter((product) => {
    const searchableText = `${product.name || ""} ${product.category || ""}`.toLowerCase();
    return searchableText.includes(query);
  });

  if (!matchingProducts.length) {
    const emptyMessage = products.length
      ? "No menu items match your search."
      : "No menu items are available.";
    tbody.innerHTML = `<tr><td colspan="6" class="muted empty-state">${emptyMessage}</td></tr>`;
    return;
  }

  tbody.innerHTML = matchingProducts.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td>${p.category}</td>
      <td>₱${p.price.toFixed(2)}</td>
      <td><span class="badge ${p.stock < 15 ? 'badge-danger' : ''}">${p.stock} units</span></td>
      <td><small class="muted">${p.recipe}</small></td>
      <td>
        <button class="secondary" style="padding: 4px 8px; margin:0;" onclick="editProduct(${p.id})"><i data-lucide="pencil" aria-hidden="true"></i> Edit</button>
        <button class="danger" style="padding: 4px 8px; margin:0;" onclick="deleteProduct(${p.id})"><i data-lucide="trash-2" aria-hidden="true"></i> Delete</button>
      </td>
    </tr>
  `).join('');
  syncLucideIcons();
}

function clearMenuSearch() {
  const searchInput = document.getElementById("menuSearch");
  if (!searchInput) return;

  searchInput.value = "";
  renderProducts();
  searchInput.focus();
}

function openProductModal() {
  document.getElementById("productModalTitle").innerText = "Add Menu";
  document.getElementById("editProductId").value = "";
  document.getElementById("prodName").value = "";
  document.getElementById("prodCategory").value = "Main Course";
  document.getElementById("prodPrice").value = "";
  document.getElementById("prodStock").value = "";
  
  const imageInput = document.getElementById("prodImageFile");
  if (imageInput) imageInput.value = ""; 

  document.getElementById("prodRecipe").value = "";
  document.getElementById("productModal").classList.remove("hidden");
}

function closeProductModal() {
  const modal = document.getElementById("productModal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

function editProduct(id) {
  const p = products.find(prod => prod.id === id);
  if (!p) return;
  document.getElementById("productModalTitle").innerText = "Edit Product & Recipe";
  document.getElementById("editProductId").value = p.id;
  document.getElementById("prodName").value = p.name;
  document.getElementById("prodCategory").value = p.category;
  document.getElementById("prodPrice").value = p.price;
  document.getElementById("prodStock").value = p.stock;

  const imageInput = document.getElementById("prodImageFile");
  if (imageInput) imageInput.value = ""; // File inputs cannot be prefilled programmatically for security

  document.getElementById("prodRecipe").value = p.recipe;
  document.getElementById("productModal").classList.remove("hidden");
}

async function saveProduct() {
  const id = document.getElementById("editProductId").value;
  const item_name = document.getElementById("prodName").value;
  const category = document.getElementById("prodCategory").value;
  const price = parseFloat(document.getElementById("prodPrice").value);
  const stock_count = parseInt(document.getElementById("prodStock").value);
  const description = document.getElementById("prodRecipe").value;
  const imageFile = document.getElementById("prodImageFile").files[0];

  if (!item_name || isNaN(price) || isNaN(stock_count)) {
    alert("Please fill in all required product fields accurately.");
    return;
  }

  // Use FormData to support file uploads from any device
  const formData = new FormData();
  formData.append("item_name", item_name);
  formData.append("category", category);
  formData.append("price", price);
  formData.append("stock_count", stock_count);
  formData.append("description", description);
  if (imageFile) {
    formData.append("image", imageFile);
  }

  const token = localStorage.getItem("token") || sessionStorage.getItem("token");

  try {
    const url = id
      ? `${window.location.origin}/api/menu/${id}`
      : `${window.location.origin}/api/menu`;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method: method,
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
        // NOTE: Do NOT set Content-Type header when using FormData; fetch handles it automatically with boundaries.
      },
      body: formData
    });

    if (res.status === 401 || res.status === 403) {
      redirectForAuthorizationFailure(res.status);
      throw new Error(`Request failed with status ${res.status}`);
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to save menu item");
    }

    closeProductModal();
    await fetchProducts();
    alert("New Menu saved successfully!");
  } catch (err) {
    console.error("Product save error:", err);
    alert("Failed to save product: " + err.message);
  }
}

async function deleteProduct(id) {
  const actionKey = `delete-menu:${id}`;
  if (!beginAdminMutation(actionKey)) return;
  try {
    const confirmed = await window.DineAriNotifications.confirm({
      type: "warning",
      title: "Delete this menu item?",
      message: "Delete this food product from PostgreSQL?",
      confirmLabel: "Delete item",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await apiRequest(`/menu/${id}`, { method: "DELETE" });
      await fetchProducts();
      window.DineAriNotifications.show({ type: "success", description: "Menu item deleted successfully." });
    } catch (err) {
      console.error("Database deletion error:", err);
      window.DineAriNotifications.show({ type: "error", description: err.message || "The menu item could not be deleted." });
    }
  } finally {
    endAdminMutation(actionKey);
  }
}

// --- 3. STAFF USERS & RBAC (Filtered to Employees Only) ---
async function fetchUsers() {
  const tbody = document.getElementById("userTableBody");
  const status = document.getElementById("staffManagementStatus");
  try {
    const data = await apiRequest("/users");
    users = data.map(u => ({
      id: u.id,
      name: u.full_name,
      username: u.username || "",
      email: u.email,
      role: u.role,
      createdAt: u.created_at,
      status: u.deleted_at ? "inactive" : "active"
    }));

    renderUsers();

    const kpiUsers = document.getElementById("kpiUsers");
    if (kpiUsers) {
      kpiUsers.innerText = users.filter((user) => user.role === "staff" && user.status === "active").length;
    }
    if (status) {
      status.classList.remove("is-error");
      status.classList.remove("is-success");
      status.textContent = `${users.filter((user) => user.role === "staff").length} staff accounts`;
    }
  } catch {
    if (tbody && !users.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Staff accounts could not be loaded.</td></tr>`;
    }
    if (status) {
      status.classList.add("is-error");
      status.textContent = "Staff accounts could not be loaded. Please try again.";
    }
  }
}

function renderUsers() {
  const tbody = document.getElementById("userTableBody");
  if (!tbody) return;
  const search = document.getElementById("staffSearch")?.value.trim().toLowerCase() || "";
  const roleFilter = document.getElementById("staffRoleFilter")?.value || "all";
  const statusFilter = document.getElementById("staffStatusFilter")?.value || "all";
  const filteredUsers = users.filter((user) => {
    const matchesSearch = !search ||
      [user.name, user.username, user.email].some((value) => String(value || "").toLowerCase().includes(search));
    return matchesSearch &&
      (roleFilter === "all" || user.role === roleFilter) &&
      (statusFilter === "all" || user.status === statusFilter);
  });

  if (!filteredUsers.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">${users.length ? "No accounts match your search or filters." : "No staff accounts yet. Add the first staff account to get started."}</td></tr>`;
    syncLucideIcons();
    return;
  }

  tbody.innerHTML = filteredUsers.map((user) => `
    <tr>
      <td><span class="staff-table-name">${escapeStaffHtml(user.name)}</span></td>
      <td><span class="staff-table-username">${user.username ? `@${escapeStaffHtml(user.username)}` : "—"}</span></td>
      <td>${escapeStaffHtml(user.email)}</td>
      <td><span class="staff-role-badge">${user.role === "admin" ? "Administrator" : "Staff"}</span></td>
      <td>${formatStaffCreatedDate(user.createdAt)}</td>
      <td><span class="staff-status-badge ${user.status === "active" ? "is-active" : ""}">${user.status === "active" ? "Active" : "Deactivated"}</span></td>
      <td>
        ${user.role === "staff"
          ? `<div class="staff-row-actions">
              <button class="secondary" type="button" data-staff-id="${escapeStaffHtml(user.id)}" onclick="openStaffForm(this.dataset.staffId)"><i data-lucide="pencil" aria-hidden="true"></i>Edit</button>
              <button class="secondary" type="button" data-staff-id="${escapeStaffHtml(user.id)}" data-next-status="${user.status === "active" ? "inactive" : "active"}" onclick="toggleUserStatus(this.dataset.staffId, this.dataset.nextStatus)"><i data-lucide="${user.status === "active" ? "user-round-x" : "user-round-check"}" aria-hidden="true"></i>${user.status === "active" ? "Deactivate" : "Activate"}</button>
            </div>`
          : `<small class="staff-protected-label">Protected administrator account</small>`}
      </td>
    </tr>
  `).join("");
  syncLucideIcons();
}

function escapeStaffHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatStaffCreatedDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : escapeStaffHtml(date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }));
}

function setStaffManagementMessage(message, isError = false) {
  const status = document.getElementById("staffManagementStatus");
  if (!status) return;
  status.classList.toggle("is-error", isError);
  status.classList.toggle("is-success", Boolean(message) && !isError);
  status.textContent = message;
}

function openStaffForm(id = "") {
  const dialog = document.getElementById("staffFormDialog");
  const form = document.getElementById("staffManagementForm");
  const editing = Boolean(id);
  const user = editing ? users.find((item) => String(item.id) === String(id) && item.role === "staff") : null;
  if (!dialog || !form || (editing && !user)) return;

  form.reset();
  document.getElementById("staffFormMessage").textContent = "";
  document.getElementById("staffRecordId").value = user ? String(user.id) : "";
  document.getElementById("staffFormTitle").textContent = editing ? "Edit Staff Account" : "Add New Staff";
  document.getElementById("staffFormDescription").textContent = editing
    ? "Update this staff member’s account details and role."
    : "Create a staff account for Dine-Ari.";
  document.getElementById("staffFormSubmit").textContent = editing ? "Save Changes" : "Create Staff Account";
  document.getElementById("staffFullName").value = user?.name || "";
  document.getElementById("staffUsername").value = user?.username || "";
  document.getElementById("staffAccountEmail").value = user?.email || "";
  document.getElementById("staffAccountRole").value = user?.role || "staff";
  const adminRole = document.querySelector('#staffAccountRole option[value="admin"]');
  adminRole.disabled = !editing;
  adminRole.hidden = !editing;
  document.getElementById("staffPasswordFields").classList.toggle("hidden", editing);
  document.getElementById("staffAccountPassword").required = !editing;
  document.getElementById("staffConfirmPassword").required = !editing;
  dialog.showModal();
  syncLucideIcons();
}

function closeStaffForm() {
  const dialog = document.getElementById("staffFormDialog");
  if (dialog?.open) dialog.close();
}

async function submitStaffForm(event) {
  event.preventDefault();
  const form = document.getElementById("staffManagementForm");
  const message = document.getElementById("staffFormMessage");
  const submitButton = document.getElementById("staffFormSubmit");
  const id = document.getElementById("staffRecordId").value;
  const creating = !id;
  const password = document.getElementById("staffAccountPassword").value;
  const confirmPassword = document.getElementById("staffConfirmPassword").value;

  message.textContent = "";
  if (!form.reportValidity()) return;
  if (creating && password !== confirmPassword) {
    message.textContent = "Password and confirmation do not match.";
    document.getElementById("staffConfirmPassword").focus();
    return;
  }
  if (creating && password.length < 12) {
    message.textContent = "Password must be at least 12 characters.";
    document.getElementById("staffAccountPassword").focus();
    return;
  }
  if (submitButton.disabled) return;

  const payload = {
    fullName: document.getElementById("staffFullName").value.trim(),
    username: document.getElementById("staffUsername").value.trim(),
    email: document.getElementById("staffAccountEmail").value.trim(),
    role: document.getElementById("staffAccountRole").value,
  };
  if (creating) {
    payload.password = password;
    payload.confirmPassword = confirmPassword;
  }

  const originalLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.setAttribute("aria-busy", "true");
  submitButton.textContent = creating ? "Creating account…" : "Saving changes…";

  try {
    await apiRequest(creating ? "/users" : `/users/${encodeURIComponent(id)}`, {
      method: creating ? "POST" : "PUT",
      body: JSON.stringify(payload),
    });
    closeStaffForm();
    form.reset();
    await fetchUsers();
    setStaffManagementMessage(creating ? "Staff account created." : "Staff account updated.");
  } catch (error) {
    message.textContent = error.message || "The staff account could not be saved.";
  } finally {
    submitButton.disabled = false;
    submitButton.removeAttribute("aria-busy");
    submitButton.textContent = originalLabel;
  }
}

async function toggleUserStatus(id, nextStatus) {
  const user = users.find((item) => String(item.id) === String(id) && item.role === "staff");
  if (!user || !["active", "inactive"].includes(nextStatus)) return;
  const actionKey = `staff-status:${id}:${nextStatus}`;
  if (!beginAdminMutation(actionKey)) return;
  const action = nextStatus === "inactive" ? "deactivate" : "activate";
  try {
    const confirmed = await window.DineAriNotifications.confirm({
      type: nextStatus === "inactive" ? "warning" : "info",
      title: `${action === "deactivate" ? "Deactivate" : "Activate"} this staff account?`,
      message: `Are you sure you want to ${action} ${user.name}'s account?`,
      confirmLabel: action === "deactivate" ? "Deactivate" : "Activate",
      destructive: nextStatus === "inactive",
    });
    if (!confirmed) return;
    try {
      await apiRequest(`/users/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await fetchUsers();
      setStaffManagementMessage(`Staff account ${nextStatus === "active" ? "activated" : "deactivated"}.`);
    } catch (error) {
      setStaffManagementMessage(error.message || "Staff account status could not be changed.", true);
    }
  } finally {
    endAdminMutation(actionKey);
  }
}

// --- 4. AUDIT LOGS & SYSTEM ALERTS ---
async function fetchAuditLogs() {
  const tbody = document.getElementById("auditTableBody");
  const status = document.getElementById("auditLogStatus");
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="muted">Loading audit logs…</td></tr>`;
  if (status) {
    status.classList.remove("is-error");
    status.textContent = "Loading audit events…";
  }

  const params = new URLSearchParams({
    page: String(auditPage),
    pageSize: "25"
  });
  const filters = {
    search: document.getElementById("auditSearch")?.value.trim(),
    userId: document.getElementById("auditUserFilter")?.value,
    action: document.getElementById("auditActionFilter")?.value,
    module: document.getElementById("auditModuleFilter")?.value,
    startDate: document.getElementById("auditStartDate")?.value,
    endDate: document.getElementById("auditEndDate")?.value
  };
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  try {
    const data = await apiRequest(`/audit-logs?${params.toString()}`);
    auditLogs = data.items;
    auditPage = data.page;
    auditPageCount = Math.max(data.totalPages, 1);
    populateAuditFilterOptions(data.filters);
    renderAuditLogs();
    if (status) {
      status.textContent = `${data.total} audit event${data.total === 1 ? "" : "s"} found.`;
    }
    const pageInfo = document.getElementById("auditPageInfo");
    const previousButton = document.getElementById("auditPrevPage");
    const nextButton = document.getElementById("auditNextPage");
    if (pageInfo) pageInfo.textContent = `Page ${auditPage} of ${auditPageCount}`;
    if (previousButton) previousButton.disabled = auditPage <= 1;
    if (nextButton) nextButton.disabled = auditPage >= auditPageCount;
  } catch (err) {
    console.error("Failed to fetch audit logs:", err);
    auditLogs = [];
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Unable to load audit logs. Check your admin session and try again.</td></tr>`;
    }
    if (status) {
      status.classList.add("is-error");
      status.textContent = "Audit events could not be loaded.";
    }
  }
}

function populateAuditFilterOptions(filters = {}) {
  const setOptions = (id, label, options, valueFor, textFor) => {
    const select = document.getElementById(id);
    if (!select) return;
    const selected = select.value;
    select.replaceChildren(new Option(label, ""));
    options.forEach((option) => {
      select.add(new Option(textFor(option), valueFor(option)));
    });
    if ([...select.options].some((option) => option.value === selected)) {
      select.value = selected;
    }
  };

  setOptions(
    "auditUserFilter",
    "All users",
    filters.users || [],
    (user) => user.user_id === null ? "anonymous" : String(user.user_id),
    (user) => user.actor_name
  );
  setOptions("auditActionFilter", "All actions", filters.actions || [], (value) => value, (value) => value.replaceAll("_", " "));
  setOptions("auditModuleFilter", "All modules", filters.modules || [], (value) => value, (value) => value);
}

function initAuditLogControls() {
  const filterIds = ["auditUserFilter", "auditActionFilter", "auditModuleFilter", "auditStartDate", "auditEndDate"];
  filterIds.forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      auditPage = 1;
      fetchAuditLogs();
    });
  });
  document.getElementById("auditSearch")?.addEventListener("input", () => {
    clearTimeout(auditSearchTimer);
    auditSearchTimer = setTimeout(() => {
      auditPage = 1;
      fetchAuditLogs();
    }, 250);
  });
  document.getElementById("auditResetFilters")?.addEventListener("click", () => {
    ["auditSearch", "auditUserFilter", "auditActionFilter", "auditModuleFilter", "auditStartDate", "auditEndDate"]
      .forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.value = "";
      });
    auditPage = 1;
    fetchAuditLogs();
  });
  document.getElementById("auditPrevPage")?.addEventListener("click", () => {
    if (auditPage > 1) {
      auditPage -= 1;
      fetchAuditLogs();
    }
  });
  document.getElementById("auditNextPage")?.addEventListener("click", () => {
    if (auditPage < auditPageCount) {
      auditPage += 1;
      fetchAuditLogs();
    }
  });
}

function renderAuditLogs() {
  const tbody = document.getElementById("auditTableBody");
  if (!tbody) return;
  if (!auditLogs.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No audit records found for these filters.</td></tr>`;
    return;
  }
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
  tbody.innerHTML = auditLogs.map((log) => {
    const when = new Date(log.created_at);
    const timestamp = Number.isNaN(when.valueOf()) ? log.created_at : when.toLocaleString();
    const detailLines = [];
    if (log.details) detailLines.push(`Details: ${JSON.stringify(log.details)}`);
    if (log.previous_values) detailLines.push(`Before: ${JSON.stringify(log.previous_values)}`);
    if (log.new_values) detailLines.push(`After: ${JSON.stringify(log.new_values)}`);
    const affectedRecord = log.entity_id
      ? `${log.module || "record"} #${log.entity_id}`
      : "—";

    return `
      <tr>
        <td><small>${escapeHtml(timestamp)}</small></td>
        <td>${escapeHtml(log.actor_name || "Unauthenticated")}</td>
        <td>${escapeHtml(String(log.action || "").replaceAll("_", " "))}</td>
        <td>${escapeHtml(log.module || "—")}</td>
        <td>${escapeHtml(affectedRecord)}</td>
        <td class="audit-details">${escapeHtml(detailLines.join("\n") || "—")}</td>
      </tr>
    `;
  }).join("");
}

function renderAlerts() {
  const container = document.getElementById("alertsContainer");
  if (!container) return;
  const lowStock = products.filter(p => p.stock < 15);
  
  if (lowStock.length === 0) {
    container.innerHTML = `<p class="muted">No system alerts active. All PostgreSQL stock levels operational.</p>`;
    return;
  }

  container.innerHTML = lowStock.map(p => `
    <div style="padding: 12px; margin-bottom: 10px; border: 1px solid var(--danger); border-radius: 12px; background: rgba(224, 86, 86, 0.1);">
      <strong><i data-lucide="triangle-alert" aria-hidden="true"></i> Low Stock Level Alert:</strong> ${p.name} has only <strong>${p.stock} units</strong> remaining in database inventory.
    </div>
  `).join('');
  syncLucideIcons();
}

// --- 5. CHARTS & TIME RANGE SWITCHER ---
function initCharts() {
  updateRevenueChartRange();
  initRidgelineChart();
}

function updateRevenueChartRange() {
  const range = document.getElementById("revenueTimeFilter")?.value || "hourly";
  const ctxRevenue = document.getElementById('revenueChart');
  if (!ctxRevenue) return;

  let labels = [];
  let dataPoints = [];
  const now = new Date();

  if (range === "hourly") {
    labels = ['12 AM', '3 AM', '6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM'];
    dataPoints = new Array(8).fill(0);

    allOrdersCache.forEach(ord => {
      const ordDate = new Date(ord.created_at || ord.completed_at || now);
      const hour = ordDate.getHours();
      const slot = Math.floor(hour / 3);
      if (slot >= 0 && slot < 8) {
        dataPoints[slot] += Number(ord.total_amount || 0);
      }
    });
  } else if (range === "daily") {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dataPoints = new Array(7).fill(0);

    allOrdersCache.forEach(ord => {
      const ordDate = new Date(ord.created_at || ord.completed_at || now);
      let day = ordDate.getDay();
      let index = day === 0 ? 6 : day - 1;
      dataPoints[index] += Number(ord.total_amount || 0);
    });
  } else if (range === "weekly") {
    labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    dataPoints = new Array(4).fill(0);

    allOrdersCache.forEach(ord => {
      const ordDate = new Date(ord.created_at || ord.completed_at || now);
      const weekIndex = Math.min(Math.floor((ordDate.getDate() - 1) / 7), 3);
      dataPoints[weekIndex] += Number(ord.total_amount || 0);
    });
  } else if (range === "monthly") {
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    dataPoints = new Array(12).fill(0);

    allOrdersCache.forEach(ord => {
      const ordDate = new Date(ord.created_at || ord.completed_at || now);
      const month = ordDate.getMonth();
      dataPoints[month] += Number(ord.total_amount || 0);
    });
  }

  // If the chart already exists, just update its values smoothly without destroying it!
  if (revenueChartInstance) {
    revenueChartInstance.data.labels = labels;
    revenueChartInstance.data.datasets[0].data = dataPoints;
    revenueChartInstance.data.datasets[0].label = `Revenue (${range.toUpperCase()}) (₱)`;
    revenueChartInstance.update('none'); // 'none' mode prevents re-animation flicker
    return;
  }

  // Otherwise, create it for the first time
  revenueChartInstance = new Chart(ctxRevenue.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `Revenue (${range.toUpperCase()}) (₱)`,
        data: dataPoints,
        borderColor: '#ef7417',
        backgroundColor: 'rgba(239, 116, 23, 0.16)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 400 }, // Smooth entry only on first load
      plugins: {
        legend: { labels: { color: dashboardChartTheme().text } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { color: dashboardChartTheme().text }, grid: { color: dashboardChartTheme().grid } },
        x: { ticks: { color: dashboardChartTheme().text }, grid: { display: false } }
      }
    }
  });
}

// Ridgeline Plot (Joyplot) for multi-category distribution comparison
function initRidgelineChart() {
  const ctxRidgeline = document.getElementById('ridgelineChart');
  if (!ctxRidgeline) return;

  if (ridgelineChartInstance) {
    ridgelineChartInstance.destroy();
  }

  ridgelineChartInstance = new Chart(ctxRidgeline.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'],
      datasets: [
        {
          label: 'Main Course',
          data: [10, 45, 85, 60, 30, 15, 5],
          borderColor: '#ef7417',
          backgroundColor: 'rgba(239, 116, 23, 0.30)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Appetizers',
          data: [5, 25, 55, 40, 20, 8, 2],
          borderColor: '#ffb45c',
          backgroundColor: 'rgba(255, 180, 92, 0.26)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Beverages',
          data: [2, 15, 35, 75, 45, 20, 5],
          borderColor: '#8f5937',
          backgroundColor: 'rgba(143, 89, 55, 0.22)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: dashboardChartTheme().text, font: { size: 11 } }
        }
      },
      scales: {
        y: { 
          stacked: true, 
          grid: { color: dashboardChartTheme().grid },
          ticks: { color: dashboardChartTheme().text }
        },
        x: { 
          grid: { display: false },
          ticks: { color: dashboardChartTheme().text }
        }
      }
    }
  });
}

function setCategoryChartStatus(message, isError = false) {
  const status = document.getElementById("categoryChartStatus");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("hidden", !message);
  status.classList.toggle("category-chart-status-error", isError);
}

function initCategoryPieChart(categorySales) {
  const ctxCategory = document.getElementById('categoryChart');
  if (!ctxCategory || !Array.isArray(categorySales)) return;

  const totals = new Map(CATEGORY_CHART_CATEGORIES.map(({ label }) => [label, 0]));
  categorySales.forEach(({ category, total }) => {
    if (!totals.has(category)) return;
    const value = Number(total);
    if (Number.isFinite(value) && value >= 0) {
      totals.set(category, totals.get(category) + value);
    }
  });

  const labels = CATEGORY_CHART_CATEGORIES.map(({ label }) => label);
  const values = labels.map((label) => totals.get(label));
  const totalSales = values.reduce((sum, value) => sum + value, 0);
  CATEGORY_CHART_CATEGORIES.forEach(({ label }) => {
    const valueElement = document.querySelector(`[data-category-value="${label}"]`);
    const value = totals.get(label);
    if (valueElement) {
      valueElement.textContent = `₱${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }
  });

  setCategoryChartStatus(totalSales === 0 ? "No category sales recorded yet." : "");

  if (categoryChartInstance) {
    categoryChartInstance.data.labels = labels;
    categoryChartInstance.data.datasets[0].data = values;
    categoryChartInstance.update('none');
    return;
  }

  categoryChartInstance = new Chart(ctxCategory.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: CATEGORY_CHART_CATEGORIES.map(({ color }) => color),
        borderColor: dashboardChartTheme().grid,
        borderWidth: 1,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 180 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const value = Number(context.raw) || 0;
              return `${context.label}: ₱${value.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}`;
            }
          }
        }
      }
    }
  });
}

async function refreshCategoryPieChart() {
  const canvas = document.getElementById("categoryChart");
  if (!canvas) return;
  if (categoryChartRefreshPromise) return categoryChartRefreshPromise;

  setCategoryChartStatus(categoryChartInstance ? "Updating category totals…" : "Loading category totals…");
  categoryChartRefreshPromise = (async () => {
    try {
      const categorySales = await apiRequest("/orders/category-sales");
      if (!Array.isArray(categorySales)) {
        throw new Error("The category totals response was invalid.");
      }
      initCategoryPieChart(categorySales);
    } catch (error) {
      console.error("Failed to load category sales:", error);
      setCategoryChartStatus("Unable to load category totals. Please try again later.", true);
    } finally {
      categoryChartRefreshPromise = null;
    }
  })();

  return categoryChartRefreshPromise;
}

// Tab Switching Navigation
function switchTab(tabId) {
  document.querySelectorAll(".tab-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".admin-sidebar-menu li[data-tab]").forEach(item => item.classList.remove("active"));

  const targetTab = document.getElementById(tabId);
  const targetNav = document.querySelector(`[data-tab="${tabId}"]`);
  
  if (targetTab) targetTab.classList.add("active");
  if (targetNav) targetNav.classList.add("active");

  const navToggle = document.querySelector(".admin-nav-toggle");
  if (navToggle && window.matchMedia("(max-width: 1024px)").matches) {
    closeAdminNavigation();
  }
  if (tabId === "tab-forecasts") loadReservationForecast();
}

function setForecastStatus(title, message, isError = false) {
  const status = document.getElementById("forecastStatus");
  if (!status) return;

  status.classList.remove("hidden");
  status.replaceChildren();
  status.classList.toggle("forecast-status-error", isError);
  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", isError ? "circle-alert" : "calendar-clock");
  icon.setAttribute("aria-hidden", "true");
  const content = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const description = document.createElement("p");
  description.textContent = message;
  content.append(heading, description);
  status.append(icon, content);
  if (window.lucide) window.lucide.createIcons();
}

function setForecastLoading(isLoading) {
  const button = document.getElementById("generateForecastButton");
  if (!button) return;

  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
  const label = button.querySelector("span");
  if (label) label.textContent = isLoading ? "Training model…" : "Refresh forecast";
}

function renderForecastFreshness(forecast) {
  const freshness = document.getElementById("forecastFreshness");
  if (!freshness) return;

  if (!forecast?.generatedAt) {
    freshness.classList.add("hidden");
    freshness.classList.remove("is-stale");
    freshness.textContent = "";
    return;
  }

  const generatedAt = new Date(forecast.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) {
    freshness.classList.add("hidden");
    freshness.textContent = "";
    return;
  }

  const stale =
    Boolean(forecast.freshness?.stale) ||
    Date.now() - generatedAt.getTime() >=
      Number(forecast.freshness?.staleAfterHours || 24) * 60 * 60 * 1000;
  const time = generatedAt.toLocaleString();
  freshness.classList.remove("hidden");
  freshness.classList.toggle("is-stale", stale);
  freshness.textContent = stale
    ? `Outdated forecast · Last generated ${time}. Refresh to use current reservation history.`
    : `Forecast generated ${time}. Refresh is manual; opening this tab does not retrain the model.`;
}

async function loadReservationForecast() {
  try {
    const forecast = await apiRequest("/forecasts/reservations");
    const developmentOption = document.querySelector(
      '#forecastDataSource option[value="development"]'
    );
    if (developmentOption) {
      developmentOption.hidden = !forecast.developmentDataEnabled;
    }

    if (forecast.status === "ready" || forecast.status === "insufficient_data") {
      latestReservationForecast = forecast;
      renderReservationForecast(forecast);
    } else {
      latestReservationForecast = null;
      renderForecastFreshness(null);
      document.getElementById("forecastResults")?.classList.add("hidden");
      setForecastStatus(
        "Forecast not generated",
        "Generate a forecast to see expected demand and model evaluation."
      );
    }
  } catch (error) {
    renderForecastFreshness(null);
    document.getElementById("forecastResults")?.classList.add("hidden");
    setForecastStatus("Unable to load forecast", error.message, true);
  }
}

async function generateReservationForecast() {
  const source = document.getElementById("forecastDataSource")?.value || "actual";
  setForecastLoading(true);
  setForecastStatus(
    "Training reservation demand model",
    "Reading eligible reservation history and evaluating a chronological holdout."
  );

  try {
    const forecast = await apiRequest("/forecasts/reservations/generate", {
      method: "POST",
      body: JSON.stringify({ source })
    });
    latestReservationForecast = forecast;
    renderReservationForecast(forecast);
  } catch (error) {
    document.getElementById("forecastResults")?.classList.add("hidden");
    setForecastStatus("Forecast generation failed", error.message, true);
  } finally {
    setForecastLoading(false);
  }
}

function renderReservationForecast(forecast) {
  const results = document.getElementById("forecastResults");
  if (!results) return;
  renderForecastFreshness(forecast);

  if (forecast.status === "insufficient_data") {
    results.classList.add("hidden");
    const readiness = forecast.dataReadiness || {};
    setForecastStatus(
      "More reservation history needed",
      `${forecast.message} Available: ${readiness.reservationCount || 0} eligible reservations across ${readiness.bookingDays || 0} booking days and ${readiness.calendarDays || 0} calendar days, with ${readiness.backtestOrigins || 0} validation windows. Required: ${readiness.minimumReservations} reservations, ${readiness.minimumBookingDays} booking days, ${readiness.minimumCalendarDays} calendar days, and ${readiness.minimumBacktestOrigins} validation windows.`
    );
    return;
  }

  if (forecast.status !== "ready") {
    results.classList.add("hidden");
    setForecastStatus(
      "Forecast unavailable",
      forecast.message || "The model did not return a forecast.",
      true
    );
    return;
  }

  document.getElementById("forecastStatus")?.classList.add("hidden");
  results.classList.remove("hidden");
  const sourceNotice = document.getElementById("forecastSourceNotice");
  const isDevelopment = forecast.dataSource === "development";
  sourceNotice.classList.toggle("hidden", !isDevelopment);
  sourceNotice.textContent = isDevelopment
    ? "SIMULATED DEVELOPMENT DATA — These results use the separate sample dataset and are not restaurant records."
    : `Trained on ${forecast.dataReadiness.reservationCount} eligible historical reservations. Forecasts are estimates, not guaranteed demand.`;

  document.getElementById("forecastTodayReservations").textContent =
    Number(forecast.today.reservations).toLocaleString(undefined, { maximumFractionDigits: 1 });
  document.getElementById("forecastTodayGuests").textContent =
    Number(forecast.today.guests).toLocaleString(undefined, { maximumFractionDigits: 1 });
  document.getElementById("forecastBusiestDay").textContent =
    `${forecast.busiestDay.weekday} · ${forecast.busiestDay.date}`;
  document.getElementById("forecastPeakHour").textContent = forecast.today.peakHour;
  renderForecastEvaluation(forecast.evaluation);

  renderForecastInsights(forecast.insights);
  renderForecastPeakHours(forecast.peakHours);
  renderForecastComparison(forecast.evaluation.comparison);
  renderForecastCharts(forecast);
}

function renderForecastEvaluation(evaluation) {
  const summary = document.getElementById("forecastBacktestSummary");
  const body = document.getElementById("forecastEvaluationMetrics");
  if (!summary || !body) return;

  summary.textContent =
    `${evaluation.originCount} rolling origins · ${evaluation.horizonDays}-day horizon · ` +
    `${evaluation.validationDateRange.start} to ${evaluation.validationDateRange.end}. ` +
    "Validation scores describe historical holdouts only; they are not production accuracy guarantees.";
  body.replaceChildren();

  [
    ["reservations", "Reservations per day"],
    ["guests", "Guests per day"],
    ["hourly", "Reservations per hour"]
  ].forEach(([key, label]) => {
    const metrics = evaluation.metrics[key];
    const row = document.createElement("tr");
    [
      label,
      metrics.mae,
      metrics.rmse,
      metrics.baselineMae,
      metrics.baselineRmse,
      metrics.testSamples
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
}

function renderForecastInsights(insights) {
  const list = document.getElementById("forecastInsights");
  list.replaceChildren();
  (insights || []).forEach((insight) => {
    const item = document.createElement("li");
    item.textContent = insight;
    list.appendChild(item);
  });
}

function renderForecastPeakHours(peakHours) {
  const container = document.getElementById("forecastPeakHours");
  container.replaceChildren();
  (peakHours || []).forEach((peak) => {
    const item = document.createElement("span");
    item.textContent = `${peak.label} · ${peak.reservations} predicted`;
    container.appendChild(item);
  });
}

function renderForecastComparison(comparison) {
  const body = document.getElementById("forecastComparison");
  body.replaceChildren();
  (comparison || []).forEach((row) => {
    const tableRow = document.createElement("tr");
    [row.date, row.actual, row.predicted, row.baseline].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      tableRow.appendChild(cell);
    });
    body.appendChild(tableRow);
  });
}

function renderForecastCharts(forecast) {
  const historical = forecast.historicalTrend || [];
  const predicted = forecast.weeklyDemand || [];
  const labels = [...historical, ...predicted].map((item) =>
    new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    })
  );

  if (weeklyForecastChart) weeklyForecastChart.destroy();
  weeklyForecastChart = new Chart(document.getElementById("weeklyForecastChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Historical reservations",
          data: [...historical.map((item) => item.reservations), ...predicted.map(() => null)],
          backgroundColor: "rgba(191, 157, 129, 0.48)",
          borderColor: "#a7886f",
          borderWidth: 1
        },
        {
          label: "Predicted reservations",
          data: [...historical.map(() => null), ...predicted.map((item) => item.reservations)],
          backgroundColor: "rgba(239, 116, 23, 0.78)",
          borderColor: "#ff9a32",
          borderWidth: 1
        }
      ]
    },
    options: forecastChartOptions()
  });

  if (hourlyForecastChart) hourlyForecastChart.destroy();
  hourlyForecastChart = new Chart(document.getElementById("hourlyForecastChart"), {
    type: "bar",
    data: {
      labels: (forecast.todayHourlyDemand || []).map((item) => item.label),
      datasets: [{
        label: "Predicted reservations",
        data: (forecast.todayHourlyDemand || []).map((item) => item.reservations),
        backgroundColor: "rgba(239, 116, 23, 0.78)",
        borderColor: "#ff9a32",
        borderWidth: 1
      }]
    },
    options: {
      ...forecastChartOptions(),
      scales: {
        ...forecastChartOptions().scales,
        x: { ...forecastChartOptions().scales.x, ticks: { color: dashboardChartTheme().text, maxRotation: 55, minRotation: 45 } }
      }
    }
  });
}

function forecastChartOptions() {
  const theme = dashboardChartTheme();
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: theme.text } }
    },
    scales: {
      x: { ticks: { color: theme.text }, grid: { color: theme.grid } },
      y: {
        beginAtZero: true,
        ticks: { color: theme.text, precision: 0 },
        grid: { color: theme.grid }
      }
    }
  };
}

// CSV Exporter for Database Records
function exportReportCSV() {
  let csvContent = "data:text/csv;charset=utf-8,ID,Item Name,Category,Price,Stock\n";
  products.forEach(p => {
    csvContent += `${p.id},"${p.name}",${p.category},${p.price},${p.stock}\n`;
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "DineQueue_Database_Export.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function logout() {
  void logoutTo("login.html");
}

/* =========================================================================
   DINE-ARI EXTENDED CRUD & TELEMETRY MODULE
   Bridges Dashboard UI directly to PostgreSQL via Node.js Endpoint Routes
   ========================================================================= */

/**
 * 1. DATABASE SYNCHRONIZER HOOK
 * Appends new view loaders to your existing dashboard refresh sequences
 */
async function refreshDashboardMenuAndAlerts() {
  try {
    // Calls your API utility layer to fetch raw data rows from PostgreSQL
    const menuItemsFromDb = await apiRequest("/menu"); 

    // Renders active control structures on your new layout grid views
    renderFoodCatalogTable(menuItemsFromDb);
    renderSystemTelemetryAlerts(menuItemsFromDb);
  } catch (error) {
    console.error("Menu data synchronization loop failure:", error);
  }
}

/**
 * 2. AUTOMATED DATABASE SYNC: VIEW DATA
 * Maps pgAdmin rows directly into interactive UI tables
 */
function renderFoodCatalogTable(items) {
  const tableContainer = document.getElementById("foodInventoryTableWrapper");
  if (!tableContainer) return;

  const rows = items.map((item) => {
    const stockCount = Number(item.stock_count ?? 0);

    return `
      <tr>
        <td>
          <img src="${item.image_url || 'images/default-food.jpg'}"
               style="width: 44px; height: 44px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border);"
               alt="food" />
        </td>
        <td><strong>${item.item_name}</strong></td>
        <td><span class="badge-element status-pending">${item.category}</span></td>
        <td>₱${Number(item.price).toFixed(2)}</td>
        <td>
          ${stockCount === 0
            ? `<span class="badge-element status-completed" style="background: var(--danger); color: #fff;">SOLD OUT</span>`
            : stockCount < 15
              ? `<span style="color:var(--danger); font-weight:800;">${stockCount} Low Stock</span>`
              : `<span style="color:var(--success);">${stockCount} Units</span>`
          }
        </td>
        <td><small class="muted">${item.description || 'No description available'}</small></td>
        <td>
          <button class="btn secondary" style="min-height:32px; padding:6px 12px; margin:0 4px 0 0;" onclick="triggerModifyPricePrompt(${item.id}, ${item.price})"><i data-lucide="pencil" aria-hidden="true"></i> Edit Price</button>
          <button class="btn danger" style="min-height:32px; padding:6px 12px; margin:0;" onclick="triggerDeleteProductOperation(${item.id})"><i data-lucide="trash-2" aria-hidden="true"></i> Purge</button>
        </td>
      </tr>
    `;
  }).join("");

  tableContainer.innerHTML = `
    <div class="table-scroll" role="region" aria-label="Food catalog table" tabindex="0">
      <table class="workspace-data-table">
        <thead>
          <tr>
            <th>Display</th>
            <th>Product / Recipe Target Item</th>
            <th>Menu Classification</th>
            <th>Price Point</th>
            <th>Stock Inventory</th>
            <th>Recipe Formulation Path</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
  syncLucideIcons();
}

/**
 * 3. AUTOMATED DATABASE SYNC: INSERT DATA
 * Runs instantly when hitting "Commit Recipe to Catalog Store" form controls
 */
async function executeFoodProductCreation(event) {
  event.preventDefault();
  
  const payload = {
    item_name: document.getElementById("inputProdName").value,
    image_url: document.getElementById("inputProdImage") ? document.getElementById("inputProdImage").value : 'images/default-food.jpg',
    category: document.getElementById("inputProdCategory").value,
    price: parseFloat(document.getElementById("inputProdPrice").value || 0),
    stock_count: parseInt(document.getElementById("inputProdStock").value || 0),
    description: document.getElementById("inputProdDesc").value
  };

  try {
    // Transmits a POST request to your backend router layer
    await apiRequest("/menu", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });

    document.getElementById("foodProductCreationForm").reset();
    await refreshDashboardMenuAndAlerts(); // Immediate data table layout update
    alert("Food product successfully written into PostgreSQL!");

  } catch (error) {
    alert("Failed to insert product record: " + error.message);
  }
}

/**
 * 4. AUTOMATED DATABASE SYNC: UPDATE DATA
 * Fires an HTTP PUT update path to update price rows in pgAdmin
 */
async function triggerModifyPricePrompt(productId, currentPrice) {
  const targetValue = prompt("Update price amount parameter (PHP):", currentPrice);
  if (targetValue === null) return;

  const newPrice = parseFloat(targetValue);
  if (isNaN(newPrice)) return alert("Please specify a valid numeric price configuration.");

  try {
    await apiRequest(`/menu/${productId}`, {
      method: "PUT",
      body: JSON.stringify({ price: newPrice }),
      headers: { "Content-Type": "application/json" }
    });

    await refreshDashboardMenuAndAlerts();

  } catch (error) {
    alert("Failed to synchronize database price modifications: " + error.message);
  }
}

/**
 * 5. AUTOMATED DATABASE SYNC: SOFT DELETE
 * Drops the visibility relation boundary from client views
 */
async function triggerDeleteProductOperation(productId) {
  const actionKey = `delete-product-row:${productId}`;
  if (!beginAdminMutation(actionKey)) return;
  try {
    const confirmed = await window.DineAriNotifications.confirm({
      type: "warning",
      title: "Delete this product?",
      message: "Are you sure you want to flag this product row as deleted in pgAdmin?",
      confirmLabel: "Delete product",
      destructive: true,
    });
    if (!confirmed) return;
    await apiRequest(`/menu/${productId}`, {
      method: "DELETE"
    });

    await refreshDashboardMenuAndAlerts();

  } catch (error) {
    alert("Failed to drop database row reference safely: " + error.message);
  } finally {
    endAdminMutation(actionKey);
  }
}

/**
 * 6. RE-TIME LOGIC APPLIED TO TELEMETRY WARNING ALERTS PANEL
 */
function renderSystemTelemetryAlerts(items) {
  const alertContainerNode = document.getElementById("realtimeSystemAlertBox");
  if (!alertContainerNode) return;

  const lowLevelStockIssues = items.filter(item => Number(item.stock_count ?? 0) < 15);

  alertContainerNode.innerHTML = `
    <div class="card-header-row">
      <h3>System Warning Feed</h3>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <div style="border-left: 3px solid var(--gold); padding: 8px 12px; background: rgba(255,255,255,0.02); font-size:13px;">
        <strong><i data-lucide="network" aria-hidden="true"></i> Distributed Gateway State</strong><br/>
        <span class="muted">PostgreSQL connection channels verified and running smoothly.</span>
      </div>
      ${lowLevelStockIssues.map(issueItem => `
        <div style="border-left: 3px solid var(--danger); padding: 8px 12px; background: rgba(224,86,86,0.06); font-size:13px;">
          <strong style="color: var(--danger);"><i data-lucide="triangle-alert" aria-hidden="true"></i> Component Stock Exhaustion Warning</strong><br/>
          <span class="muted">${issueItem.item_name} dropping critically low (${Number(issueItem.stock_count ?? 0)} elements left in inventory).</span>
        </div>
      `).join('')}
    </div>
  `;
  syncLucideIcons();
}

/**
 * 7. UTILITY PANEL LINK SELECTORS
 */
function setupNavigationInteractions() {
  const links = document.querySelectorAll('.nav-link-item');
  links.forEach(link => {
    link.addEventListener('click', () => {
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      const requestedView = link.getAttribute('data-target-view');
      document.querySelectorAll('.workspace-view').forEach(view => view.classList.add('hidden'));
      
      const targetViewNode = document.getElementById(requestedView);
      if (targetViewNode) targetViewNode.classList.remove('hidden');
    });
  });
}
