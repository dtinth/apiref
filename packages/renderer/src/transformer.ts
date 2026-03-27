import {
  ANCHOR_KINDS,
  Kind,
  PAGE_KINDS,
  type TDComment,
  type TDCommentPart,
  type TDDeclaration,
  type TDParameter,
  type TDProject,
  type TDSignature,
  type TDType,
  type TDTypeParameter,
} from "./typedoc.ts";
import type {
  Breadcrumb,
  DeclarationKind,
  DocNode,
  MemberFlags,
  NavNode,
  PageViewModel,
  ParameterDocViewModel,
  ParameterViewModel,
  Section,
  SectionBlock,
  SignatureViewModel,
  SiteViewModel,
  TypeParameterViewModel,
  TypeViewModel,
} from "./viewmodel.ts";
import { getKindIcon } from "./components/kind-icons.ts";
import { reflectionKindToDeclarationKind, byLabel, inferGroups } from "./utils.ts";

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

interface TransformContext {
  idToUrl: Map<number, string>;
  pkgName: string;
  pkgVersion: string;
}

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
// Section builders
// ---------------------------------------------------------------------------

function buildClassSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
  const sections: Section[] = [];
  const children = decl.children ?? [];
  const groups = decl.groups ?? inferGroups(children);
  const idToDecl = new Map(children.map((c) => [c.id, c]));

  for (const group of groups) {
    const members = group.children
      .map((id) => idToDecl.get(id))
      .filter((d): d is TDDeclaration => d !== undefined);

    sections.push({
      title: group.title === "Constructors" ? "Constructor" : group.title,
      body: members.flatMap((d) => declarationAsCards(d, ctx)),
    });
  }
  return sections;
}

function buildMemberSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
  const sections: Section[] = [];
  const children = decl.children ?? [];
  const groups = decl.groups ?? inferGroups(children);
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
  return sections;
}

function buildFunctionSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
  const sigs = decl.signatures ?? [];
  if (sigs.length === 0) return [];

  const transformedSigs = sigs.map((s) => transformSignature(s, ctx));

  // Single signature: inline display (no card)
  if (transformedSigs.length === 1) {
    const rawSig = sigs[0];
    const sig = transformedSigs[0];
    const blockTags = extractBlockTagSections(rawSig.comment, ctx);
    const sections: Section[] = [];
    // Order: examples → signature → type params → params → returns → throws
    sections.push(...blockTags.examples);
    sections.push({ title: "Signature", body: [{ kind: "signatures", signatures: [sig] }] });
    // Type parameters
    const typeParamDocs = (rawSig.typeParameters ?? [])
      .filter((tp) => tp.comment?.summary?.length)
      .map((tp) => ({ name: tp.name, doc: transformCommentParts(tp.comment!.summary, ctx) }));
    if (typeParamDocs.length > 0) {
      sections.push({
        title: "Type Parameters",
        body: [{ kind: "parameters", parameters: typeParamDocs }],
      });
    }
    // Parameters
    const params = (rawSig.parameters ?? [])
      .filter((p) => p.comment?.summary?.length)
      .map((p) => ({ name: p.name, doc: transformCommentParts(p.comment!.summary, ctx) }));
    if (params.length > 0) {
      sections.push({
        title: "Parameters",
        body: [{ kind: "parameters", parameters: params }],
      });
    }
    sections.push(...blockTags.returns, ...blockTags.throws);
    return sections;
  }

  // Multiple signatures: one card per overload
  const n = transformedSigs.length;
  const cards = transformedSigs.map((sig, i) => {
    const blockTags = extractBlockTagSections(sigs[i].comment, ctx);
    const extraSections: Section[] = [];
    extraSections.push(...blockTags.examples);
    // Type parameters
    const typeParamDocs = (sigs[i].typeParameters ?? [])
      .filter((tp) => tp.comment?.summary?.length)
      .map((tp) => ({ name: tp.name, doc: transformCommentParts(tp.comment!.summary, ctx) }));
    if (typeParamDocs.length > 0) {
      extraSections.push({
        title: "Type Parameters",
        body: [{ kind: "parameters", parameters: typeParamDocs }],
      });
    }
    // Parameters
    const params = (sigs[i].parameters ?? [])
      .filter((p) => p.comment?.summary?.length)
      .map((p) => ({ name: p.name, doc: transformCommentParts(p.comment!.summary, ctx) }));
    if (params.length > 0) {
      extraSections.push({
        title: "Parameters",
        body: [{ kind: "parameters", parameters: params }],
      });
    }
    extraSections.push(...blockTags.returns, ...blockTags.throws);
    const label = `${decl.name} (${i + 1}/${n})`;
    const anchor = `${decl.name}-${i + 1}`;
    return buildSignatureCard(decl.name, label, anchor, sig, {}, "function", extraSections);
  });

  return [{ title: "Signatures", body: cards }];
}

function buildTypeAliasSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
  if (!decl.type) return [];
  return [
    {
      body: [{ kind: "type-declaration", type: transformType(decl.type, ctx) }],
    },
  ];
}

function buildEnumSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
  const children = decl.children ?? [];
  if (children.length === 0) return [];
  return [
    {
      title: "Members",
      body: children.flatMap((d) => declarationAsCards(d, ctx)),
    },
  ];
}

function buildVariableSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
  if (!decl.type) return [];
  return [
    {
      body: [{ kind: "type-declaration", type: transformType(decl.type, ctx) }],
    },
  ];
}

// ---------------------------------------------------------------------------
// Member / signature helpers
// ---------------------------------------------------------------------------

function buildSignatureCard(
  name: string,
  label: string,
  anchor: string,
  sig: SignatureViewModel,
  flags: MemberFlags,
  kind: DeclarationKind,
  extraSections: Section[] = [],
): SectionBlock & { kind: "card" } {
  const sections: Section[] = [
    {
      body: [{ kind: "declaration-title", name: label, declarationKind: kind }],
    },
  ];

  if (hasRenderableMemberFlags(flags)) {
    sections.push({ body: [{ kind: "flags", flags }] });
  }

  sections.push({
    title: "Signature",
    body: [{ kind: "signatures", signatures: [sig] }],
  });

  sections.push(...extraSections);

  return { kind: "card", anchor, url: undefined, flags, sections };
}

function declarationAsCards(
  decl: TDDeclaration,
  ctx: TransformContext,
): Array<SectionBlock & { kind: "card" }> {
  const baseName = decl.kind === Kind.Constructor ? "constructor" : decl.name;
  const flags = transformFlags(decl.flags);

  // Check @deprecated modifier tag and block tag message
  const allModifierTags = [
    ...(decl.comment?.modifierTags ?? []),
    ...(decl.signatures?.flatMap((s) => s.comment?.modifierTags ?? []) ?? []),
  ];
  if (allModifierTags.includes("@deprecated")) flags.deprecated = true;

  const deprecatedBlockTag = [
    ...(decl.comment?.blockTags ?? []),
    ...(decl.signatures?.flatMap((s) => s.comment?.blockTags ?? []) ?? []),
  ].find((t) => t.tag === "@deprecated");
  if (deprecatedBlockTag?.content.length) {
    flags.deprecatedMessage = transformCommentParts(deprecatedBlockTag.content, ctx);
  }

  const rawSignatures = decl.signatures ?? [];
  const signatures = rawSignatures.map((s) => transformSignature(s, ctx));
  const type = decl.type ? transformType(decl.type, ctx) : null;
  const commentSource = rawSignatures[0]?.comment ?? decl.comment;
  const doc = commentSource ? transformComment(commentSource, ctx) : [];
  const url = PAGE_KINDS.has(decl.kind) ? ctx.idToUrl.get(decl.id) : undefined;
  const kind = declarationKindForMember(decl, signatures);

  // If the member has its own page, use the old single-card-with-link approach
  // (card shows summary only; examples/blockTags appear on the dedicated page)
  if (url) {
    const docSections: Section[] = doc.length > 0 ? [{ body: [{ kind: "doc", doc }] }] : [];
    return [
      {
        kind: "card",
        anchor: baseName,
        url,
        flags,
        sections: [
          {
            body: [
              {
                kind: "declaration-title",
                name: decl.name,
                declarationKind: kind,
              },
            ],
          },
          ...docSections,
        ],
      },
    ];
  }

  // Single signature or no signatures: use the old buildCardSections approach
  if (signatures.length <= 1) {
    const cardSections = buildCardSections({
      name: decl.name,
      flags,
      signatures,
      rawSignatures,
      type,
      doc,
      url: undefined,
      ctx,
    });
    return [
      {
        kind: "card",
        anchor: baseName,
        url: undefined,
        flags,
        sections: [
          {
            body: [
              {
                kind: "declaration-title",
                name: decl.name,
                declarationKind: kind,
              },
            ],
          },
          ...cardSections,
        ],
      },
    ];
  }

  // Multiple signatures: one card per signature
  const n = signatures.length;
  return signatures.map((sig, i) => {
    const blockTags = extractBlockTagSections(rawSignatures[i].comment, ctx);
    const extraSections: Section[] = [];
    extraSections.push(...blockTags.examples);
    // Type parameters
    const typeParamDocs = (rawSignatures[i].typeParameters ?? [])
      .filter((tp) => tp.comment?.summary?.length)
      .map((tp) => ({ name: tp.name, doc: transformCommentParts(tp.comment!.summary, ctx) }));
    if (typeParamDocs.length > 0) {
      extraSections.push({
        title: "Type Parameters",
        body: [{ kind: "parameters", parameters: typeParamDocs }],
      });
    }
    // Parameters
    const params = (rawSignatures[i].parameters ?? [])
      .filter((p) => p.comment?.summary?.length)
      .map((p) => ({ name: p.name, doc: transformCommentParts(p.comment!.summary, ctx) }));
    if (params.length > 0) {
      extraSections.push({
        title: "Parameters",
        body: [{ kind: "parameters", parameters: params }],
      });
    }
    extraSections.push(...blockTags.returns, ...blockTags.throws);
    const label = `${decl.name} (${i + 1}/${n})`;
    const anchor = `${baseName}-${i + 1}`;
    // Only include flags on the first card to avoid repetition
    return buildSignatureCard(
      decl.name,
      label,
      anchor,
      sig,
      i === 0 ? flags : {},
      kind,
      extraSections,
    );
  });
}

