import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { NavNode } from "./ar-shell.ts";

const KIND_LABELS: Record<string, string> = {
  class: "C",
  interface: "I",
  function: "F",
  "type-alias": "T",
  variable: "V",
  enum: "E",
  module: "M",
  namespace: "N",
  "package-index": "P",
};

@customElement("ar-nav")
export class ArNav extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property({ attribute: false }) nodes: NavNode[] = [];
  @property() currentUrl = "";

  override render() {
    return html`<div class="ar-nav">${this.renderNodes(this.nodes, 0)}</div>`;
  }

  private renderNodes(nodes: NavNode[], depth: number): TemplateResult | typeof nothing {
    if (nodes.length === 0) return nothing;

    // Group top-level nodes by kind at depth 0
    if (depth === 0) {
      const modules = nodes.filter((n) => n.kind === "module");
      const others = nodes.filter((n) => n.kind !== "module");

      return html`
        ${others.length > 0
          ? html`<div class="ar-nav-section">${others.map((n) => this.renderNode(n, depth))}</div>`
          : nothing}
        ${modules.map(
          (mod) => html`
            <div class="ar-nav-section">
              <div class="ar-nav-section-title">${mod.label}</div>
              ${this.renderNodes(mod.children, depth + 1)}
            </div>
          `,
        )}
      `;
    }

    return html`${nodes.map((n) => this.renderNode(n, depth))}`;
  }

  private renderNode(node: NavNode, depth: number): TemplateResult {
    const isActive = node.url === this.currentUrl;
    const label = KIND_LABELS[node.kind] ?? "·";

    return html`
      <a
        href=${node.url}
        class=${`ar-nav-item ${isActive ? "ar-nav-item--active" : ""} ${node.flags.deprecated ? "line-through opacity-60" : ""}`}
      >
        <span class=${`ar-kind-icon ar-kind-icon--${node.kind}`}>${label}</span>
        <span>${node.label}</span>
      </a>
      ${node.children.length > 0
        ? html`<div class="ar-nav-children">${this.renderNodes(node.children, depth + 1)}</div>`
        : nothing}
    `;
  }
}
