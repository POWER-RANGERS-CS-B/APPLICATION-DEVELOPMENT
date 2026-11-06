function initAnimations() {
  document.querySelectorAll(".card, .panel, .admin-panel").forEach((element, index) => {
    element.style.animationDelay = `${index * 0.03}s`;
  });
}

document.addEventListener("DOMContentLoaded", initAnimations);
