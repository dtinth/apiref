/**
 * Package redirector — resolves /package/:pkg/:symbol to actual doc URL
 */

export interface ParsedUrl {
  packageName: string;
  version: string | undefined;
  symbolPath: string[];
}

export interface TreeNode {
  name: string;
  kind: string;
  url?: string;
  children?: TreeNode[];
  outline?: OutlineItem[];
}

export interface OutlineItem {
  name: string;
  kind: string;
  anchor?: string;
  linkTo?: string;
}

export interface SymbolLocation {
  url: string;
}

export interface Breadcrumb {
  label: string;
  url: string;
}

export interface RedirectCandidate {
  url: string;
  breadcrumbs: Breadcrumb[];
}

interface SymbolMatch {
  kind: "single" | "ambiguous";
  locations: SymbolCandidate[];
}

export interface ApirefJson {
  package: string;
  version: string;
  tree: TreeNode[];
}

export type RedirectorOutcome =
  | { kind: "redirect"; url: string }
  | { kind: "ambiguous"; reason: string; candidates: RedirectCandidate[] }
  | { kind: "error"; reason: string; details?: string };

export interface RedirectorOptions {
  resolveVersion: (pkg: string, versionSpec?: string) => Promise<string>;
  getVersions: (pkg: string) => Promise<string[]>;
  getApirefJson: (pkg: string, version: string) => Promise<unknown>;
}

/**
 * Parse a URL path like "pkg/symbol/path" or "@scope/pkg@1.0.0/symbol.path"
 * into package name, version, and symbol path.
 */
export function parsePackageUrl(path: string): ParsedUrl {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) {
    return { packageName: "", version: undefined, symbolPath: [] };
  }

  let packageName: string;
  let startIdx = 0;

  // Handle scoped packages (@scope/pkg)
  if (parts[0]?.startsWith("@")) {
    if (parts.length < 2) {
      return { packageName: parts[0], version: undefined, symbolPath: [] };
    }
    // Extract version from second part if present (@scope/pkg@version)
    const [name, version] = parts[1].split("@");
    packageName = `${parts[0]}/${name}`;
    startIdx = 2;
    if (version) {
      return {
        packageName,
        version,
        symbolPath: parts.slice(startIdx).flatMap((p) => p.split(".")),
      };
    }
  } else {
    // Unscoped package (pkg or pkg@version)
    const [name, version] = parts[0].split("@");
    packageName = name;
    startIdx = 1;
    if (version) {
      return {
        packageName,
        version,
        symbolPath: parts.slice(startIdx).flatMap((p) => p.split(".")),
      };
    }
  }

  // No version found in package name
  return {
    packageName,
    version: undefined,
    symbolPath: parts.slice(startIdx).flatMap((p) => p.split(".")),
  };
}

/**
 * Find a symbol in the tree by following the symbol path.
 * Exact selector path matches win. Otherwise, a unique descendant-style match wins.
 */
export function findSymbolInTree(
  tree: TreeNode[],
  symbolPath: string[],
): SymbolLocation | undefined {
  const match = matchSymbolInTree(tree, symbolPath);
  return match?.kind === "single" ? match.locations[0].location : undefined;
}

function matchSymbolInTree(tree: TreeNode[], symbolPath: string[]): SymbolMatch | undefined {
  if (symbolPath.length === 0) return undefined;

  const candidates = collectSymbolCandidates(tree);
  const exactMatches = uniqueLocations(
    candidates.filter((candidate) => isExactSelectorMatch(symbolPath, candidate.selectorPath)),
  );
  if (exactMatches.length > 0) {
    return {
      kind: exactMatches.length === 1 ? "single" : "ambiguous",
      locations: exactMatches,
    };
  }

  const descendantMatches = uniqueLocations(
    candidates.filter((candidate) => isDescendantSelectorMatch(symbolPath, candidate.selectorPath)),
  );
  if (descendantMatches.length === 0) return undefined;

  return {
    kind: descendantMatches.length === 1 ? "single" : "ambiguous",
    locations: descendantMatches,
  };
}

interface SymbolCandidate {
  location: SymbolLocation;
  selectorPath: string[];
  breadcrumbs: Breadcrumb[];
}

function collectSymbolCandidates(tree: TreeNode[]): SymbolCandidate[] {
  const candidates: SymbolCandidate[] = [];
  for (const node of tree) {
    collectNodeCandidates(node, [[]], true, [], candidates);
  }
  return candidates;
}

