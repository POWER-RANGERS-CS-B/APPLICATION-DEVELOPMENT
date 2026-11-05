(function () {
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"></path><circle cx="12" cy="12" r="10"></circle></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>',
  };
  const titles = {
    success: "Success",
    error: "Something went wrong",
    warning: "Attention",
    info: "Information",
  };
  let host;
  const confirmationQueue = [];
  let activeConfirmation;

  function getHost() {
    if (host?.isConnected) return host;
    host = document.createElement("div");
    host.className = "app-notification-stack";
    host.setAttribute("role", "region");
    host.setAttribute("aria-label", "Notifications");
    document.body.append(host);
    return host;
  }

  function dismiss(notification) {
    if (!notification.isConnected || notification.classList.contains("is-leaving")) return;
    window.clearTimeout(notification.dismissTimer);
    notification.classList.add("is-leaving");
    window.setTimeout(() => notification.remove(), 180);
  }

  function show(options = {}) {
    const type = Object.hasOwn(icons, options.type) ? options.type : "info";
    const title = String(options.title || titles[type]);
    const description = String(options.description ?? options.message ?? "");
    const notification = document.createElement("section");
    notification.className = `app-notification is-${type}`;
    notification.setAttribute("role", type === "error" || type === "warning" ? "alert" : "status");
    notification.setAttribute("aria-live", type === "error" || type === "warning" ? "assertive" : "polite");
    notification.setAttribute("aria-atomic", "true");

    const icon = document.createElement("span");
    icon.className = "app-notification-icon";
    icon.innerHTML = icons[type];

    const content = document.createElement("div");
    content.className = "app-notification-content";
    const heading = document.createElement("strong");
    heading.className = "app-notification-title";
    heading.textContent = title;
    content.append(heading);
    if (description) {
      const message = document.createElement("p");
      message.className = "app-notification-description";
      message.textContent = description;
      content.append(message);
    }

    const close = document.createElement("button");
    close.className = "app-notification-close";
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss notification");
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"></path></svg>';
    close.addEventListener("click", () => dismiss(notification));

    const action = options.action;
    if (action && typeof action.onClick === "function" && action.label) {
      const actionButton = document.createElement("button");
      actionButton.className = "app-notification-action";
      actionButton.type = "button";
      actionButton.textContent = String(action.label);
      actionButton.addEventListener("click", () => {
        action.onClick();
        dismiss(notification);
      });
      content.append(actionButton);
    }

    notification.append(icon, content, close);
    getHost().append(notification);
    const duration = Number.isFinite(options.duration) ? options.duration : 5200;
    if (duration > 0) notification.dismissTimer = window.setTimeout(() => dismiss(notification), duration);
    return { dismiss: () => dismiss(notification), element: notification };
  }

  function getConfirmationDialog() {
    let dialog = document.querySelector("#appConfirmationDialog");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "appConfirmationDialog";
    dialog.className = "app-confirmation-dialog";
    dialog.setAttribute("aria-labelledby", "appConfirmationTitle");
    dialog.setAttribute("aria-describedby", "appConfirmationMessage");
    dialog.innerHTML = `
      <section class="app-confirmation-card">
        <div class="app-confirmation-icon" aria-hidden="true"></div>
        <div class="app-confirmation-copy">
          <h2 id="appConfirmationTitle"></h2>
          <p id="appConfirmationMessage"></p>
        </div>
        <div class="app-confirmation-actions">
          <button class="app-confirmation-cancel" type="button"></button>
          <button class="app-confirmation-accept" type="button"></button>
        </div>
      </section>
    `;
    document.body.append(dialog);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      activeConfirmation?.finish(false);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) activeConfirmation?.finish(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && activeConfirmation) {
        event.preventDefault();
        activeConfirmation.finish(false);
      }
    });
    dialog.querySelector(".app-confirmation-cancel").addEventListener("click", () => {
      activeConfirmation?.finish(false);
    });
    dialog.querySelector(".app-confirmation-accept").addEventListener("click", () => {
      activeConfirmation?.finish(true);
    });
    return dialog;
  }

  function showNextConfirmation() {
    if (activeConfirmation || !confirmationQueue.length) return;
    const request = confirmationQueue.shift();
    const dialog = getConfirmationDialog();
    const type = Object.hasOwn(icons, request.options.type) ? request.options.type : "warning";
    const title = request.options.title || "Are you sure?";
    const message = request.options.message || "";
    const cancelLabel = request.options.cancelLabel || "Cancel";
    const confirmLabel = request.options.confirmLabel || "Confirm";
    const icon = dialog.querySelector(".app-confirmation-icon");
    icon.className = `app-confirmation-icon is-${type}`;
    icon.innerHTML = icons[type];
    dialog.querySelector("#appConfirmationTitle").textContent = title;
    dialog.querySelector("#appConfirmationMessage").textContent = message;
    const cancel = dialog.querySelector(".app-confirmation-cancel");
    cancel.textContent = cancelLabel;
    const accept = dialog.querySelector(".app-confirmation-accept");
    accept.textContent = confirmLabel;
    accept.classList.toggle("is-destructive", Boolean(request.options.destructive));

    let settled = false;
    activeConfirmation = {
      finish(result) {
        if (settled) return;
        settled = true;
        if (dialog.open) dialog.close();
        activeConfirmation = null;
        request.resolve(result);
        window.setTimeout(showNextConfirmation, 0);
      },
    };
    dialog.showModal();
  }

  function confirm(options = {}) {
    const settings = typeof options === "string" ? { message: options } : options;
    return new Promise((resolve) => {
      confirmationQueue.push({ options: settings, resolve });
      showNextConfirmation();
    });
  }

  function typeForAlert(message) {
    if (/\b(saved|success|successfully|confirmed|added|updated|completed|marked clean)\b/i.test(message)) return "success";
    if (/\b(failed|cannot|error|invalid|unavailable|missing|not found|incorrect|required)\b/i.test(message)) return "error";
    if (/\b(warning|attention|expir(?:es|ed|ing)|low stock|near capacity|no longer available|not available yet)\b/i.test(message)) return "warning";
    if (/\b(must|please)\b/i.test(message)) return "error";
    return "info";
  }

  window.DineAriNotifications = { show, confirm };
  window.alert = function (message) {
    const description = String(message ?? "");
    const type = typeForAlert(description);
    show({ type, title: titles[type], description });
  };
})();
