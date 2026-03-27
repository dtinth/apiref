import { ANCHOR_KINDS, Kind, PAGE_KINDS, type TDDeclaration, type TDProject } from "./typedoc.ts";
import type { Breadcrumb, NavNode, PageViewModel, SiteViewModel } from "./viewmodel.ts";
import { getKindIcon } from "./components/kind-icons.ts";
import { byLabel } from "./utils.ts";
import { buildModuleImportPath, declarationNavNode } from "./nav.ts";
import {
  buildPackageIndexPage,
  buildModulePage,
  buildMultiDeclarationPage,
  buildDeclarationPage,
} from "./page-builders.ts";
import type { TransformContext } from "./transform-context.ts";

/**
 * Options for transforming TypeDoc JSON to a SiteViewModel.
 */
export interface TransformOptions {
  /**
   * Override the package version.
   *
   * If not specified, falls back to `packageVersion` in the TypeDoc JSON,
   * then defaults to "0.0.0".
   */
  version?: string;
}

/**
 * Transform a TypeDoc v2.0 JSON project into a SiteViewModel ready for rendering.
 *
 * This is the first step in the rendering pipeline:
 * 1. Parse TypeDoc JSON (v2.0 schema)
 * 2. Build URL map, navigate tree structure
 * 3. Create pages, sections, and member view models
 * 4. Return a complete SiteViewModel
 *
 * @param input - The TypeDoc JSON project object (or raw JSON to parse)
 * @param options - Transformation options (e.g., override version)
 * @returns A SiteViewModel representing the entire documentation site
 *
 * @throws Error if the TypeDoc schema version is not "2.0"
 *
 * @example
 * ```typescript
 * const json = JSON.parse(typedocJsonString);
 * const site = transform(json, { version: "2.0.0" });
 * ```
 */
export function transform(input: unknown, options: TransformOptions = {}): SiteViewModel {
  const project = input as TDProject;
  if (project.schemaVersion !== "2.0") {
    throw new Error(
      `Unsupported TypeDoc schema version: ${String(project.schemaVersion)}. Expected "2.0".`,
    );
  }

  const pkgName = project.packageName ?? project.name;
  const pkgVersion = options.version ?? project.packageVersion ?? "0.0.0";

  const children = project.children ?? [];
  const isSingleEntry = children.every((c) => c.kind !== Kind.Module);

  const idToUrl = new Map<number, string>();
  idToUrl.set(project.id, "index.html");

  if (isSingleEntry) {
    for (const child of children) {
      registerReflection(child, "", isSingleEntry, idToUrl);
    }
  } else {
    for (const mod of children) {
      // Normalize empty module names (from "." export) to "index"
      if (mod.name === "") {
        mod.name = "index";
      }
      const modUrl = encodeModulePath(mod.name) + "/index.html";
      idToUrl.set(mod.id, modUrl);

      // Group children by name to detect multi-declaration groups
      const nameGroups = new Map<string, TDDeclaration[]>();
      for (const child of mod.children ?? []) {
        if (PAGE_KINDS.has(child.kind)) {
          if (!nameGroups.has(child.name)) {
            nameGroups.set(child.name, []);
          }
          nameGroups.get(child.name)!.push(child);
        }
      }

      // Register each child, using namespace URL if multiple declarations share a name
      for (const child of mod.children ?? []) {
        if (PAGE_KINDS.has(child.kind)) {
          const group = nameGroups.get(child.name)!;
          let urlDecl = child;

          // If this is part of a multi-declaration group, use the namespace declaration for URL generation
          if (group.length > 1) {
            const namespace = group.find((d) => d.kind === Kind.Namespace);
            if (namespace) {
              urlDecl = namespace;
            }
          }

          registerReflection(child, encodeModulePath(mod.name), false, idToUrl, urlDecl);
        } else {
          registerReflection(child, encodeModulePath(mod.name), false, idToUrl);
        }
      }
    }
  }

  const idToBreadcrumbs = buildBreadcrumbLookup(project, children, isSingleEntry, pkgName, idToUrl);
  const ctx: TransformContext = { idToUrl, idToBreadcrumbs, pkgName, pkgVersion };

  const pages: PageViewModel[] = [];
  const navTree: NavNode[] = [];

  // Package index page
  pages.push(buildPackageIndexPage(project, children, isSingleEntry, ctx));

  if (isSingleEntry) {
    const navChildren: NavNode[] = [];
    // Group children by name to detect duplicates
    const nameGroups = new Map<string, TDDeclaration[]>();
    for (const child of children) {
      if (!nameGroups.has(child.name)) {
        nameGroups.set(child.name, []);
      }
      nameGroups.get(child.name)!.push(child);
    }

    for (const [_name, decls] of nameGroups) {
      collectNameGroupPages(decls, [], ctx, pages, navChildren, idToUrl);
    }
    navTree.push(...navChildren.sort(byLabel));
  } else {
    for (const mod of children) {
      const modUrl = idToUrl.get(mod.id) ?? "index.html";
      const modBreadcrumbs: Breadcrumb[] = [{ label: pkgName, url: "index.html" }];
      pages.push(buildModulePage(mod, modBreadcrumbs, ctx));

      const modNavChildren: NavNode[] = [];
      const modChildGroups = new Map<string, TDDeclaration[]>();
      for (const child of mod.children ?? []) {
        if (!modChildGroups.has(child.name)) {
          modChildGroups.set(child.name, []);
        }
        modChildGroups.get(child.name)!.push(child);
      }

      for (const [_name, decls] of modChildGroups) {
        collectNameGroupPages(
          decls,
          modBreadcrumbs.concat({ label: mod.name, url: modUrl }),
          ctx,
          pages,
          modNavChildren,
          idToUrl,
        );
      }
      navTree.push({
        label: buildModuleImportPath(pkgName, mod.name),
        url: modUrl,
        kind: "module",
        iconClass: getKindIcon("module"),
        flags: {},
        children: modNavChildren.sort(byLabel),
      });
    }
    // Sort modules with index first, then alphabetically
    navTree.sort((a, b) => {
      const aIsIndex = a.label === pkgName;
      const bIsIndex = b.label === pkgName;
      if (aIsIndex) return -1;
      if (bIsIndex) return 1;
      return a.label.localeCompare(b.label);
    });
  }

  return { package: { name: pkgName, version: pkgVersion }, pages, navTree };
}

