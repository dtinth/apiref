import { ANCHOR_KINDS, Kind, PAGE_KINDS, type TDDeclaration, type TDProject } from "./typedoc.ts";
import type {
  Breadcrumb,
  NavNode,
  PageViewModel,
  Section,
  SectionBlock,
  SiteViewModel,
} from "./viewmodel.ts";
import { getKindIcon } from "./components/kind-icons.ts";
import {
  reflectionKindToDeclarationKind,
  byLabel,
  inferGroups,
  inferDeclarationKind,
} from "./utils.ts";
import {
  transformComment,
  transformCommentParts,
  extractBlockTagSections,
} from "./comment-transformer.ts";
import { buildModuleImportPath, declarationNavNode } from "./nav.ts";
import {
  buildClassSections,
  buildMemberSections,
  buildFunctionSections,
  buildTypeAliasSections,
  buildEnumSections,
  buildVariableSections,
} from "./section-builders.ts";
import { transformType, transformSignature, transformFlags } from "./type-transformer.ts";
import { declarationAsCards } from "./card-builder.ts";
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

  // --- Pass 1: build id → url map ---
  const idToUrl = new Map<number, string>();
  idToUrl.set(project.id, "index.html");

  if (isSingleEntry) {
    for (const child of children) {
      registerReflection(child, "", isSingleEntry, idToUrl);
    }
  } else {
    for (const mod of children) {
      const modUrl = encodeModulePath(mod.name) + "/index.html";
      idToUrl.set(mod.id, modUrl);
      for (const child of mod.children ?? []) {
        registerReflection(child, encodeModulePath(mod.name), false, idToUrl);
      }
    }
  }

  // --- Pass 2: build pages ---
  const ctx: TransformContext = { idToUrl, pkgName, pkgVersion };

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
      if (decls.length > 1 && decls.every((d) => PAGE_KINDS.has(d.kind))) {
        // Multiple declarations with same name - combine on one page
        const page = buildMultiDeclarationPage(decls, [], ctx);
        if (page) {
          pages.push(page);
          // Create one nav node that points to the shared page
          for (const decl of decls) {
            navChildren.push(declarationNavNode(decl, idToUrl));
          }
        }
      } else {
        // Single declaration or mixed kinds - process normally
        for (const child of decls) {
          const page = buildDeclarationPage(child, [], ctx);
          if (page) {
            pages.push(page);
            navChildren.push(declarationNavNode(child, idToUrl));
          }
        }
      }
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
        if (decls.length > 1 && decls.every((d) => PAGE_KINDS.has(d.kind))) {
          // Multiple declarations with same name - combine on one page
          const page = buildMultiDeclarationPage(
            decls,
            modBreadcrumbs.concat({ label: mod.name, url: modUrl }),
            ctx,
          );
          if (page) {
            pages.push(page);
            for (const decl of decls) {
              modNavChildren.push(declarationNavNode(decl, idToUrl));
            }
          }
        } else {
          // Normal path for single declarations or mixed kinds
          for (const child of decls) {
            collectDeclarationPages(
              child,
              modBreadcrumbs.concat({ label: mod.name, url: modUrl }),
              ctx,
              pages,
              modNavChildren,
              idToUrl,
            );
          }
        }
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

// ---------------------------------------------------------------------------
// Page collection helper (recursively handles nested PAGE_KINDS)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// URL registration (pass 1)
// ---------------------------------------------------------------------------

