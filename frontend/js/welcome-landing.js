(() => {
  const landing = document.getElementById("welcomeLanding");
  const app = document.querySelector(".main-container");
  const headerActions = document.querySelector(".home-topbar-actions");
  const topActions = document.querySelector(".welcome-topbar-actions");
  const dialog = landing?.querySelector(".welcome-dialog");
  if (!landing || !app || !dialog) return;

  const choicePanel = app.querySelector("#choicePanel");
  choicePanel?.setAttribute("tabindex", "-1");

  // Keep the theme toggle in whichever header is currently visible.
  const placeThemeToggle = () => {
    const toggle = document.getElementById("themeSwitch")?.closest(".theme-switch");
    if (!toggle) return;
    const target = document.documentElement.dataset.welcome === "true" ? topActions : headerActions;
    target?.prepend(toggle);
  };

  const showWelcome = () => {
    document.documentElement.dataset.welcome = "true";
    window.scrollTo(0, 0);
    placeThemeToggle();
    landing.querySelector(".welcome-brand")?.focus({ preventScroll: true });
  };

  const enterApp = () => {
    sessionStorage.setItem("dineari-welcome-entered", "true");
    document.documentElement.dataset.welcome = "false";
    placeThemeToggle();
    if (dialog.open) dialog.close();
    choicePanel?.focus({ preventScroll: true });
  };

  const featured = landing.querySelector("#welcomeFeatured");
  const featuredMedia = featured?.querySelector(".welcome-featured-media");
  const featuredCopy = featured?.querySelector(".welcome-featured-copy");
  const featuredImage = featured?.querySelector("#welcomeFeaturedImage");
  const featuredName = featured?.querySelector("#welcomeFeaturedTitle");
  const featuredDescription = featured?.querySelector("#welcomeFeaturedDescription");
  const featuredCategory = featured?.querySelector("#welcomeFeaturedCategory");
  const featuredPrice = featured?.querySelector("#welcomeFeaturedPrice");
  const featuredCurrent = featured?.querySelector("#welcomeFeaturedCurrent");
  const featuredProgress = featured?.querySelector(".welcome-featured-progress");
  const featuredDots = featured?.querySelectorAll(".welcome-featured-dots span");
  const previousDish = featured?.querySelector("#welcomeFeaturedPrevious");
  const nextDish = featured?.querySelector("#welcomeFeaturedNext");

  if (featured && featuredImage && featuredName && featuredDescription && featuredCategory && featuredPrice && featuredCurrent) {
    const dishes = [
      { name: "Chicken Wings", category: "Appetizers", description: "Buffalo-style chicken wings with dip.", price: 180, image: "chicken-wings.webp" },
      { name: "Garlic Butter Shrimp", category: "Appetizers", description: "Shrimp sautéed in garlic butter sauce.", price: 220, image: "garlic-butter-shrimp.webp" },
      { name: "Beef Kare-Kare", category: "Main Course", description: "Peanut stew with oxtail and vegetables.", price: 220, image: "beef-kare-kare.webp" },
      { name: "Lechon Kawali", category: "Main Course", description: "Deep-fried crispy pork belly.", price: 200, image: "lechon-kawali.webp" },
      { name: "Halo-Halo", category: "Desserts", description: "Mixed dessert with shaved ice and toppings.", price: 90, image: "halo-halo.webp" },
    ];
    const imagePath = (file) => `images/menu-images/${file}`;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let activeDish = 0;
    let switchTimer;
    let priceTimer;
    let autoplayTimer;
    let featuredIsVisible = false;
    let autoplayPaused = false;

    const stopAutoplay = () => {
      window.clearInterval(autoplayTimer);
      autoplayTimer = undefined;
    };

    const startAutoplay = () => {
      stopAutoplay();
      if (prefersReducedMotion || !featuredIsVisible || autoplayPaused || document.hidden) return;
      autoplayTimer = window.setInterval(() => changeDish(activeDish + 1, false), 5000);
    };

    const renderDish = (index) => {
      activeDish = (index + dishes.length) % dishes.length;
      const dish = dishes[activeDish];
      featuredImage.src = imagePath(dish.image);
      featuredImage.alt = dish.name;
      featuredName.textContent = dish.name;
      featuredDescription.textContent = dish.description;
      featuredCategory.textContent = dish.category;
      featuredPrice.textContent = `₱${Number(dish.price).toFixed(2)}`;
      featuredCurrent.textContent = String(activeDish + 1).padStart(2, "0");
      featuredProgress?.setAttribute("aria-label", `Dish ${activeDish + 1} of ${dishes.length}`);
      featuredDots?.forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === activeDish));
    };

    const changeDish = (index, resetAutoplay = true) => {
      if (prefersReducedMotion) {
        renderDish(index);
        if (resetAutoplay) startAutoplay();
        return;
      }
      window.clearTimeout(switchTimer);
      window.clearTimeout(priceTimer);
      featuredCopy?.classList.remove("is-price-entering");
      featuredMedia?.classList.add("is-changing");
      featuredCopy?.classList.add("is-changing");
      featured.setAttribute("aria-busy", "true");
      switchTimer = window.setTimeout(() => {
        renderDish(index);
        requestAnimationFrame(() => {
          featuredMedia?.classList.remove("is-changing");
          featuredCopy?.classList.remove("is-changing");
          featuredCopy?.classList.add("is-price-entering");
          featured.removeAttribute("aria-busy");
          priceTimer = window.setTimeout(() => featuredCopy?.classList.remove("is-price-entering"), 420);
          if (resetAutoplay) startAutoplay();
        });
      }, 190);
    };

    previousDish?.addEventListener("click", () => changeDish(activeDish - 1));
    nextDish?.addEventListener("click", () => changeDish(activeDish + 1));
    featured.addEventListener("pointerenter", () => {
      autoplayPaused = true;
      stopAutoplay();
    });
    featured.addEventListener("pointerleave", () => {
      autoplayPaused = false;
      startAutoplay();
    });
    featured.addEventListener("focusin", () => {
      autoplayPaused = true;
      stopAutoplay();
    });
    featured.addEventListener("focusout", (event) => {
      if (featured.contains(event.relatedTarget)) return;
      autoplayPaused = false;
      startAutoplay();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAutoplay();
      else startAutoplay();
    });
    featured.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.target.matches("input, textarea, select")) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        changeDish(activeDish - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        changeDish(activeDish + 1);
      }
    });

    dishes.forEach((dish) => {
      const preload = new Image();
      preload.src = imagePath(dish.image);
    });

    if (!("IntersectionObserver" in window)) {
      featured.classList.add("is-visible");
      featuredIsVisible = true;
      startAutoplay();
    } else {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          featuredIsVisible = entry.isIntersecting;
          if (featuredIsVisible) featured.classList.add("is-visible");
          if (featuredIsVisible) startAutoplay();
          else stopAutoplay();
        });
      }, { threshold: 0.18, rootMargin: "0px 0px -24px 0px" });
      revealObserver.observe(featured);
    }
  }

  // theme.js builds the toggle on DOMContentLoaded; this listener is registered
  // later, so it runs after the toggle exists.
  document.addEventListener("DOMContentLoaded", placeThemeToggle);

  landing.querySelectorAll("[data-enter-app]").forEach((button) =>
    button.addEventListener("click", enterApp)
  );
  landing.querySelector("[data-open-learn]")?.addEventListener("click", () => {
    dialog.showModal();
    dialog.querySelector(".welcome-dialog-close")?.focus();
  });
  dialog.querySelector(".welcome-dialog-close")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.querySelector(".home-brand-link")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const hasActiveOrder = Boolean(
      (typeof selectedTableId !== "undefined" && selectedTableId) ||
      (typeof cart !== "undefined" && cart.length) ||
      (typeof orderType !== "undefined" && orderType) ||
      !choicePanel?.checkVisibility()
    );
    if (hasActiveOrder) {
      const confirmed = await window.DineAriNotifications.confirm({
        type: "warning",
        title: "Return to the welcome page?",
        message: "Your current order will be kept. You can continue from where you left off.",
        confirmLabel: "Go to welcome page",
        cancelLabel: "Stay here",
      });
      if (!confirmed) return;
    }
    showWelcome();
  });

  window.addEventListener("hashchange", () => {
    if (location.hash === "#welcome" && document.documentElement.dataset.welcome !== "true") showWelcome();
  });
})();
