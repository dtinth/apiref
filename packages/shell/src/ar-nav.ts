import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { NavNode } from "./ar-shell.ts";
import { KIND_ICONS } from "./icon-map.ts";

@customElement("ar-nav")
export class ArNav extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property({ attribute: false }) nodes: NavNode[] = [];
  @property() currentUrl = "";
  @property() baseHref = "";

  override render() {
    return html`<div class="ar-nav">${this.renderNodes(this.nodes, 0)}</div>`;
  }

  private renderNodes(nodes: NavNode[], depth: number): TemplateResult | typeof nothing {
    if (nodes.length === 0) return nothing;
    return html`${nodes.map((n) => this.renderNode(n, depth))}`;
  }

  private renderNode(node: NavNode, depth: number): TemplateResult {
    const isActive = node.url === this.currentUrl;
    const iconClass = KIND_ICONS[node.kind] ?? "codicon-symbol-misc";

    return html`
      <a
        href=${this.baseHref + node.url}
        class=${`ar-nav-item ar-nav-item--depth-${depth} ${isActive ? "ar-nav-item--active" : ""} ${node.flags.deprecated ? "ar-nav-item--deprecated" : ""}`}
      >
        <i class=${`codicon ${iconClass} ar-kind-icon ar-kind-icon--${node.kind}`}></i>
        <span>${node.label}</span>
      </a>
      ${node.children.length > 0 ? this.renderNodes(node.children, depth + 1) : nothing}
    `;
  }
}