function collectNodeCandidates(
  node: TreeNode,
  prefixes: string[][],
  isTopLevel: boolean,
  parentBreadcrumbs: Breadcrumb[],
  candidates: SymbolCandidate[],
): void {
  const selectorTokens = getNodeSelectorTokens(node);
  const expandedPrefixes = expandSelectorPrefixes(prefixes, selectorTokens);
  const nextPrefixes = isTopLevel ? prefixes.concat(expandedPrefixes) : expandedPrefixes;
  const nodeBreadcrumbs = node.url
    ? parentBreadcrumbs.concat({
        label: node.name,
        url: node.url,
      })
    : parentBreadcrumbs;

  if (node.url) {
    for (const selectorPath of nextPrefixes) {
      if (selectorPath.length > 0) {
        candidates.push({
          location: { url: node.url },
          selectorPath,
          breadcrumbs: nodeBreadcrumbs,
        });
      }
    }
  }

  if (node.outline) {
    for (const outlineItem of node.outline) {
      const location = getOutlineLocation(node, outlineItem);
      if (!location) continue;
      for (const selectorPath of nextPrefixes) {
        candidates.push({
          location,
          selectorPath: selectorPath.concat(outlineItem.name),
          breadcrumbs: nodeBreadcrumbs.concat({
            label: outlineItem.name,
            url: location.url,
          }),
        });
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      collectNodeCandidates(child, nextPrefixes, false, nodeBreadcrumbs, candidates);
    }
  }
}

function expandSelectorPrefixes(prefixes: string[][], selectorTokens: string[]): string[][] {
  const expanded: string[][] = [];
  for (const prefix of prefixes) {
    for (const token of selectorTokens) {
      expanded.push(prefix.concat(token));
    }
  }
  return expanded;
}

function getNodeSelectorTokens(node: TreeNode): string[] {
  const tokens = new Set<string>();
  const nameToken = node.name.split("/").filter(Boolean).at(-1);
  if (nameToken) {
    tokens.add(nameToken);
  }

  if (node.url?.endsWith("/index.html")) {
    const dir = node.url.slice(0, -"/index.html".length);
    const urlToken = dir.split("/").filter(Boolean).at(-1);
    if (urlToken) {
      tokens.add(urlToken);
    }
  }

  return [...tokens];
}

function getOutlineLocation(node: TreeNode, outlineItem: OutlineItem): SymbolLocation | undefined {
  if (outlineItem.linkTo) {
    return { url: outlineItem.linkTo };
  }
  if (node.url && outlineItem.anchor) {
    return { url: `${node.url}#${outlineItem.anchor}` };
  }
  return undefined;
}

function isExactSelectorMatch(symbolPath: string[], selectorPath: string[]): boolean {
  return (
    symbolPath.length === selectorPath.length &&
    symbolPath.every((segment, index) => segment === selectorPath[index])
  );
}

function isDescendantSelectorMatch(symbolPath: string[], selectorPath: string[]): boolean {
  if (symbolPath.length === 0 || selectorPath.length === 0) return false;
  if (symbolPath[symbolPath.length - 1] !== selectorPath[selectorPath.length - 1]) return false;

  let matchIndex = 0;
  for (const segment of selectorPath) {
    if (segment === symbolPath[matchIndex]) {
      matchIndex += 1;
      if (matchIndex === symbolPath.length) {
        return true;
      }
    }
  }
  return false;
}

function uniqueLocations(candidates: SymbolCandidate[]): SymbolCandidate[] {
  const unique = new Map<string, SymbolCandidate>();
  for (const candidate of candidates) {
    unique.set(candidate.location.url, candidate);
  }
  return [...unique.values()];
}

function resolveBreadcrumb(
  packageName: string,
  version: string,
  breadcrumb: Breadcrumb,
): Breadcrumb {
  return {
    label: breadcrumb.label,
    url: resolveSymbolUrl(packageName, version, breadcrumb.url),
  };
}

function resolveCandidate(
  packageName: string,
  version: string,
  candidate: SymbolCandidate,
): RedirectCandidate {
  return {
    url: resolveSymbolUrl(packageName, version, candidate.location.url),
    breadcrumbs: candidate.breadcrumbs.map((breadcrumb) =>
      resolveBreadcrumb(packageName, version, breadcrumb),
    ),
  };
}

/**
 * Construct the full URL to the documentation.
 */
export function resolveSymbolUrl(
  packageName: string,
  version: string,
  relativePath: string,
): string {
  // relativePath may contain # for anchors
  const baseUrl = `https://npm.apiref.page/package/${packageName}/v/${version}/`;
  return baseUrl + relativePath;
}

/**
 * Select a version from available versions.
 * - If exact version specified, return it if available
 * - If no version specified:
 *   - Prefer highest stable (non-prerelease) version
 *   - If only prerelease versions exist, return highest prerelease
 * - Otherwise return undefined
 */
export function selectVersion(
  requestedVersion: string | undefined,
  availableVersions: string[],
): string | undefined {
  if (availableVersions.length === 0) return undefined;

  if (requestedVersion) {
    // Exact match required
    return availableVersions.includes(requestedVersion) ? requestedVersion : undefined;
  }

  // Separate stable and prerelease versions
  const stable: string[] = [];
  const prerelease: string[] = [];

  for (const v of availableVersions) {
    if (v.includes("-")) {
      prerelease.push(v);
    } else {
      stable.push(v);
    }
  }

  // Prefer highest stable version
  if (stable.length > 0) {
    return stable.reduce((highest, current) => {
      return compareSemver(current, highest) > 0 ? current : highest;
    });
  }

  // Fall back to highest prerelease
  if (prerelease.length > 0) {
    return prerelease.reduce((highest, current) => {
      return compareSemver(current, highest) > 0 ? current : highest;
    });
  }

  return undefined;
}

/**
 * Compare two semantic versions.
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 * Handles prerelease versions (e.g., "2.0.0-next.1")
 */
function compareSemver(a: string, b: string): number {
  const parseSemver = (v: string): [number, number, number, string | undefined] => {
    const [base, prerelease] = v.split("-");
    const parts = base.split(".").map((p) => parseInt(p, 10));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0, prerelease];
  };

  const [aMajor, aMinor, aPatch, aPrerelease] = parseSemver(a);
  const [bMajor, bMinor, bPatch, bPrerelease] = parseSemver(b);

  // Compare major.minor.patch first
  if (aMajor !== bMajor) return aMajor > bMajor ? 1 : -1;
  if (aMinor !== bMinor) return aMinor > bMinor ? 1 : -1;
  if (aPatch !== bPatch) return aPatch > bPatch ? 1 : -1;

  // Same base version, compare prerelease
  // Release version (no prerelease) is higher than prerelease
  if (!aPrerelease && bPrerelease) return 1;
  if (aPrerelease && !bPrerelease) return -1;
  if (!aPrerelease && !bPrerelease) return 0;

  // Both have prerelease, compare as strings
  if (aPrerelease && bPrerelease) {
    return aPrerelease > bPrerelease ? 1 : aPrerelease < bPrerelease ? -1 : 0;
  }

  return 0;
}

