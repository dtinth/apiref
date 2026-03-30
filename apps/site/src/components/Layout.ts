import { ComponentChildren } from "preact";
import { html } from "../html.ts";

export interface NavNode {
  label: string;
  url: string;
  kind: string;
  iconClass: string;
  flags: { deprecated?: boolean };
  children: NavNode[];
}

export interface LayoutProps {
  title: string;
  children: ComponentChildren;
  shellBaseUrl?: string;
  navNodes?: NavNode[];
  baseHref?: string;
}

export function Layout({
  title,
  children,
  shellBaseUrl = "https://cdn.apiref.page/assets",
  navNodes = [],
  baseHref = "./",
}: LayoutProps) {
  const meta = {
    title,
    baseHref,
    navTree: navNodes,
  };

  return html`
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
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
            <a href="${baseHref}index.html" class="ar-header-logo">
              <span class="text-ar-muted">apiref</span>
            </a>
          </header>
          <nav class="ar-sidebar ar-sidebar--hidden" aria-label="Main navigation" />

          <div class="ar-main">
            <div class="ar-content-wrap">
              <main class="ar-content">${children}</main>
            </div>
          </div>
        </ar-shell>
        <script type="application/json" id="ar-meta">
          ${JSON.stringify(meta)}
        </script>
      </body>
    </html>
  `;
}
