// Maps the tab name (used in the page address) to the panel it shows.
const TAB_PANELS = { setup: "tab-setup", "recipe-cost": "tab-cost", backup: "tab-backup" };
const DEFAULT_TAB = "setup";

let handlers = {}; // optional function per tab, run when that tab is opened

function currentTab() {
  const name = location.hash.replace("#", "");
  return TAB_PANELS[name] ? name : DEFAULT_TAB;
}

function applyTab(runHandler) {
  const active = currentTab();
  for (const [name, panelId] of Object.entries(TAB_PANELS)) {
    document.getElementById(panelId).classList.toggle("hidden", name !== active);
  }
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const isActive = btn.dataset.tab === active;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-current", isActive ? "page" : "false");
  });
  if (runHandler && handlers[active]) handlers[active]();
}

// tabHandlers example: { "recipe-cost": loadRecipeCost }
export function initTabs(tabHandlers) {
  handlers = tabHandlers;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => { location.hash = btn.dataset.tab; });
  });
  window.addEventListener("hashchange", () => applyTab(true));
  applyTab(false);
}

// Used after sign-in, to load whichever tab is showing.
export function refreshCurrentTab() {
  const active = currentTab();
  if (handlers[active]) handlers[active]();
}