function declarationKindForMember(
  decl: TDDeclaration,
  signatures: SignatureViewModel[],
): DeclarationKind {
  const pageKind = reflectionKindToDeclarationKind(decl.kind);
  if (pageKind) return pageKind;
  return inferMemberKind(decl, signatures);
}

function inferMemberKind(
  decl: TDDeclaration,
  signatures: SignatureViewModel[],
): Extract<DeclarationKind, "constructor" | "accessor" | "method" | "property"> {
  // Constructor
  if (decl.kind === Kind.Constructor) return "constructor";
  // Accessor (getter/setter)
  if (decl.getSignature || decl.setSignature) return "accessor";
  // Method or function (has signatures)
  if (signatures.length > 0) return "method";
  // Default to property
  return "property";
}

function buildCardSections(input: {
  name: string;
  flags: MemberFlags;
  signatures: SignatureViewModel[];
  rawSignatures: TDSignature[];
  type: TypeViewModel | null;
  doc: DocNode[];
  url?: string;
  ctx: TransformContext;
}): Section[] {
  if (input.url) {
    return input.doc.length > 0 ? [{ body: [{ kind: "doc", doc: input.doc }] }] : [];
  }

  const sections: Section[] = [];

  // Flags (if renderable)
  if (hasRenderableMemberFlags(input.flags)) {
    sections.push({ body: [{ kind: "flags", flags: input.flags }] });
  }

  // Signatures or type declaration
  if (input.signatures.length > 0) {
    sections.push({
      title: "Signature",
      body: [{ kind: "signatures", signatures: input.signatures }],
    });
  } else if (input.type) {
    sections.push({
      title: "Type",
      body: [
        {
          kind: "type-declaration",
          name: input.name,
          type: input.type,
          optional: input.flags.optional ?? false,
        },
      ],
    });
  }

  // Doc
  if (input.doc.length > 0) {
    sections.push({ body: [{ kind: "doc", doc: input.doc }] });
  }

  // For each signature, add blockTag sections in order: examples → type params → params → returns → throws
  for (let i = 0; i < input.rawSignatures.length; i++) {
    const rawSig = input.rawSignatures[i];
    const blockTags = extractBlockTagSections(rawSig.comment, input.ctx);
    sections.push(...blockTags.examples);
    // Type parameters
    const typeParamDocs = (rawSig.typeParameters ?? [])
      .filter((tp) => tp.comment?.summary?.length)
      .map((tp) => ({ name: tp.name, doc: transformCommentParts(tp.comment!.summary, input.ctx) }));
    if (typeParamDocs.length > 0) {
      sections.push({
        title: "Type Parameters",
        body: [{ kind: "parameters", parameters: typeParamDocs }],
      });
    }
  }

  // Parameters
  for (const parameters of parameterDocsForSignatures(input.rawSignatures, input.ctx)) {
    sections.push({
      title: "Parameters",
      body: [{ kind: "parameters", parameters }],
    });
  }

  // Returns and throws
  for (const rawSig of input.rawSignatures) {
    const blockTags = extractBlockTagSections(rawSig.comment, input.ctx);
    sections.push(...blockTags.returns, ...blockTags.throws);
  }

  return sections;
}

