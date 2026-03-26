import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import "./ar-header.ts";
import "./ar-nav.ts";

export interface ArMeta {
  package: string;
  version: string;
  title: string;
  kind: string;
  breadcrumbs: Array<{ label: string; url: string }>;
  navTree: NavNode[];
}

export interface NavNode {
  label: string;
  url: string;
  kind: string;
  flags: { deprecated?: boolean; beta?: boolean };
  children: NavNode[];
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

    return html`
      <ar-header
        .pkgName=${meta?.package ?? ""}
        .pkgVersion=${meta?.version ?? ""}
        .hasSidebar=${true}
        .sidebarOpen=${this.sidebarOpen}
        @toggle-sidebar=${this.toggleSidebar}
      ></ar-header>

      <nav
        class=${`ar-sidebar ${this.sidebarOpen ? "ar-sidebar--visible" : "ar-sidebar--hidden"}`}
        aria-label="Package navigation"
      >
        ${meta ? html`<ar-nav .nodes=${meta.navTree} .currentUrl=${currentUrl}></ar-nav>` : nothing}
      </nav>

      <div class="ar-main">
        <div class="ar-content-wrap" ${ref(this.onContentRef)}></div>
      </div>
    `;
  }
}