function buildBreadcrumbLookup(
  project: TDProject,
  children: TDDeclaration[],
  isSingleEntry: boolean,
  pkgName: string,
  idToUrl: Map<number, string>,
): Map<number, Breadcrumb[]> {
  const idToBreadcrumbs = new Map<number, Breadcrumb[]>();
  idToBreadcrumbs.set(project.id, [{ label: pkgName, url: "index.html" }]);

  if (isSingleEntry) {
    for (const child of children) {
      collectDeclarationBreadcrumbs(child, [], idToUrl, idToBreadcrumbs);
    }
  } else {
    for (const mod of children) {
      const modUrl = idToUrl.get(mod.id) ?? "index.html";
      const modBreadcrumbs = [
        { label: pkgName, url: "index.html" },
        { label: mod.name, url: modUrl },
      ];
      idToBreadcrumbs.set(mod.id, modBreadcrumbs);

      for (const child of mod.children ?? []) {
        collectDeclarationBreadcrumbs(child, modBreadcrumbs, idToUrl, idToBreadcrumbs);
      }
    }
  }

  return idToBreadcrumbs;
}

function collectNameGroupPages(
  decls: TDDeclaration[],
  breadcrumbs: Breadcrumb[],
  ctx: TransformContext,
  pages: PageViewModel[],
  navChildren: NavNode[],
  idToUrl: Map<number, string>,
): void {
  if (decls.length > 1 && decls.every((d) => PAGE_KINDS.has(d.kind))) {
    // Multiple declarations with same name - combine on one page
    const page = buildMultiDeclarationPage(decls, breadcrumbs, ctx);
    if (page) {
      pages.push(page);
      for (const decl of decls) {
        const navNode = declarationNavNode(decl, idToUrl);
        navChildren.push(navNode);
        // For namespace declarations, recurse into PAGE_KINDS children
        if (decl.kind === Kind.Namespace) {
          const declUrl = idToUrl.get(decl.id);
          if (declUrl) {
            const nestedNavChildren: NavNode[] = [];
            for (const child of decl.children ?? []) {
              if (PAGE_KINDS.has(child.kind)) {
                collectDeclarationPages(
                  child,
                  breadcrumbs.concat({ label: decl.name, url: declUrl }),
                  ctx,
                  pages,
                  nestedNavChildren,
                  idToUrl,
                );
              }
            }
            navNode.children = nestedNavChildren.sort(byLabel);
          }
        }
      }
    }
  } else {
    // Single declaration or mixed kinds
    for (const decl of decls) {
      collectDeclarationPages(decl, breadcrumbs, ctx, pages, navChildren, idToUrl);
    }
  }
}

