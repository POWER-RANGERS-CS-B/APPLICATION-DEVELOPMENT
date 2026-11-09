document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("arrivalScannerStart");
  const stopButton = document.getElementById("arrivalScannerStop");
  const manualForm = document.getElementById("arrivalManualForm");
  const manualInput = document.getElementById("arrivalManualQr");
  const confirmButton = document.getElementById("arrivalConfirmButton");
  const video = document.getElementById("arrivalScannerVideo");
  const placeholder = document.getElementById("arrivalScannerPlaceholder");
  const cameraSelection = document.getElementById("arrivalCameraSelection");
  const cameraSelect = document.getElementById("arrivalCameraSelect");
  const cameraMessage = document.getElementById("arrivalCameraMessage");
  const status = document.querySelector(".arrival-scanner-live");
  const statusLabel = document.getElementById("arrivalScannerStatusLabel");
  const result = document.getElementById("arrivalScannerResult");
  const details = document.getElementById("arrivalTransactionDetails");
  const lastSuccess = document.getElementById("arrivalLastSuccess");
  const lastSuccessSummary = document.getElementById("arrivalLastSuccessSummary");
  const lastSuccessTime = document.getElementById("arrivalLastSuccessTime");

  if (!startButton || !manualForm || !video || !result) return;

  let mediaStream = null;
  let decoder = null;
  let decodeControls = null;
  let scanning = false;
  let starting = false;
  let cameraSession = 0;
  let requestInProgress = false;
  let detectedQrProcessing = false;
  let lastDetectedPayload = "";
  let lastDetectedAt = 0;
  let currentQrPayload = "";

  function setScannerStatus(value, label) {
    status.dataset.status = value;
    statusLabel.textContent = label;
  }

  function stopScanner() {
    cameraSession += 1;
    scanning = false;
    starting = false;
    if (decodeControls) {
      try {
        decodeControls.stop();
      } catch (error) {
        console.warn("Could not stop the QR decoder cleanly:", error);
      }
      decodeControls = null;
    }
    releaseStream(mediaStream);
    video.hidden = true;
    placeholder.hidden = false;
    startButton.disabled = false;
    stopButton.disabled = true;
    if (status.dataset.status === "scanning" || status.dataset.status === "starting") {
      setScannerStatus("idle", "Scanner stopped");
    }
  }

  function showCameraError(label, message) {
    stopScanner();
    setScannerStatus("error", label);
    cameraMessage.textContent = message;
    placeholder.querySelector("span").textContent = message;
  }

  function releaseStream(stream) {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    if (mediaStream === stream) mediaStream = null;
    if (video.srcObject === stream) {
      video.pause();
      video.srcObject = null;
      video.hidden = true;
      placeholder.hidden = false;
    }
  }

  function cameraErrorMessage(error, selectedDeviceId) {
    switch (error?.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Camera permission was denied or blocked. Allow camera access in your browser settings, or use manual QR input.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No camera was detected on this device. Use manual QR input instead.";
      case "NotReadableError":
      case "TrackStartError":
      case "AbortError":
        return "The camera is already in use or unavailable. Close other apps using it, then retry or use manual QR input.";
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return selectedDeviceId
          ? "The selected camera is unavailable. Choose another camera or use manual QR input."
          : "No available camera supports the requested settings. Choose another camera or use manual QR input.";
      default:
        return `The camera could not be started${error?.message ? `: ${error.message}` : "."} Use manual QR input instead.`;
    }
  }

  function stopCameraResources() {
    if (decodeControls) {
      try {
        decodeControls.stop();
      } catch (error) {
        console.warn("Could not stop the QR decoder cleanly:", error);
      }
      decodeControls = null;
    }
    releaseStream(mediaStream);
  }

  async function populateCameraOptions(stream) {
    if (!navigator.mediaDevices?.enumerateDevices || !cameraSelect || !cameraSelection) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");
      cameraSelect.replaceChildren();
      cameras.forEach((camera, index) => {
        const option = document.createElement("option");
        option.value = camera.deviceId;
        option.textContent = camera.label || `Camera ${index + 1}`;
        cameraSelect.append(option);
      });
      cameraSelection.hidden = cameras.length < 2;
      const activeDeviceId = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
      if (activeDeviceId && cameras.some((camera) => camera.deviceId === activeDeviceId)) {
        cameraSelect.value = activeDeviceId;
      }
    } catch (error) {
      console.warn("Could not enumerate cameras:", error);
      cameraSelection.hidden = true;
    }
  }

  window.stopArrivalScanner = stopScanner;

  function formatDateTime(value) {
    if (!value) return "Unavailable";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
  }

  function appendDetail(label, value) {
    if (value === null || value === undefined || value === "") return;
    const item = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    item.append(term, description);
    details.append(item);
  }

  function renderDetails(scan) {
    details.replaceChildren();
    if (!scan.transaction_type || scan.scan_status === "invalid") {
      details.hidden = true;
      return;
    }

    appendDetail("Customer", scan.customer_name);
    appendDetail(
      "Transaction",
      scan.transaction_type === "dine_in" ? "Dine-in order" : "Reservation"
    );
    appendDetail(
      scan.transaction_type === "dine_in" ? "Order number" : "Reservation number",
      scan.transaction_number
    );
    appendDetail("Table", scan.table_name);
    appendDetail("Payment status", String(scan.payment_status || "unknown").replaceAll("_", " "));
    if (scan.payment_verified_at) {
      appendDetail("Payment confirmed", formatDateTime(scan.payment_verified_at));
    }
    appendDetail("Arrival deadline", formatDateTime(scan.arrival_deadline_at));
    if (scan.transaction_type === "reservation") {
      appendDetail("Reservation date", scan.reservation_date);
      appendDetail("Reservation time", scan.reservation_time);
      appendDetail("Guests", scan.guest_count);
    }
    if (scan.transaction_type === "dine_in" && scan.is_late) {
      appendDetail("Refund amount", `₱${Number(scan.refund_amount || 0).toFixed(2)}`);
    }
    if (scan.arrived_at) {
      appendDetail("Arrival confirmed", formatDateTime(scan.arrived_at));
    }
    details.hidden = details.childElementCount === 0;
  }

  function renderResult(scan) {
    const labels = {
      valid: ["circle-check", "Ready to confirm", scan.message],
      confirmed: ["badge-check", "Arrival confirmed", scan.message],
      already_checked_in: ["badge-check", "Already checked in", scan.message],
      already_used: ["ban", "QR Code Already Used", scan.message],
      pending_payment: ["triangle-alert", "Payment not verified", scan.message],
      expired: ["clock-alert", "Expired transaction", scan.message],
      cancelled: ["ban", "Cancelled transaction", scan.message],
      not_found: ["circle-help", "Transaction not found", scan.message],
      invalid: ["circle-alert", "Invalid QR code", scan.message],
      error: ["triangle-alert", "Scanner error", scan.message],
    };
    const [iconName, heading, body] = labels[scan.scan_status] || labels.invalid;
    result.dataset.status = scan.scan_status;
    result.className = `arrival-scanner-result${scan.scan_status === "idle" ? " is-idle" : ""}`;
    if (scan.scan_status === "confirmed") {
      result.classList.add("arrival-scan-success");
      window.setTimeout(() => result.classList.remove("arrival-scan-success"), 750);
    }
    result.replaceChildren();
    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", iconName);
    icon.setAttribute("aria-hidden", "true");
    const title = document.createElement("strong");
    title.textContent = heading;
    if (scan.scan_status === "confirmed" && scan.is_late && scan.transaction_type === "dine_in") {
      const warning = document.createElement("strong");
      warning.className = "arrival-late-warning";
      warning.textContent = "Late — Need to Refund";
      result.append(icon, title, warning);
    } else {
      result.append(icon, title);
    }
    const message = document.createElement("span");
    message.textContent = body || "No additional details are available.";
    result.append(message);
    renderDetails(scan);
    confirmButton.hidden = scan.scan_status !== "valid";
    confirmButton.disabled = false;
    if (window.lucide) window.lucide.createIcons();
  }

  async function validatePayload(payload, autoConfirm = false, scanSession = null) {
    if (requestInProgress) return;
    const qrPayload = String(payload || "").trim();
    if (!qrPayload) {
      renderResult({ scan_status: "invalid", message: "Enter or scan a QR code first." });
      return;
    }
    currentQrPayload = qrPayload;
    requestInProgress = true;
    confirmButton.disabled = true;
    cameraMessage.textContent = "Checking the QR code with the server…";
    let shouldAutoConfirm = false;
    let validatedScan = null;
    try {
      const scan = await apiRequest("/staff/arrival/validate", {
        method: "POST",
        body: JSON.stringify({ qr_payload: qrPayload }),
      });
      validatedScan = scan;
      renderResult(scan);
      shouldAutoConfirm = autoConfirm &&
        scan.scan_status === "valid" &&
        scanSession === cameraSession &&
        window.location.hash === "#qr-scanner";
      if (shouldAutoConfirm) confirmButton.hidden = true;
      cameraMessage.textContent = shouldAutoConfirm
        ? "QR verified. Recording the customer's arrival…"
        : scan.scan_status === "valid"
          ? "Review the verified transaction, then confirm the customer's physical arrival."
        : "Scan another QR code or use manual input to check a different transaction.";
    } catch (error) {
      const scan = error.responseData;
      if (scan?.scan_status) {
        renderResult(scan);
        cameraMessage.textContent = "Scan another QR code or use manual input to check a different transaction.";
      } else {
        renderResult({
          scan_status: "error",
          message: error.message || "The QR code could not be validated. Check your connection and try again.",
        });
        cameraMessage.textContent = "The server could not validate this QR code.";
      }
    } finally {
      requestInProgress = false;
    }
    if (shouldAutoConfirm) {
      stopScanner();
      await confirmArrival();
    }
    return validatedScan;
  }

  async function processDetectedQr(payload) {
    if (detectedQrProcessing || requestInProgress) return;
    detectedQrProcessing = true;
    const scanSession = cameraSession;
    try {
      await validatePayload(payload, true, scanSession);
    } finally {
      detectedQrProcessing = false;
    }
  }

  async function startScanner(selectedDeviceId = "") {
    if (scanning || starting) return;
    starting = true;
    const session = ++cameraSession;
    startButton.disabled = true;
    stopButton.disabled = false;

    if (!window.isSecureContext) {
      showCameraError(
        "Secure connection required",
        "Camera access requires a secure context (HTTPS or localhost). Use manual QR input instead."
      );
      return;
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      showCameraError(
        "Camera API unavailable",
        "This browser or page does not provide the camera API. Use manual QR input, or open the page in a current browser over HTTPS or localhost."
      );
      return;
    }

    try {
      const QRCodeReader = window.ZXingBrowser?.BrowserQRCodeReader;
      if (typeof QRCodeReader !== "function") {
        throw new Error("The QR decoder library did not load.");
      }
      decoder = new QRCodeReader();
    } catch (error) {
      showCameraError(
        "QR decoder unavailable",
        `QR decoder initialization failed${error?.message ? `: ${error.message}` : "."} Use manual QR input instead.`
      );
      return;
    }

    try {
      const constraints = {
        audio: false,
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: { ideal: "environment" } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (session !== cameraSession) {
        releaseStream(stream);
        return;
      }
      mediaStream = stream;
      video.srcObject = mediaStream;
      video.hidden = false;
      placeholder.hidden = true;
      await video.play();
      if (session !== cameraSession) {
        releaseStream(stream);
        return;
      }
      await populateCameraOptions(mediaStream);
      if (session !== cameraSession) {
        releaseStream(stream);
        return;
      }
    } catch (error) {
      stopCameraResources();
      const message = cameraErrorMessage(error, selectedDeviceId);
      showCameraError(
        error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError"
          ? "Camera permission denied"
          : error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError"
            ? "No camera detected"
            : error?.name === "NotReadableError" || error?.name === "TrackStartError" || error?.name === "AbortError"
              ? "Camera unavailable"
              : "Camera could not start",
        message
      );
      return;
    }

    try {
      if (!decoder || typeof decoder.decodeFromStream !== "function") {
        throw new Error("The QR decoder cannot read from a camera stream.");
      }
      scanning = true;
      setScannerStatus("starting", "Starting QR decoder");
      const stream = mediaStream;
      const controls = await decoder.decodeFromStream(stream, video, (code, error) => {
        if (code && scanning) {
          const payload = code.getText();
          const now = Date.now();
          if (payload === lastDetectedPayload && now - lastDetectedAt < 3000) return;
          lastDetectedPayload = payload;
          lastDetectedAt = now;
          void processDetectedQr(payload);
        } else if (error && !["NotFoundException", "ChecksumException", "FormatException"].includes(error.getKind?.() || error.name)) {
          stopScanner();
          const message = `QR decoder failed${error.message ? `: ${error.message}` : "."} Use manual QR input or restart the scanner.`;
          cameraMessage.textContent = message;
          renderResult({ scan_status: "error", message });
          setScannerStatus("error", "QR decoder error");
        }
      });
      if (session !== cameraSession) {
        controls.stop();
        releaseStream(stream);
        return;
      }
      decodeControls = controls;
      starting = false;
      setScannerStatus("scanning", "Camera active");
      cameraMessage.textContent = "Point the camera at the customer's QR receipt.";
    } catch (error) {
      stopCameraResources();
      showCameraError(
        "QR decoder unavailable",
        `QR decoder initialization failed${error?.message ? `: ${error.message}` : "."} Use manual QR input instead.`
      );
    }
  }

  async function confirmArrival() {
    if (!currentQrPayload || requestInProgress) return;
    requestInProgress = true;
    confirmButton.disabled = true;
    confirmButton.setAttribute("aria-busy", "true");
    try {
      const scan = await apiRequest("/staff/arrival/confirm", {
        method: "POST",
        body: JSON.stringify({ qr_payload: currentQrPayload }),
      });
      renderResult(scan);
      if (scan.scan_status === "confirmed") {
        const transaction = scan.transaction_type === "dine_in" ? "Dine-in order" : "Reservation";
        lastSuccessSummary.textContent =
          `${scan.customer_name || "Customer"} · ${transaction} ${scan.transaction_number || ""}`.trim();
        const confirmedAt = scan.arrived_at || new Date().toISOString();
        lastSuccessTime.dateTime = confirmedAt;
        lastSuccessTime.textContent = formatDateTime(confirmedAt);
        lastSuccess.hidden = false;
        cameraMessage.textContent = "The customer's arrival has been saved and the customer has been notified.";
      }
      currentQrPayload = "";
    } catch (error) {
      const scan = error.responseData;
      renderResult(scan?.scan_status
        ? scan
        : {
          scan_status: "error",
          message: error.message || "The arrival could not be saved. Please try again.",
        });
      cameraMessage.textContent = "The arrival was not confirmed. The server did not report a successful check-in.";
    } finally {
      requestInProgress = false;
      confirmButton.removeAttribute("aria-busy");
    }
  }

  startButton.addEventListener("click", () => void startScanner());
  stopButton.addEventListener("click", stopScanner);
  cameraSelect?.addEventListener("change", () => {
    const selectedDeviceId = cameraSelect.value;
    if (selectedDeviceId && scanning) {
      stopScanner();
      void startScanner(selectedDeviceId);
    }
  });
  manualForm.addEventListener("submit", (event) => {
    event.preventDefault();
    stopScanner();
    void validatePayload(manualInput.value);
    manualInput.value = "";
  });
  confirmButton.addEventListener("click", () => void confirmArrival());
  window.addEventListener("hashchange", () => {
    if (window.location.hash !== "#qr-scanner") {
      stopScanner();
    } else {
      void startScanner();
    }
  });
  window.addEventListener("pagehide", stopScanner);
  window.addEventListener("beforeunload", stopScanner);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopScanner();
  });
  setScannerStatus("idle", "Scanner stopped");
  if (window.lucide) window.lucide.createIcons();
  if (window.location.hash === "#qr-scanner") void startScanner();
});
