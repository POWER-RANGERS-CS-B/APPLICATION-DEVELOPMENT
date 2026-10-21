async function loadAdminDashboard() {
  try {
    const orders = await apiRequest("/orders/kds");
    const reservations = await apiRequest("/reservations");

    let history = [];
    let income = { total_income: 0 };

    try {
      history = await apiRequest("/orders/history");
    } catch (error) {
      console.warn("Order history endpoint failed:", error.message);
      history = [];
    }

    try {
      income = await apiRequest("/orders/income/today");
    } catch (error) {
      console.warn("Today income endpoint failed:", error.message);
      income = { total_income: 0 };
    }

    const orderCount = document.getElementById("orderCount");
    const reservationCount = document.getElementById("reservationCount");
    const historyCount = document.getElementById("historyCount");
    const todayIncome = document.getElementById("todayIncome");

    if (orderCount) orderCount.textContent = orders.length;
    if (reservationCount) reservationCount.textContent = reservations.length;
    if (historyCount) historyCount.textContent = history.length;
    if (todayIncome) todayIncome.textContent = Number(income.total_income || 0).toFixed(2);

    renderLiveOrders(orders);
    renderReservations(reservations);
    renderOrderHistory(history);
  } catch (error) {
    console.error("Admin dashboard error:", error);

    document.querySelectorAll("#orders, #reservations, #history").forEach((el) => {
      el.innerHTML = `<p class="muted">Unable to load data. ${error.message}</p>`;
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
    : `<p class="muted empty-state">No active orders.</p>`;
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
    : `<p class="muted empty-state">No reservations.</p>`;
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
            <p>${record.ordered_items || "No ordered item list saved."}</p>
          </div>
        </div>
      `).join("")
    : `<p class="muted empty-state">No completed order history yet.</p>`;
}

async function deleteOrder(id) {
  if (!confirm("Soft delete this order?")) return;

  await apiRequest(`/orders/${id}`, {
    method: "DELETE"
  });

  await loadAdminDashboard();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (
    !getToken() &&
    !location.pathname.includes("index.html") &&
    !location.pathname.includes("intro.html")
  ) {
    console.warn("No token found. If auth redirects are handled somewhere else, ignore this warning.");
  }

  await loadAdminDashboard();
  setInterval(loadAdminDashboard, 10000);
});