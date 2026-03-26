import { createContext, useContext } from "preact/compat";

/**
 * Preact context for the current page URL.
 * Provides the page's URL relative to the documentation root.
 * @example "index.html", "module/MyClass.html"
 */
export const PageContext = createContext("");

/**
 * Hook to get a function that resolves root-relative URLs to page-relative URLs.
 * @example
 * const resolve = useResolveLink();
 * resolve("MyClass.html") // => on page "module/Helper.html", returns "../MyClass.html"
 */
export function useResolveLink(): (url: string) => string {
  const pageUrl = useContext(PageContext);
  return (url) => makeRelative(pageUrl, url);
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
