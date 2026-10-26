window.addEventListener("load", () => {
  loadKds();
  setInterval(loadKds, 5000);
});

async function loadKds() {
  try {
    const orders = await apiRequest("/staff/kds");

    document.getElementById("kdsOrders").innerHTML = orders.length
      ? orders
          .map(
            (order) => `
              <div class="panel">
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

async function updateOrderStatus(id, status) {
  try {
    await apiRequest(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  } catch (patchError) {
    await apiRequest(`/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  }

  await loadKds();
}

async function markCleaned() {
  const tableIdInput = document.getElementById("tableId");
  const tableId = tableIdInput ? tableIdInput.value.trim() : "";

  if (!tableId) {
    alert("Please enter a Table ID.");
    return;
  }

  try {
    console.log(`Sending clean request for Table ID: ${tableId}`);
    
    // Explicitly send PATCH request to clean the table
    const response = await apiRequest(`/tables/${tableId}/clean`, { 
      method: "PATCH" 
    });

    alert(response.message || `Table #${tableId} cleaned and reset successfully.`);
    tableIdInput.value = ""; // Clear input field
  } catch (error) {
    console.error("Table cleaning failed:", error);
    alert("Failed to clean table: " + error.message);
  }
}