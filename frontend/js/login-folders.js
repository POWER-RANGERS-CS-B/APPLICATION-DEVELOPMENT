function switchLoginFolder(accountType) {
  const isAdmin = accountType === "admin";
  const activePanel = document.getElementById(isAdmin ? "adminPanel" : "staffPanel");
  const inactivePanel = document.getElementById(isAdmin ? "staffPanel" : "adminPanel");
  const activeTab = document.getElementById(isAdmin ? "adminTab" : "staffTab");
  const inactiveTab = document.getElementById(isAdmin ? "staffTab" : "adminTab");

  if (!activePanel || !inactivePanel || !activeTab || !inactiveTab) return;

  activePanel.classList.add("active");
  activePanel.removeAttribute("aria-hidden");
  activePanel.removeAttribute("inert");
  inactivePanel.classList.remove("active");
  inactivePanel.setAttribute("aria-hidden", "true");
  inactivePanel.setAttribute("inert", "");

  activeTab.classList.add("active");
  activeTab.setAttribute("aria-selected", "true");
  inactiveTab.classList.remove("active");
  inactiveTab.setAttribute("aria-selected", "false");
}
