import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import "./ar-header.ts";
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
  // No shadow DOM — Tailwind classes apply directly
  override createRenderRoot() {
    return this;
  }

  @state() private meta: ArMeta | null = null;
  @state() private sidebarOpen = false;

  /** Original children saved before Lit's first render clears them. */
  private _savedChildren: Node[] = [];

  override connectedCallback() {
    super.connectedCallback();
    // Save original children NOW — before Lit's async render runs
    this._savedChildren = Array.from(this.childNodes);

    const metaEl = document.getElementById("ar-meta");
    if (metaEl?.textContent) {
      try {
        this.meta = JSON.parse(metaEl.textContent) as ArMeta;
      } catch {
        console.error("[ar-shell] Failed to parse #ar-meta JSON");
      }
    }
  }

  private readonly toggleSidebar = () => {
    this.sidebarOpen = !this.sidebarOpen;
  };

  /** Move saved children into the content wrapper on first render. */
  private readonly onContentRef = (el: Element | undefined) => {
    if (el && this._savedChildren.length > 0) {
      for (const node of this._savedChildren) {
        el.appendChild(node);
      }
      this._savedChildren = [];
    }
  };

  override render() {
    const { meta } = this;
    const currentUrl = location.pathname.replace(/^\//, "") || "index.html";
    const outline = meta?.outline ?? [];

    return html`
      <ar-header
        .pkgName=${meta?.package ?? ""}
        .pkgVersion=${meta?.version ?? ""}
        .baseHref=${meta?.baseHref ?? ""}
        .hasSidebar=${true}
        .sidebarOpen=${this.sidebarOpen}
        @toggle-sidebar=${this.toggleSidebar}
      ></ar-header>

      <nav
        class=${`ar-sidebar ${this.sidebarOpen ? "ar-sidebar--visible" : "ar-sidebar--hidden"}`}
        aria-label="Package navigation"
      >
        ${meta
          ? html`<ar-nav
              .nodes=${meta.navTree}
              .currentUrl=${currentUrl}
              .baseHref=${meta.baseHref}
            ></ar-nav>`
          : nothing}
      </nav>

      <aside class="ar-outline-sidebar" aria-label="Page outline">
        <ar-outline .sections=${outline}></ar-outline>
      </aside>

      <div class="ar-main ar-main--with-outline">
        <div class="ar-content-wrap" ${ref(this.onContentRef)}></div>
      </div>
    `;
  }
}
