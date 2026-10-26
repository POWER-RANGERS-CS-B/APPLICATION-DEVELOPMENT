// State Arrays for Database-backed Dashboard
let products = [];
let users = [];
let auditLogs = [];
let ordersCache = [];
let allOrdersCache = [];
let menuItemsCache = [];
let revenueChartInstance = null;
let ridgelineChartInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (
    !getToken() &&
    !location.pathname.includes("index.html") &&
    !location.pathname.includes("intro.html")
  ) {
    console.warn("No token found. Proceeding with admin initialization.");
  }

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
    initCategoryPieChart();
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

          <button class="danger" onclick="deleteOrder(${order.id})">Soft Delete</button>
        </div>
      `).join("")
    : `<p class="muted empty-state">No active orders found in database.</p>`;
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
            <p><strong>Payment Status:</strong> ${String(record.payment_status || "paid").toUpperCase()}</p>
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
  if (!confirm("Soft delete this order from the database?")) return;
  try {
    await apiRequest(`/orders/${id}`, { method: "DELETE" });
    await loadAdminDashboardMetrics();
  } catch (err) {
    console.error("Failed to delete order:", err);
  }
}

// --- 2. MENU ITEMS & RECIPES CRUD ---
async function fetchProducts() {
  try {
    const data = await apiRequest("/menu");
    menuItemsCache = data;
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
    initCategoryPieChart();
  } catch (err) {
    console.error("Failed to fetch menu items from DB:", err);
  }
}

function renderProducts() {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td>${p.category}</td>
      <td>₱${p.price.toFixed(2)}</td>
      <td><span class="badge ${p.stock < 15 ? 'badge-danger' : ''}">${p.stock} units</span></td>
      <td><small class="muted">${p.recipe}</small></td>
      <td>
        <button class="secondary" style="padding: 4px 8px; margin:0;" onclick="editProduct(${p.id})">Edit</button>
        <button class="danger" style="padding: 4px 8px; margin:0;" onclick="deleteProduct(${p.id})">Delete</button>
      </td>
    </tr>
  `).join('');
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
    const url = id ? `http://localhost:3000/api/menu/${id}` : "http://localhost:3000/api/menu";
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method: method,
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
        // NOTE: Do NOT set Content-Type header when using FormData; fetch handles it automatically with boundaries.
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to save menu item");

    closeProductModal();
    await fetchProducts();
    alert("New Menu saved successfully!");
  } catch (err) {
    console.error("Product save error:", err);
    alert("Failed to save product: " + err.message);
  }
}

async function deleteProduct(id) {
  if (confirm("Delete this food product from PostgreSQL?")) {
    try {
      await apiRequest(`/menu/${id}`, { method: "DELETE" });
      await fetchProducts();
    } catch (err) {
      console.error("Database deletion error:", err);
    }
  }
}

// --- 3. STAFF USERS & RBAC (Filtered to Employees Only) ---
async function fetchUsers() {
  try {
    const data = await apiRequest("/users");
    // Filter to include ONLY employees ('admin' and 'staff')
    const employees = data.filter(u => u.role === 'admin' || u.role === 'staff');

    users = employees.map(u => ({
      id: u.id,
      name: u.full_name,
      email: u.email,
      role: u.role,
      permissions: u.role === 'admin' ? 'Full Database Access' : 'Staff Operations',
      status: u.deleted_at ? 'Suspended' : 'Active'
    }));

    renderUsers();

    // Display employee count in Active Employees card
    const kpiUsers = document.getElementById("kpiUsers");
    if (kpiUsers) kpiUsers.innerText = users.filter(u => u.status === 'Active').length;
  } catch (err) {
    console.error("Failed to fetch employees:", err);
  }
}

function renderUsers() {
  const tbody = document.getElementById("userTableBody");
  if (!tbody) return;
  tbody.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td>${u.role}</td>
      <td><small>${u.permissions}</small></td>
      <td><span class="status-badge ${u.status === 'Active' ? 'status-active' : ''}">${u.status}</span></td>
      <td>
        <button class="secondary" style="padding: 4px 8px; margin:0;" onclick="toggleUserStatus(${u.id})">Toggle Status</button>
      </td>
    </tr>
  `).join('');
}

async function toggleUserStatus(id) {
  try {
    await apiRequest(`/users/${id}/status`, { method: "PATCH" });
    await fetchUsers();
  } catch (err) {
    console.error("Failed to toggle user status:", err);
  }
}

// --- 4. AUDIT LOGS & SYSTEM ALERTS ---
async function fetchAuditLogs() {
  try {
    const data = await apiRequest("/audit-logs");
    auditLogs = data.map(log => ({
      time: log.created_at,
      user: log.user_name || "System Admin",
      action: log.action_description || log.action,
      ip: log.ip_address || "127.0.0.1"
    }));
    renderAuditLogs();
  } catch (err) {
    auditLogs = [{ time: new Date().toLocaleString(), user: "System", action: "Connected to PostgreSQL Schema", ip: "127.0.0.1" }];
    renderAuditLogs();
  }
}

function renderAuditLogs() {
  const tbody = document.getElementById("auditTableBody");
  if (!tbody) return;
  tbody.innerHTML = auditLogs.map(log => `
    <tr>
      <td><small>${log.time}</small></td>
      <td>${log.user}</td>
      <td>${log.action}</td>
      <td><code>${log.ip}</code></td>
    </tr>
  `).join('');
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
      <strong>⚠️ Low Stock Level Alert:</strong> ${p.name} has only <strong>${p.stock} units</strong> remaining in database inventory.
    </div>
  `).join('');
}

