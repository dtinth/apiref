import { render } from "preact-render-to-string";
import { html } from "../html.ts";

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

  const meta = {
    title: "apiref",
    baseHref: "./",
    navTree: navNodes,
  };

  const page = html`
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>apiref</title>
        <link rel="icon" href="${shellBaseUrl}/interface.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Arimo:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
        />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/comic-mono@0.0.1/index.css" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.36/dist/codicon.css"
        />
        <link rel="stylesheet" href="${shellBaseUrl}/styles.css" />
        <script type="module" src="${shellBaseUrl}/shell.js" />
      </head>
      <body>
        <ar-shell>
          <header class="ar-header">
            <a href="${meta.baseHref}index.html" class="ar-header-logo">
              <span class="text-ar-muted">apiref</span>
            </a>
          </header>
          <nav class="ar-sidebar ar-sidebar--hidden" aria-label="Main navigation" />

          <div class="ar-main">
            <div class="ar-content-wrap">
              <main class="ar-content">
                <article class="ar-description">
                  <h1>apiref</h1>
                  <p class="lead">
                    Automatically-generated documentation sites for npm packages, powered by
                    <a href="https://typedoc.org/">TypeDoc</a>.
                  </p>
                  <p>Coming soon...</p>
                </article>
              </main>
            </div>
          </div>
        </ar-shell>
      </body>
    </html>
  `;

  let html_str = render(page);
  // Insert the metadata script before the shell script
  const metaScript = `<script type="application/json" id="ar-meta">${JSON.stringify(meta)}</script>`;
  html_str = html_str.replace("</head>", metaScript + "</head>");

  return "<!DOCTYPE html>" + html_str;
}