function collectDeclarationPages(
  decl: TDDeclaration,
  breadcrumbs: Breadcrumb[],
  ctx: TransformContext,
  pages: PageViewModel[],
  navChildren: NavNode[],
  idToUrl: Map<number, string>,
): void {
  const page = buildDeclarationPage(decl, breadcrumbs, ctx);
  if (page) {
    pages.push(page);
    const navNode = declarationNavNode(decl, idToUrl);
    navChildren.push(navNode);

    // Recursively process nested PAGE_KINDS and ANCHOR_KINDS
    const declUrl = idToUrl.get(decl.id);
    if (declUrl && PAGE_KINDS.has(decl.kind)) {
      const nestedNavChildren: NavNode[] = [];
      for (const child of decl.children ?? []) {
        if (PAGE_KINDS.has(child.kind)) {
          // Nested namespace/class/interface - recurse
          collectDeclarationPages(
            child,
            breadcrumbs.concat({ label: decl.name, url: declUrl }),
            ctx,
            pages,
            nestedNavChildren,
            idToUrl,
          );
        } else if (ANCHOR_KINDS.has(child.kind)) {
          // Methods, properties, constructors, etc.
          const childPage = buildDeclarationPage(
            child,
            breadcrumbs.concat({ label: decl.name, url: declUrl }),
            ctx,
          );
          if (childPage) {
            pages.push(childPage);
            nestedNavChildren.push(declarationNavNode(child, idToUrl));
          }
        }
      }

      // Populate the namespace's nav node with its children
      navNode.children = nestedNavChildren.sort(byLabel);
    }
  }
}

function collectDeclarationBreadcrumbs(
  decl: TDDeclaration,
  parentBreadcrumbs: Breadcrumb[],
  idToUrl: Map<number, string>,
  idToBreadcrumbs: Map<number, Breadcrumb[]>,
): void {
  const url = idToUrl.get(decl.id);
  if (!url) return;

  const label = decl.kind === Kind.Constructor ? "constructor" : decl.name;
  const breadcrumbs = parentBreadcrumbs.concat({ label, url });
  idToBreadcrumbs.set(decl.id, breadcrumbs);

  if (!PAGE_KINDS.has(decl.kind)) return;

  for (const child of decl.children ?? []) {
    if (PAGE_KINDS.has(child.kind)) {
      collectDeclarationBreadcrumbs(child, breadcrumbs, idToUrl, idToBreadcrumbs);
      continue;
    }

    if (ANCHOR_KINDS.has(child.kind)) {
      const childUrl = idToUrl.get(child.id);
      if (!childUrl) continue;
      const childLabel = child.kind === Kind.Constructor ? "constructor" : child.name;
      idToBreadcrumbs.set(child.id, breadcrumbs.concat({ label: childLabel, url: childUrl }));
    }
  }
}

function registerReflection(
  decl: TDDeclaration,
  pathPrefix: string,
  isSingleEntry: boolean,
  idToUrl: Map<number, string>,
  urlDecl?: TDDeclaration,
): void {
  const url = declarationUrl(urlDecl ?? decl, pathPrefix, isSingleEntry);
  idToUrl.set(decl.id, url);

  for (const child of decl.children ?? []) {
    if (ANCHOR_KINDS.has(child.kind)) {
      const anchor = child.kind === Kind.Constructor ? "constructor" : child.name;
      idToUrl.set(child.id, `${url}#${anchor}`);
      // Register constructor/method signature IDs too
      for (const sig of child.signatures ?? []) {
        idToUrl.set(sig.id, `${url}#${anchor}`);
      }
    } else if (PAGE_KINDS.has(child.kind)) {
      const childPrefix = pathPrefix ? `${pathPrefix}/${decl.name}` : decl.name;
      const childUrl = declarationUrl(child, childPrefix, false);
      idToUrl.set(child.id, childUrl);

      // Recurse for nested PAGE_KINDS within this child
      const childPathPrefix = childPrefix ? `${childPrefix}/${child.name}` : child.name;
      for (const nestedChild of child.children ?? []) {
        if (PAGE_KINDS.has(nestedChild.kind)) {
          registerReflection(nestedChild, childPathPrefix, false, idToUrl);
        }
      }
    }
  }
  // Accessor signatures
  if (decl.getSignature) idToUrl.set(decl.getSignature.id, `${url}#${decl.name}`);
  if (decl.setSignature) idToUrl.set(decl.setSignature.id, `${url}#${decl.name}`);
}

function declarationUrl(decl: TDDeclaration, pathPrefix: string, isSingleEntry: boolean): string {
  const prefix = isSingleEntry ? "" : pathPrefix ? pathPrefix + "/" : "";
  const { kind, name } = decl;
  switch (kind) {
    case Kind.Namespace:
      return `${prefix}${name}/index.html`;
    case Kind.Class:
    case Kind.Interface:
    case Kind.TypeAlias:
    case Kind.Enum:
    case Kind.Function:
    case Kind.Variable:
      return `${prefix}${name}.html`;
    default:
      return `${prefix}${name}.html`;
  }
}

function encodeModulePath(moduleName: string): string {
  // Module names may contain "/" (e.g. "integrations/playwright") — keep as-is
  return moduleName;
}