function registerReflection(
  decl: TDDeclaration,
  pathPrefix: string,
  isSingleEntry: boolean,
  idToUrl: Map<number, string>,
): void {
  const url = declarationUrl(decl, pathPrefix, isSingleEntry);
  idToUrl.set(decl.id, url);

  // Detect duplicate names among PAGE_KINDS
  const pageKindChildren = (decl.children ?? []).filter((c) => PAGE_KINDS.has(c.kind));
  const nameGroups = new Map<string, TDDeclaration[]>();
  for (const child of pageKindChildren) {
    if (!nameGroups.has(child.name)) {
      nameGroups.set(child.name, []);
    }
    nameGroups.get(child.name)!.push(child);
  }

  for (const child of decl.children ?? []) {
    if (ANCHOR_KINDS.has(child.kind)) {
      const anchor = child.kind === Kind.Constructor ? "constructor" : child.name;
      idToUrl.set(child.id, `${url}#${anchor}`);
      // Register constructor/method signature IDs too
      for (const sig of child.signatures ?? []) {
        idToUrl.set(sig.id, `${url}#${anchor}`);
      }
    } else if (PAGE_KINDS.has(child.kind)) {
      // All duplicate declarations share the same URL
      const childPrefix = pathPrefix ? `${pathPrefix}/${child.name}` : child.name;
      const childUrl = declarationUrl(child, childPrefix, false);
      idToUrl.set(child.id, childUrl);

      // Recurse for nested PAGE_KINDS within this child
      const childPathPrefix = pathPrefix ? `${pathPrefix}/${child.name}` : child.name;
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

// ---------------------------------------------------------------------------
// Page builders (pass 2)
// ---------------------------------------------------------------------------

function buildPackageIndexPage(
  project: TDProject,
  topLevel: TDDeclaration[],
  isSingleEntry: boolean,
  ctx: TransformContext,
): PageViewModel {
  const sections: Section[] = [];

  sections.push({
    body: [
      {
        kind: "declaration-title",
        name: ctx.pkgName,
        declarationKind: "package-index",
      },
    ],
  });

  if (project.readme && project.readme.length > 0) {
    sections.push({
      body: [{ kind: "doc", doc: transformCommentParts(project.readme, ctx) }],
    });
  } else if (project.comment) {
    const doc = transformComment(project.comment, ctx);
    if (doc.length > 0) sections.push({ body: [{ kind: "doc", doc }] });
  }

  if (isSingleEntry) {
    // Group children by TypeDoc group titles
    const groups = project.groups ?? inferGroups(topLevel);
    const idToDecl = new Map(topLevel.map((c) => [c.id, c]));
    for (const group of groups) {
      const members = group.children
        .map((id) => idToDecl.get(id))
        .filter((d): d is TDDeclaration => d !== undefined);
      sections.push({
        title: group.title,
        body: members.flatMap((d) => declarationAsCards(d, ctx)),
      });
    }
  } else {
    // List modules
    sections.push({
      title: "Modules",
      body: topLevel.flatMap((d) => declarationAsCards(d, ctx)),
    });
  }

  return {
    url: "index.html",
    title: ctx.pkgName,
    kind: "package-index",
    breadcrumbs: [],
    sections,
  };
}

function buildModulePage(
  mod: TDDeclaration,
  breadcrumbs: Breadcrumb[],
  ctx: TransformContext,
): PageViewModel {
  const url = ctx.idToUrl.get(mod.id) ?? "index.html";
  const sections: Section[] = [];

  sections.push({
    body: [{ kind: "declaration-title", name: mod.name, declarationKind: "module" }],
  });

  if (mod.comment) {
    const doc = transformComment(mod.comment, ctx);
    if (doc.length > 0) sections.push({ body: [{ kind: "doc", doc }] });
  }

  const children = mod.children ?? [];
  const groups = mod.groups ?? inferGroups(children);
  const idToDecl = new Map(children.map((c) => [c.id, c]));

  for (const group of groups) {
    const members = group.children
      .map((id) => idToDecl.get(id))
      .filter((d): d is TDDeclaration => d !== undefined);
    sections.push({
      title: group.title,
      body: members.flatMap((d) => declarationAsCards(d, ctx)),
    });
  }

  return {
    url,
    title: mod.name,
    kind: "module",
    breadcrumbs,
    sections,
  };
}

function buildMultiDeclarationPage(
  decls: TDDeclaration[],
  parentBreadcrumbs: Breadcrumb[],
  ctx: TransformContext,
): PageViewModel | null {
  if (decls.length === 0) return null;

  // Use the URL from the first declaration (all share the same URL)
  const url = ctx.idToUrl.get(decls[0].id);
  if (!url) return null;

  const sections: Section[] = [];

  // Build sections for each declaration
  for (const decl of decls) {
    // Add a heading for this declaration's kind
    const kind = reflectionKindToDeclarationKind(decl.kind);

    // Add the declaration-title for this specific declaration
    if (kind) {
      sections.push({
        body: [{ kind: "declaration-title", name: decl.name, declarationKind: kind }],
      });
    }

    // Summary from comment
    const commentSource =
      decl.kind === Kind.Function || decl.kind === Kind.Variable
        ? (decl.signatures?.[0]?.comment ?? decl.comment)
        : decl.comment;

    if (commentSource) {
      const doc = transformComment(commentSource, ctx);
      if (doc.length > 0) sections.push({ body: [{ kind: "doc", doc }] });
      const blockTags = extractBlockTagSections(commentSource, ctx);
      sections.push(...blockTags.examples);
    }

    // Build kind-specific sections
    switch (decl.kind) {
      case Kind.Class:
        sections.push(...buildClassSections(decl, ctx));
        break;
      case Kind.Interface:
        sections.push(...buildMemberSections(decl, ctx));
        break;
      case Kind.Function:
        sections.push(...buildFunctionSections(decl, ctx));
        break;
      case Kind.TypeAlias:
        sections.push(...buildTypeAliasSections(decl, ctx));
        break;
      case Kind.Enum:
        sections.push(...buildEnumSections(decl, ctx));
        break;
      case Kind.Variable:
        sections.push(...buildVariableSections(decl, ctx));
        break;
      case Kind.Namespace:
        sections.push(...buildMemberSections(decl, ctx));
        break;
    }
  }

  return {
    url,
    title: decls[0].name,
    kind: "multiple",
    breadcrumbs: parentBreadcrumbs,
    sections,
  };
}

function buildDeclarationPage(
  decl: TDDeclaration,
  parentBreadcrumbs: Breadcrumb[],
  ctx: TransformContext,
): PageViewModel | null {
  const url = ctx.idToUrl.get(decl.id);
  if (!url) return null;

  const kind = reflectionKindToDeclarationKind(decl.kind);
  if (!kind) return null;

  const sections: Section[] = [];

  // Prepend declaration-title section
  sections.push({
    body: [{ kind: "declaration-title", name: decl.name, declarationKind: kind }],
  });

  // Summary from comment (prefer signature comment for functions)
  const commentSource =
    decl.kind === Kind.Function || decl.kind === Kind.Variable
      ? (decl.signatures?.[0]?.comment ?? decl.comment)
      : decl.comment;

  if (commentSource) {
    const doc = transformComment(commentSource, ctx);
    if (doc.length > 0) sections.push({ body: [{ kind: "doc", doc }] });
    const blockTags = extractBlockTagSections(commentSource, ctx);
    sections.push(...blockTags.examples);
  }

  switch (decl.kind) {
    case Kind.Class:
      sections.push(...buildClassSections(decl, ctx));
      break;
    case Kind.Interface:
      sections.push(...buildMemberSections(decl, ctx));
      break;
    case Kind.Function:
      sections.push(...buildFunctionSections(decl, ctx));
      break;
    case Kind.TypeAlias:
      sections.push(...buildTypeAliasSections(decl, ctx));
      break;
    case Kind.Enum:
      sections.push(...buildEnumSections(decl, ctx));
      break;
    case Kind.Variable:
      sections.push(...buildVariableSections(decl, ctx));
      break;
    case Kind.Namespace:
      sections.push(...buildMemberSections(decl, ctx));
      break;
  }

  return {
    url,
    title: decl.name,
    kind,
    breadcrumbs: parentBreadcrumbs,
    sections,
  };
}

// ---------------------------------------------------------------------------
// Member / signature helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Reflection type member blocks
// ---------------------------------------------------------------------------

export function buildReflectionMemberBlocks(
  decl: TDDeclaration,
  ctx: TransformContext,
): SectionBlock[] {
  const flags = transformFlags(decl.flags);
  const signatures = (decl.signatures ?? []).map((s) => transformSignature(s, ctx));
  const type = decl.type ? transformType(decl.type, ctx) : null;

  // For reflection type members, create minimal blocks for inline rendering
  // Only include type info, not full documentation
  if (signatures.length > 0) {
    // Function/method property: name: (params) => returnType
    return [
      {
        kind: "declaration-title",
        name: decl.name,
        declarationKind: inferDeclarationKind(decl),
      },
      { kind: "signatures", signatures },
    ];
  }

  if (type) {
    // Property with a type: name: type or name?: type
    return [
      {
        kind: "type-declaration",
        name: decl.name,
        type,
        optional: flags.optional,
      },
    ];
  }

  // No type info available, render as empty property
  return [
    {
      kind: "type-declaration",
      name: decl.name,
      type: { kind: "unknown", raw: "unknown" },
    },
  ];
}

// ---------------------------------------------------------------------------
// Type transformer
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Comment / doc transformers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Nav helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
