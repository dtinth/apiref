import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { OutlineSection, OutlineItem } from "./ar-shell.ts";

const OUTLINE_ICONS: Record<string, string> = {
  constructor: "codicon-symbol-method",
  method: "codicon-symbol-method",
  property: "codicon-symbol-field",
  accessor: "codicon-symbol-field",
  "enum-member": "codicon-symbol-enum-member",
  member: "codicon-symbol-misc",
};

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
    const iconClass = OUTLINE_ICONS[item.kind] ?? "codicon-symbol-misc";
    return html`
      <a
        href=${"#" + item.anchor}
        class=${`ar-outline-item ${item.flags.deprecated ? "line-through opacity-60" : ""}`}
      >
        <i class=${`codicon ${iconClass}`}></i>
        <span>${item.label}</span>
      </a>
    `;
  }
}
