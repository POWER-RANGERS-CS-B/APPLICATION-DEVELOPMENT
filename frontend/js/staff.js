window.addEventListener("load", () => {
  loadKds();
  loadReservations();
  setInterval(loadKds, 5000);
  setInterval(loadReservations, 15000);
});

async function loadKds() {
  try {
    const orders = await apiRequest("/staff/kds");

    document.getElementById("kdsOrders").innerHTML = orders.length
      ? orders
          .map(
            (order) => `
              <div class="panel kds-order-card">
                <h2>Order #${order.order_code}</h2>
                <p>Status: <span class="status-badge status-${order.status}">${String(order.status).toUpperCase()}</span></p>
                <p>Total: ₱${Number(order.total_amount).toFixed(2)}</p>
                <button onclick="updateOrderStatus(${order.id}, 'preparing')">Preparing</button>
                <button onclick="updateOrderStatus(${order.id}, 'ready')">Ready</button>
                <button onclick="updateOrderStatus(${order.id}, 'completed')">Completed</button>
              </div>
            `
          )
          .join("")
      : `<p class="muted">No orders to prepare.</p>`;
  } catch (error) {
    document.getElementById("kdsOrders").innerHTML =
      `<p class="muted">Unable to load KDS orders. ${error.message}</p>`;
  }
}

function escapeStaffText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function loadReservations() {
  const reservationsBox = document.getElementById("staffReservations");
  const reservationsPanel = document.getElementById("staffReservationsPanel");
  if (!reservationsBox || !reservationsPanel) return;

  reservationsPanel.hidden = true;

  try {
    const reservations = await apiRequest("/reservations");
    const openReservations = reservations.filter((reservation) =>
      ["active", "confirmed", "checked_in"].includes(String(reservation.status).toLowerCase())
    );

    if (!openReservations.length) {
      reservationsBox.replaceChildren();
      return;
    }

    reservationsBox.innerHTML = openReservations.length
      ? openReservations.map((reservation) => {
          const id = Number(reservation.id);
          const status = String(reservation.status || "active").toLowerCase();
          const checkedIn = status === "checked_in";
          const statusLabel = checkedIn ? "Checked In" : "Confirmed";
          const statusClass = checkedIn ? "checked-in" : "confirmed";
          const tableName = escapeStaffText(reservation.table_name || `Table ${reservation.table_id}`);
          const customer = escapeStaffText(reservation.customer_name || reservation.full_name || "Customer");
          const contact = escapeStaffText(reservation.contact_number || "N/A");
          const guests = escapeStaffText(reservation.num_guests || "N/A");
          const date = escapeStaffText(String(reservation.reservation_date || "").slice(0, 10) || "N/A");
          const time = escapeStaffText(String(reservation.reservation_time || "").slice(0, 5) || "N/A");
          const actions = checkedIn
            ? `<button type="button" onclick="updateReservationStatus(${id}, 'completed')">Complete</button>`
            : `<button type="button" onclick="updateReservationStatus(${id}, 'checked_in')">Check In</button>
               <button type="button" class="secondary" onclick="updateReservationStatus(${id}, 'cancelled')">Cancel</button>`;

          return `
            <tr>
              <td>${tableName}</td>
              <td>${customer}</td>
              <td>${contact}</td>
              <td>${guests}</td>
              <td>${date} ${time}</td>
              <td><span class="staff-reservation-status staff-reservation-status--${statusClass}">${statusLabel}</span></td>
              <td><div class="staff-reservation-actions">${actions}</div></td>
            </tr>
          `;
        }).join("")
      : `<tr><td colspan="7" class="muted">No upcoming or active reservations.</td></tr>`;
    reservationsPanel.hidden = false;
  } catch (error) {
    reservationsBox.replaceChildren();
    console.warn("Unable to load staff reservations:", error.message);
  }
}

async function updateOrderStatus(id, status) {
  try {
    await apiRequest(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadKds();
  } catch (patchError) {
    alert(`Could not update order status: ${patchError.message}`);
  }
}

async function updateReservationStatus(id, status) {
  const label = status === "checked_in" ? "check in this guest" : `${status} this reservation`;
  if (!window.confirm(`Are you sure you want to ${label}?`)) return;

  try {
    await apiRequest(`/reservations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadReservations();
  } catch (error) {
    alert(`Could not update reservation: ${error.message}`);
  }
}