function hasRenderableMemberFlags(flags: MemberFlags): boolean {
  return Boolean(flags.deprecated || flags.static || flags.abstract || flags.readonly);
}

function parameterDocsForSignatures(
  rawSigs: TDSignature[],
  ctx: TransformContext,
): ParameterDocViewModel[][] {
  return rawSigs
    .map((sig) =>
      (sig.parameters ?? [])
        .filter((p) => p.comment?.summary?.length)
        .map((p) => ({ name: p.name, doc: transformCommentParts(p.comment!.summary, ctx) })),
    )
    .filter((parameters) => parameters.length > 0);
}

function transformFlags(flags: TDDeclaration["flags"]): MemberFlags {
  const result: MemberFlags = {};
  if (flags.isOptional) result.optional = true;
  if (flags.isReadonly) result.readonly = true;
  if (flags.isStatic) result.static = true;
  if (flags.isAbstract) result.abstract = true;
  if (flags.isDeprecated) result.deprecated = true;
  return result;
}

function transformSignature(sig: TDSignature, ctx: TransformContext): SignatureViewModel {
  const typeParameters: TypeParameterViewModel[] = (sig.typeParameters ?? []).map((tp) =>
    transformTypeParameter(tp, ctx),
  );
  const parameters: ParameterViewModel[] = (sig.parameters ?? []).map((p) =>
    transformParameter(p, ctx),
  );
  const returnType: TypeViewModel = sig.type
    ? transformType(sig.type, ctx)
    : { kind: "intrinsic", name: "void" };
  return { typeParameters, parameters, returnType };
}

function transformParameter(param: TDParameter, ctx: TransformContext): ParameterViewModel {
  const type = param.type
    ? transformType(param.type, ctx)
    : { kind: "intrinsic" as const, name: "unknown" };
  return {
    name: param.name,
    type,
    optional: param.flags.isOptional ?? false,
  };
}

// ---------------------------------------------------------------------------
// Reflection type member blocks
// ---------------------------------------------------------------------------

