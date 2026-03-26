function setSidebarOpen(sidebar: HTMLElement, toggles: HTMLElement[], open: boolean) {
  sidebar.classList.toggle("ar-sidebar--visible", open);
  sidebar.classList.toggle("ar-sidebar--hidden", !open);
  for (const toggle of toggles) {
    toggle.setAttribute("aria-expanded", String(open));
  }
}

export function bootstrapShell(root: ParentNode = document) {
  const sidebar = root.querySelector<HTMLElement>("[data-ar-sidebar]");
  if (!sidebar) return;

  const toggles = Array.from(root.querySelectorAll<HTMLElement>("[data-ar-sidebar-toggle]"));
  if (toggles.length === 0) return;

  setSidebarOpen(sidebar, toggles, false);
  for (const toggle of toggles) {
    toggle.addEventListener("click", () => {
      const isOpen = sidebar.classList.contains("ar-sidebar--visible");
      setSidebarOpen(sidebar, toggles, !isOpen);
    });
  }
}

if (typeof document !== "undefined") {
  bootstrapShell(document);
}