/**
 * Main redirector interactor.
 * Takes a path and dependency-injected functions to resolve versions and load apiref.json.
 */
export async function redirect(
  path: string,
  options: RedirectorOptions,
): Promise<RedirectorOutcome> {
  try {
    const parsed = parsePackageUrl(path);

    // Get available versions
    let versions: string[];
    try {
      versions = await options.getVersions(parsed.packageName);
    } catch {
      return {
        kind: "error",
        reason: `Failed to fetch versions for ${parsed.packageName}`,
      };
    }

    if (versions.length === 0) {
      return {
        kind: "error",
        reason: `No versions available for ${parsed.packageName}`,
      };
    }

    // Resolve version
    let resolvedVersion: string | undefined;
    try {
      resolvedVersion = await options.resolveVersion(parsed.packageName, parsed.version);
    } catch (error) {
      return {
        kind: "error",
        reason: parsed.version
          ? `Version ${parsed.version} not found for ${parsed.packageName}`
          : `Failed to resolve version for ${parsed.packageName}`,
        details: String(error),
      };
    }

    if (!resolvedVersion) {
      return {
        kind: "error",
        reason: `Could not resolve version for ${parsed.packageName}`,
      };
    }

    // Get apiref.json
    let apirefJson: ApirefJson;
    try {
      apirefJson = (await options.getApirefJson(parsed.packageName, resolvedVersion)) as ApirefJson;
    } catch (error) {
      return {
        kind: "error",
        reason: `Failed to fetch documentation for ${parsed.packageName}@${resolvedVersion}`,
        details: String(error),
      };
    }

    // If no symbol specified, redirect to package index
    if (parsed.symbolPath.length === 0) {
      return {
        kind: "redirect",
        url: resolveSymbolUrl(parsed.packageName, resolvedVersion, "index.html"),
      };
    }

    // Find symbol in tree
    const match = matchSymbolInTree(apirefJson.tree, parsed.symbolPath);
    if (!match) {
      return {
        kind: "error",
        reason: `Symbol not found: ${parsed.symbolPath.join(".")}`,
      };
    }

    if (match.kind === "ambiguous") {
      return {
        kind: "ambiguous",
        reason: `Ambiguous symbol path: ${parsed.symbolPath.join(".")}`,
        candidates: match.locations.map((candidate) =>
          resolveCandidate(parsed.packageName, resolvedVersion, candidate),
        ),
      };
    }

    return {
      kind: "redirect",
      url: resolveSymbolUrl(parsed.packageName, resolvedVersion, match.locations[0].location.url),
    };
  } catch (error) {
    return {
      kind: "error",
      reason: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
