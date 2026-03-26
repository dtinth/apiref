import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("ar-header")
export class ArHeader extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property() pkgName = "";
  @property() pkgVersion = "";
  @property() baseHref = "";
  @property({ type: Boolean }) hasSidebar = false;
  @property({ type: Boolean }) sidebarOpen = false;

  private readonly onToggle = () => {
    this.dispatchEvent(new CustomEvent("toggle-sidebar", { bubbles: true }));
  };

  override render() {
    return html`
      <header class="ar-header">
        ${this.hasSidebar
          ? html`<button
              class="ar-header-menu-btn"
              @click=${this.onToggle}
              aria-label="Toggle navigation"
              aria-expanded=${this.sidebarOpen}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>`
          : ""}
        <a href=${this.baseHref + "index.html"} class="ar-header-logo">
          <span class="text-ar-muted">apiref</span>
          ${this.pkgName
            ? html`<span class="text-ar-muted">/</span
                ><span class="ar-header-pkg">${this.pkgName}</span
                ><span class="ar-header-version">${this.pkgVersion}</span>`
            : ""}
        </a>
      </header>
    `;
  }
}
