import { customElement } from "lit/decorators.js";
import { LitElement } from "lit";
import "./ar-nav.ts";
import "./ar-outline.ts";

export interface ArMeta {
  package: string;
  version: string;
  title: string;
  kind: string;
  breadcrumbs: Array<{ label: string; url: string }>;
  navTree: NavNode[];
  outline: OutlineSection[];
  baseHref: string;
}

export interface NavNode {
  label: string;
  url: string;
  kind: string;
  flags: { deprecated?: boolean; beta?: boolean };
  children: NavNode[];
}

export interface OutlineSection {
  label: string;
  items: OutlineItem[];
}

export interface OutlineItem {
  label: string;
  anchor: string;
  kind: string;
  flags: { deprecated?: boolean };
}

@customElement("ar-shell")
export class ArShell extends LitElement {
  override createRenderRoot() {
    return this;
  }

  override connectedCallback() {
    super.connectedCallback();

    const metaEl = document.getElementById("ar-meta");
    if (!metaEl?.textContent) {
      console.error("[ar-shell] #ar-meta not found");
      return;
    }

    let meta: ArMeta;
    try {
      meta = JSON.parse(metaEl.textContent) as ArMeta;
    } catch {
      console.error("[ar-shell] Failed to parse #ar-meta JSON");
      return;
    }

    // Populate header with hamburger button
    const header = this.querySelector("header.ar-header");
    if (header) {
      const button = document.createElement("button");
      button.className = "ar-header-menu-btn";
      button.setAttribute("aria-label", "Toggle navigation");
      button.setAttribute("aria-expanded", "false");
      button.innerHTML =
        '<svg class="codicon codicon-list-unordered" viewBox="0 0 16 16"><path d="M1.5 3h13v1h-13V3zm0 4h13v1h-13V7zm0 4h13v1h-13v-1z"/></svg>';
      header.insertBefore(button, header.firstChild);

      button.addEventListener("click", () => this.toggleSidebar(button));
    }

    // Populate sidebar nav
    const nav = this.querySelector("nav.ar-sidebar");
    if (nav) {
      const arNav = document.createElement("ar-nav") as any;
      arNav.nodes = meta.navTree;
      arNav.currentUrl = location.pathname.replace(/^\//, "") || "index.html";
      arNav.baseHref = meta.baseHref;
      nav.appendChild(arNav);
    }

    // Populate outline sidebar
    const aside = this.querySelector("aside.ar-outline-sidebar");
    if (aside) {
      const arOutline = document.createElement("ar-outline") as any;
      arOutline.sections = meta.outline;
      aside.appendChild(arOutline);
    }
  }

  private toggleSidebar(button: HTMLElement) {
    const nav = this.querySelector("nav.ar-sidebar");
    if (!nav) return;

    const isOpen = nav.classList.contains("ar-sidebar--visible");
    if (isOpen) {
      nav.classList.remove("ar-sidebar--visible");
      nav.classList.add("ar-sidebar--hidden");
      button.setAttribute("aria-expanded", "false");
    } else {
      nav.classList.remove("ar-sidebar--hidden");
      nav.classList.add("ar-sidebar--visible");
      button.setAttribute("aria-expanded", "true");
    }
  }
}
