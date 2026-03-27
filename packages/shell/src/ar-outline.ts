import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { OutlineSection, OutlineItem } from "./ar-shell.ts";

@customElement("ar-outline")
export class ArOutline extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property({ attribute: false }) sections: OutlineSection[] = [];

  override render() {
    if (this.sections.length === 0) return nothing;
    const showSectionLabels = this.sections.length > 1;
    return html`
      <div class="ar-outline">
        <div class="ar-outline-title">Outline</div>
        ${this.sections.map((s) => this.renderSection(s, showSectionLabels))}
      </div>
    `;
  }

  private renderSection(section: OutlineSection, showLabel: boolean) {
    if (section.items.length === 0) return nothing;
    return html`
      <div class="ar-outline-section">
        ${showLabel ? html`<div class="ar-outline-section-label">${section.label}</div>` : nothing}
        ${section.items.map((item) => this.renderItem(item))}
      </div>
    `;
  }

  private renderItem(item: OutlineItem) {
    return html`
      <a
        href=${"#" + item.anchor}
        class=${`ar-outline-item ${item.flags.deprecated ? "line-through opacity-60" : ""}`}
      >
        <i class=${`codicon ${item.iconClass} ar-kind-icon ar-kind-icon--${item.kind}`}></i>
        <span>${item.label}</span>
      </a>
    `;
  }
}
