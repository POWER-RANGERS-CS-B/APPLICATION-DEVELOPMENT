const API_BASE = "http://192.168.43.118:3000/api";

async function loadReceipt() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const token = params.get("token");

    const receiptContent = document.getElementById("receiptContent");

    if (!code || !token) {
        receiptContent.innerHTML = `<p class="muted">Invalid receipt link.</p>`;
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/orders/receipt?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Receipt not found.");
        }

        receiptContent.innerHTML = `
      <div class="official-receipt">
        <h2>DineQueue Official Receipt</h2>

        <div class="receipt-info-grid">
          <p><strong>Order Number:</strong> ${data.order_code}</p>
          <p><strong>Customer:</strong> ${data.full_name || "Customer"}</p>
          <p><strong>Order Type:</strong> ${String(data.type).replace("_", " ").toUpperCase()}</p>
          <p><strong>Payment Method:</strong> ${data.payment_method || "Cash"}</p>
          <p><strong>Payment Status:</strong> ${String(data.payment_status || "paid").toUpperCase()}</p>
          <p><strong>Date:</strong> ${new Date(data.created_at).toLocaleString()}</p>
        </div>

        <hr>

        <h3>Order Breakdown</h3>

        <table class="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Subtotal</th>
            </tr>
          </thead>

          <tbody>
            ${data.items.map(item => `
              <tr>
                <td>${item.item_name}</td>
                <td>${item.quantity}</td>
                <td>₱${Number(item.unit_price).toFixed(2)}</td>
                <td>₱${Number(item.subtotal).toFixed(2)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <h2 class="receipt-total">
          Total: ₱${Number(data.total_amount).toFixed(2)}
        </h2>
      </div>
    `;
    } catch (error) {
        receiptContent.innerHTML = `<p class="muted">${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", loadReceipt);