import { createContext, useContext } from "preact/compat";

/**
 * Preact context for the current page URL.
 * Provides the page's URL relative to the documentation root.
 * @example "index.html", "module/MyClass.html"
 */
export const PageContext = createContext("");

/**
 * Preact context for the base URL prefix.
 * When set, all generated links are absolute from this prefix instead of relative.
 * @example "/package/name/v/1.0.0/"
 */
export const BasePrefixContext = createContext<string | undefined>(undefined);

/**
 * Hook to get a function that resolves root-relative URLs to page-relative (or absolute) URLs.
 * When baseUrl is set, returns absolute URLs; otherwise returns relative URLs.
 * @example
 * const resolve = useResolveLink();
 * // Without baseUrl:
 * resolve("MyClass.html") // => on page "module/Helper.html", returns "../MyClass.html"
 * // With baseUrl = "/pkg/v/1.0.0/":
 * resolve("MyClass.html") // => "/pkg/v/1.0.0/MyClass.html"
 */
export function useResolveLink(): (url: string) => string {
  const pageUrl = useContext(PageContext);
  const basePrefix = useContext(BasePrefixContext);

  return (url: string) => {
    if (basePrefix !== undefined) {
      // Keep same-page anchor links as-is (#anchor)
      if (url.startsWith("#")) return url;

      // Split URL into path and hash
      const hashIndex = url.indexOf("#");
      const path = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
      const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";

      // Same-page anchor: return just the hash
      if (path === pageUrl) return hash;

      // Return absolute path with base prefix
      return basePrefix + (hash ? `${path}${hash}` : path);
    }

    return makeRelative(pageUrl, url);
  };
}

/**
 * Convert a root-relative URL to a page-relative URL.
 * Handles same-page anchors specially: returns just the hash if the link is to the current page.
 *
 * @param from - Current page URL (e.g., "module/A.html")
 * @param to - Root-relative target URL (e.g., "MyClass.html", "module/B.html#method")
 * @returns Page-relative URL (e.g., "../MyClass.html", "B.html#method", "#method")
 *
 * @example
 * makeRelative("module/A.html", "module/A.html#m") // => "#m"
 * makeRelative("module/A.html", "module/B.html") // => "B.html"
 * makeRelative("module/A.html", "MyClass.html") // => "../MyClass.html"
 * makeRelative("index.html", "module/A.html") // => "module/A.html"
 * makeRelative("a/b/C.html", "x/D.html") // => "../../x/D.html"
 */
export function makeRelative(from: string, to: string): string {
  // Split URL into path and hash
  const hashIndex = to.indexOf("#");
  const toPath = hashIndex >= 0 ? to.slice(0, hashIndex) : to;
  const hash = hashIndex >= 0 ? to.slice(hashIndex) : "";

  // Same-page anchor: return just the hash
  if (toPath === from) return hash;

  // Extract directory from 'from' (remove filename)
  const fromDir = from.split("/").slice(0, -1);
  const toParts = toPath.split("/");

  // Strip common directory prefix
  while (fromDir.length > 0 && toParts.length > 1 && fromDir[0] === toParts[0]) {
    fromDir.shift();
    toParts.shift();
  }

  // Build relative path: ".." for each remaining fromDir, then toParts
  return [...fromDir.map(() => ".."), ...toParts].join("/") + hash;
}
