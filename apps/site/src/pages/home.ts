import { render } from "preact-render-to-string";
import { html } from "../html.ts";
import { Layout } from "../components/Layout.ts";

interface RenderHomeOptions {
  shellBaseUrl?: string;
}

export function renderHome(options: RenderHomeOptions = {}): string {
  const shellBaseUrl = options.shellBaseUrl || "https://cdn.apiref.page/assets";

  const navNodes = [
    {
      label: "Home",
      url: "index.html",
      kind: "module",
      iconClass: "codicon-home",
      flags: { deprecated: false },
      children: [],
    },
    {
      label: "GitHub",
      url: "https://github.com/dtinth/apiref",
      kind: "module",
      iconClass: "codicon-github",
      flags: { deprecated: false },
      children: [],
    },
  ];

  const page = html`
    <${Layout} title="apiref" shellBaseUrl=${shellBaseUrl} navNodes=${navNodes} baseHref="./">
      <article class="ar-description">
        <h1>apiref</h1>
        <p class="lead">
          Automatically-generated documentation sites for npm packages, powered by
          <a href="https://typedoc.org/">TypeDoc</a>.
        </p>
        <p>Coming soon...</p>
      </article>
    <//>
  `;

  return "<!DOCTYPE html>" + render(page);
}