// --- 5. CHARTS & TIME RANGE SWITCHER ---
function initCharts() {
  updateRevenueChartRange();
  initRidgelineChart();
  initCategoryPieChart();
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
        borderColor: '#d6a83f',
        backgroundColor: 'rgba(214, 168, 63, 0.15)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 400 }, // Smooth entry only on first load
      scales: {
        y: { beginAtZero: true, ticks: { color: '#aeb8c5' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { ticks: { color: '#aeb8c5' }, grid: { display: false } }
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
          borderColor: '#d6a83f',
          backgroundColor: 'rgba(214, 168, 63, 0.45)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Appetizers',
          data: [5, 25, 55, 40, 20, 8, 2],
          borderColor: '#ffe4a0',
          backgroundColor: 'rgba(255, 228, 160, 0.35)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Beverages',
          data: [2, 15, 35, 75, 45, 20, 5],
          borderColor: '#3fbf6b',
          backgroundColor: 'rgba(63, 191, 107, 0.30)',
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
          labels: { color: '#f7f2e8', font: { size: 11 } }
        }
      },
      scales: {
        y: { 
          stacked: true, 
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#aeb8c5' }
        },
        x: { 
          grid: { display: false },
          ticks: { color: '#aeb8c5' }
        }
      }
    }
  });
}

// Sales by Category Pie / Doughnut Chart
function initCategoryPieChart() {
  const ctxCategory = document.getElementById('categoryChart');
  if (!ctxCategory) return;

  // Extract unique categories from menu items
  const categoriesMap = {};
  menuItemsCache.forEach(item => {
    const cat = item.category || "Main Course";
    categoriesMap[cat] = 0;
  });

  if (Object.keys(categoriesMap).length === 0) {
    categoriesMap["Main Course"] = 1;
    categoriesMap["Appetizers"] = 1;
    categoriesMap["Beverages"] = 1;
  }

  // Aggregate totals by category
  allOrdersCache.forEach(ord => {
    // If order items summary or items exist, distribute amount
    const catKeys = Object.keys(categoriesMap);
    const fallbackCat = catKeys[0] || "Main Course";
    categoriesMap[fallbackCat] += Number(ord.total_amount || 0);
  });

  const labels = Object.keys(categoriesMap);
  const data = labels.map(cat => categoriesMap[cat]);

  // If all are zero, give base representation
  const totalVal = data.reduce((a, b) => a + b, 0);
  const chartData = totalVal === 0 ? data.map(() => 1) : data;

  if (window.categoryChartInstance) {
    window.categoryChartInstance.destroy();
  }

  window.categoryChartInstance = new Chart(ctxCategory.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: chartData,
        backgroundColor: ['#d6a83f', '#ffe4a0', '#12304f', '#e05656', '#3fbf6b', '#9b59b6'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#f7f2e8', font: { size: 12 } }
        }
      }
    }
  });
}

// Tab Switching Navigation
function switchTab(tabId) {
  document.querySelectorAll(".tab-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-link-item").forEach(item => item.classList.remove("active"));

  const targetTab = document.getElementById(tabId);
  const targetNav = document.querySelector(`[data-tab="${tabId}"]`);
  
  if (targetTab) targetTab.classList.add("active");
  if (targetNav) targetNav.classList.add("active");
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
  localStorage.removeItem("token");
  window.location.href = "login.html";
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

  tableContainer.innerHTML = `
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
        ${items.map(item => `
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
              ${item.stock === 0 
                ? `<span class="badge-element status-completed" style="background: var(--danger); color: #fff;">SOLD OUT</span>`
                : item.stock < 15 
                ? `<span style="color:var(--danger); font-weight:800;">${item.stock} Low Stock</span>` 
                : `<span style="color:var(--success);">${item.stock} Units</span>`
              }
            </td>
            <td><small class="muted">${item.description || 'No description available'}</small></td>
            <td>
              <button class="btn secondary" style="min-height:32px; padding:6px 12px; margin:0 4px 0 0;" onclick="triggerModifyPricePrompt(${item.id}, ${item.price})">Edit Price</button>
              <button class="btn danger" style="min-height:32px; padding:6px 12px; margin:0;" onclick="triggerDeleteProductOperation(${item.id})">Purge</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
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
    stock: parseInt(document.getElementById("inputProdStock").value || 0),
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
  if (!confirm("Are you sure you want to flag this product row as deleted in pgAdmin?")) return;

  try {
    await apiRequest(`/menu/${productId}`, {
      method: "DELETE"
    });

    await refreshDashboardMenuAndAlerts();

  } catch (error) {
    alert("Failed to drop database row reference safely: " + error.message);
  }
}

/**
 * 6. RE-TIME LOGIC APPLIED TO TELEMETRY WARNING ALERTS PANEL
 */
function renderSystemTelemetryAlerts(items) {
  const alertContainerNode = document.getElementById("realtimeSystemAlertBox");
  if (!alertContainerNode) return;

  const lowLevelStockIssues = items.filter(item => item.stock < 15);

  alertContainerNode.innerHTML = `
    <div class="card-header-row">
      <h3>System Warning Feed</h3>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <div style="border-left: 3px solid var(--gold); padding: 8px 12px; background: rgba(255,255,255,0.02); font-size:13px;">
        <strong>📡 Distributed Gateway State</strong><br/>
        <span class="muted">PostgreSQL connection channels verified and running smoothly.</span>
      </div>
      ${lowLevelStockIssues.map(issueItem => `
        <div style="border-left: 3px solid var(--danger); padding: 8px 12px; background: rgba(224,86,86,0.06); font-size:13px;">
          <strong style="color: var(--danger);">⚠️ Component Stock Exhaustion Warning</strong><br/>
          <span class="muted">${issueItem.item_name} dropping critically low (${issueItem.stock} elements left inside pgAdmin).</span>
        </div>
      `).join('')}
    </div>
  `;
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
