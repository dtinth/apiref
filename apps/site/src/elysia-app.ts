import { Elysia } from "elysia";
import { redirect as redirectToSymbol } from "./redirector.ts";
import { renderHome } from "./pages/home.ts";

const DOCS_BASE = "https://npm.apiref.page";

async function resolveVersion(pkg: string, versionSpec?: string): Promise<string> {
  if (versionSpec) {
    // Exact version requested - validate it exists in available versions
    const versions = await fetch(`${DOCS_BASE}/package/${pkg}/versions.json`)
      .then((r) => r.json() as Promise<string[]>)
      .catch(() => [] as string[]);

    if (!versions.includes(versionSpec)) {
      throw new Error(`Version ${versionSpec} not found`);
    }
    return versionSpec;
  }

  // No version specified - fetch metadata from npm
  try {
    const response = await fetch(`https://registry.npmjs.org/${pkg}/latest`);
    if (!response.ok) throw new Error("Not found");
    const data = (await response.json()) as { version?: string };
    if (!data.version) throw new Error("No version in npm metadata");
    return data.version;
  } catch {
    throw new Error("Failed to resolve version");
  }
}

async function getVersions(pkg: string): Promise<string[]> {
  const response = await fetch(`${DOCS_BASE}/package/${pkg}/versions.json`);
  if (!response.ok) throw new Error("Failed to fetch versions");
  return response.json() as Promise<string[]>;
}

async function getApirefJson(pkg: string, version: string): Promise<unknown> {
  const response = await fetch(`${DOCS_BASE}/package/${pkg}/v/${version}/apiref.json`);
  if (!response.ok) throw new Error("Failed to fetch apiref.json");
  return response.json();
}

const app = new Elysia()
  .get(
    "/",
    () =>
      new Response(
        renderHome({
          shellBaseUrl: "https://cdn.apiref.page/assets",
        }),
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        },
      ),
  )
  .get("/package/*", async ({ params }) => {
    const path = (params as Record<string, string>)["*"];
    const outcome = await redirectToSymbol(path, {
      resolveVersion,
      getVersions,
      getApirefJson,
    });

    if (outcome.kind === "redirect") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: outcome.url,
        },
      });
    }

    // Error case
    const detailsSection = outcome.details
      ? `<details><summary>Error details</summary><pre>${outcome.details}</pre></details>`
      : "";
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <title>Not Found</title>
  <style>
    body { font-family: sans-serif; padding: 40px; }
    h1 { color: #d32f2f; }
    pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Symbol Not Found</h1>
  <p>${outcome.reason}</p>
  ${detailsSection}
  <p><a href="/">Back to home</a></p>
</body>
</html>`,
      {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      },
    );
  });

export default app;