function buildReflectionMemberBlocks(decl: TDDeclaration, ctx: TransformContext): SectionBlock[] {
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
        declarationKind: inferMemberKind(decl, signatures),
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

function transformTypeParameter(
  tp: TDTypeParameter,
  ctx: TransformContext,
): TypeParameterViewModel {
  return {
    name: tp.name,
    constraint: tp.type ? transformType(tp.type, ctx) : null,
    default: tp.default ? transformType(tp.default, ctx) : null,
  };
}

// ---------------------------------------------------------------------------
// Type transformer
// ---------------------------------------------------------------------------

function transformType(tdType: TDType, ctx: TransformContext): TypeViewModel {
  switch (tdType.type) {
    case "intrinsic":
      return { kind: "intrinsic", name: tdType.name };

    case "literal": {
      const val = tdType.value;
      if (val === null) return { kind: "literal", value: "null" };
      if (typeof val === "string") return { kind: "literal", value: JSON.stringify(val) };
      // val is number | boolean at this point
      return { kind: "literal", value: (val as number | boolean).toString() };
    }

    case "reference": {
      const url =
        typeof tdType.target === "number" ? (ctx.idToUrl.get(tdType.target) ?? null) : null;
      const typeArguments = (tdType.typeArguments ?? []).map((t) => transformType(t, ctx));
      return { kind: "reference", name: tdType.name, url, typeArguments };
    }

    case "union":
      return {
        kind: "union",
        types: tdType.types.map((t) => transformType(t, ctx)),
      };

    case "intersection":
      return {
        kind: "intersection",
        types: tdType.types.map((t) => transformType(t, ctx)),
      };

    case "array":
      return {
        kind: "array",
        elementType: transformType(tdType.elementType, ctx),
      };

    case "tuple":
      return {
        kind: "tuple",
        elements: tdType.elements.map((t) => transformType(t, ctx)),
      };

    case "typeOperator":
      return {
        kind: "type-operator",
        operator: tdType.operator,
        target: transformType(tdType.target, ctx),
      };

    case "indexedAccess":
      return {
        kind: "indexed-access",
        objectType: transformType(tdType.objectType, ctx),
        indexType: transformType(tdType.indexType, ctx),
      };

    case "conditional":
      return {
        kind: "conditional",
        checkType: transformType(tdType.checkType, ctx),
        extendsType: transformType(tdType.extendsType, ctx),
        trueType: transformType(tdType.trueType, ctx),
        falseType: transformType(tdType.falseType, ctx),
      };

    case "reflection": {
      const decl = tdType.declaration;
      const sigs = (decl.signatures ?? []).map((s) => transformSignature(s, ctx));
      // For reflection members, extract just the essential type info (not full cards)
      const members = (decl.children ?? []).flatMap((c) => buildReflectionMemberBlocks(c, ctx));
      return { kind: "reflection", signatures: sigs, members };
    }

    default:
      // Unknown or future TypeDoc type variants — preserve as raw JSON
      return { kind: "unknown", raw: JSON.stringify(tdType) };
  }
}

// ---------------------------------------------------------------------------
// Comment / doc transformers
// ---------------------------------------------------------------------------

function transformComment(comment: TDComment, ctx: TransformContext): DocNode[] {
  return transformCommentParts(comment.summary, ctx);
}

function transformCommentParts(parts: TDCommentPart[], ctx: TransformContext): DocNode[] {
  return parts.map((part): DocNode => {
    if (part.kind === "inline-tag") {
      const url = typeof part.target === "number" ? (ctx.idToUrl.get(part.target) ?? null) : null;
      return { kind: "link", text: part.text, url };
    }
    // "text" | "code" — both have a `text` field and map 1:1
    return { kind: part.kind, text: part.text };
  });
}

interface BlockTagSections {
  examples: Section[];
  returns: Section[];
  throws: Section[];
}

function extractBlockTagSections(
  comment: TDComment | undefined,
  ctx: TransformContext,
): BlockTagSections {
  const result: BlockTagSections = { examples: [], returns: [], throws: [] };
  if (!comment) return result;

  const examples: DocNode[][] = [];
  for (const tag of comment.blockTags ?? []) {
    const doc = transformCommentParts(tag.content, ctx);
    if (tag.tag === "@example") {
      examples.push(doc);
    } else if (tag.tag === "@returns" || tag.tag === "@return") {
      if (doc.length > 0)
        result.returns.push({
          title: "Returns",
          body: [{ kind: "doc", doc }],
        });
    } else if (tag.tag === "@throws") {
      const first = tag.content[0];
      const isType = first?.kind === "code";
      const name = isType ? first.text : "Throws";
      const entryDoc = isType ? transformCommentParts(tag.content.slice(1), ctx) : doc;
      result.throws.push({
        title: "Throws",
        body: [{ kind: "parameters", parameters: [{ name, doc: entryDoc }] }],
      });
    }
  }
  if (examples.length > 0) {
    result.examples.push({ title: "Example", body: [{ kind: "examples", examples }] });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Nav helpers
// ---------------------------------------------------------------------------

function buildModuleImportPath(pkgName: string, moduleName: string): string {
  if (moduleName === "index") {
    return pkgName;
  }
  return `${pkgName}/${moduleName}`;
}

function declarationNavNode(decl: TDDeclaration, idToUrl: Map<number, string>): NavNode {
  const url = idToUrl.get(decl.id) ?? "index.html";
  const kindName = reflectionKindToDeclarationKind(decl.kind) ?? "unknown";
  const deprecated =
    decl.flags.isDeprecated ?? decl.comment?.modifierTags?.includes("@deprecated") ?? false;
  return {
    label: decl.name,
    url,
    kind: kindName,
    iconClass: getKindIcon(kindName),
    flags: { deprecated: deprecated || undefined },
    children: [],
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
