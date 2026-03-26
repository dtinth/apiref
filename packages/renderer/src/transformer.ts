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
    for (const child of children) {
      const page = buildDeclarationPage(child, [], ctx);
      if (page) {
        pages.push(page);
        navChildren.push(declarationNavNode(child, idToUrl));
      }
    }
    navTree.push(...navChildren.sort(byLabel));
  } else {
    for (const mod of children) {
      const modUrl = idToUrl.get(mod.id) ?? "index.html";
      const modBreadcrumbs: Breadcrumb[] = [{ label: pkgName, url: "index.html" }];
      pages.push(buildModulePage(mod, modBreadcrumbs, ctx));

      const modNavChildren: NavNode[] = [];
      for (const child of mod.children ?? []) {
        const page = buildDeclarationPage(
          child,
          modBreadcrumbs.concat({ label: mod.name, url: modUrl }),
          ctx,
        );
        if (page) {
          pages.push(page);
          modNavChildren.push(declarationNavNode(child, idToUrl));
        }
      }
      navTree.push({
        label: mod.name,
        url: modUrl,
        kind: "module",
        flags: {},
        children: modNavChildren.sort(byLabel),
      });
    }
  }

  return { package: { name: pkgName, version: pkgVersion }, pages, navTree };
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

  for (const child of decl.children ?? []) {
    if (ANCHOR_KINDS.has(child.kind)) {
      const anchor = child.kind === Kind.Constructor ? "constructor" : child.name;
      idToUrl.set(child.id, `${url}#${anchor}`);
      // Register constructor/method signature IDs too
      for (const sig of child.signatures ?? []) {
        idToUrl.set(sig.id, `${url}#${anchor}`);
      }
    } else if (PAGE_KINDS.has(child.kind)) {
      // Namespace — recurse with updated path
      const childPrefix = pathPrefix ? `${pathPrefix}/${child.name}` : child.name;
      registerReflection(child, childPrefix, false, idToUrl);
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
    body: [{ kind: "declaration-title", name: ctx.pkgName, declarationKind: "package-index" }],
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
    const sig = transformedSigs[0];
    const sections: Section[] = [
      { title: "Signature", body: [{ kind: "signatures", signatures: [sig] }] },
    ];
    const params = sig.parameters
      .filter((p) => p.doc.length > 0)
      .map((p) => ({ name: p.name, doc: p.doc }));
    if (params.length > 0) {
      sections.push({ title: "Parameters", body: [{ kind: "parameters", parameters: params }] });
    }
    return sections;
  }

  // Multiple signatures: one card per overload
  const n = transformedSigs.length;
  const cards = transformedSigs.map((sig, i) => {
    const label = `${decl.name} (${i + 1}/${n})`;
    const anchor = `${decl.name}-${i + 1}`;
    return buildSignatureCard(decl.name, label, anchor, sig, {}, "function");
  });

  return [{ title: "Signatures", body: cards }];
}

function buildTypeAliasSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
  if (!decl.type) return [];
  return [{ body: [{ kind: "type-declaration", type: transformType(decl.type, ctx) }] }];
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
  return [{ body: [{ kind: "type-declaration", type: transformType(decl.type, ctx) }] }];
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
): SectionBlock & { kind: "card" } {
  const sections: Section[] = [
    { body: [{ kind: "declaration-title", name: label, declarationKind: kind }] },
  ];

  if (hasRenderableMemberFlags(flags)) {
    sections.push({ body: [{ kind: "flags", flags }] });
  }

  sections.push({
    title: "Signature",
    body: [{ kind: "signatures", signatures: [sig] }],
  });

  if (sig.doc.length > 0) {
    sections.push({ body: [{ kind: "doc", doc: sig.doc }] });
  }

  const params = sig.parameters
    .filter((p) => p.doc.length > 0)
    .map((p) => ({ name: p.name, doc: p.doc }));
  if (params.length > 0) {
    sections.push({ title: "Parameters", body: [{ kind: "parameters", parameters: params }] });
  }

  return { kind: "card", anchor, url: undefined, flags, sections };
}

function declarationAsCards(
  decl: TDDeclaration,
  ctx: TransformContext,
): Array<SectionBlock & { kind: "card" }> {
  const baseName = decl.kind === Kind.Constructor ? "constructor" : decl.name;
  const flags = transformFlags(decl.flags);

  // Check @deprecated modifier tag
  const allTags = [
    ...(decl.comment?.modifierTags ?? []),
    ...(decl.signatures?.flatMap((s) => s.comment?.modifierTags ?? []) ?? []),
  ];
  if (allTags.includes("@deprecated")) flags.deprecated = true;

  const signatures = (decl.signatures ?? []).map((s) => transformSignature(s, ctx));
  const type = decl.type ? transformType(decl.type, ctx) : null;
  const commentSource = decl.signatures?.[0]?.comment ?? decl.comment;
  const doc = commentSource ? transformComment(commentSource, ctx) : [];
  const url = PAGE_KINDS.has(decl.kind) ? ctx.idToUrl.get(decl.id) : undefined;
  const kind = declarationKindForMember(decl, signatures);

  // If the member has its own page, use the old single-card-with-link approach
  if (url) {
    const docSections: Section[] = doc.length > 0 ? [{ body: [{ kind: "doc", doc }] }] : [];
    return [
      {
        kind: "card",
        anchor: baseName,
        url,
        flags,
        sections: [
          { body: [{ kind: "declaration-title", name: decl.name, declarationKind: kind }] },
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
      type,
      doc,
      url: undefined,
    });
    return [
      {
        kind: "card",
        anchor: baseName,
        url: undefined,
        flags,
        sections: [
          { body: [{ kind: "declaration-title", name: decl.name, declarationKind: kind }] },
          ...cardSections,
        ],
      },
    ];
  }

  // Multiple signatures: one card per signature
  const n = signatures.length;
  return signatures.map((sig, i) => {
    const label = `${decl.name} (${i + 1}/${n})`;
    const anchor = `${baseName}-${i + 1}`;
    // Only include flags on the first card to avoid repetition
    return buildSignatureCard(decl.name, label, anchor, sig, i === 0 ? flags : {}, kind);
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
  type: TypeViewModel | null;
  doc: DocNode[];
  url?: string;
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

  // Parameters
  for (const parameters of parameterDocsForSignatures(input.signatures)) {
    sections.push({ title: "Parameters", body: [{ kind: "parameters", parameters }] });
  }

  return sections;
}

function hasRenderableMemberFlags(flags: MemberFlags): boolean {
  return Boolean(flags.deprecated || flags.static || flags.abstract || flags.readonly);
}

function parameterDocsForSignatures(signatures: SignatureViewModel[]): ParameterDocViewModel[][] {
  return signatures
    .map((signature) =>
      signature.parameters
        .filter((parameter) => parameter.doc.length > 0)
        .map((parameter) => ({ name: parameter.name, doc: parameter.doc })),
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
  const doc = sig.comment ? transformComment(sig.comment, ctx) : [];
  return { typeParameters, parameters, returnType, doc };
}

function transformParameter(param: TDParameter, ctx: TransformContext): ParameterViewModel {
  const type = param.type
    ? transformType(param.type, ctx)
    : { kind: "intrinsic" as const, name: "unknown" };
  const doc = param.comment ? transformComment(param.comment, ctx) : [];
  return {
    name: param.name,
    type,
    optional: param.flags.isOptional ?? false,
    doc,
  };
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
      const members = (decl.children ?? []).flatMap((c) => declarationAsCards(c, ctx));
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

// ---------------------------------------------------------------------------
// Nav helpers
// ---------------------------------------------------------------------------

function declarationNavNode(decl: TDDeclaration, idToUrl: Map<number, string>): NavNode {
  const url = idToUrl.get(decl.id) ?? "index.html";
  const kindName = reflectionKindToDeclarationKind(decl.kind) ?? "unknown";
  const deprecated =
    decl.flags.isDeprecated ?? decl.comment?.modifierTags?.includes("@deprecated") ?? false;
  return {
    label: decl.name,
    url,
    kind: kindName,
    flags: { deprecated: deprecated || undefined },
    children: [],
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function reflectionKindToDeclarationKind(kind: number): DeclarationKind | null {
  switch (kind) {
    case Kind.Class:
      return "class";
    case Kind.Interface:
      return "interface";
    case Kind.Function:
      return "function";
    case Kind.TypeAlias:
      return "type-alias";
    case Kind.Variable:
      return "variable";
    case Kind.Enum:
      return "enum";
    case Kind.Namespace:
      return "namespace";
    case Kind.Module:
      return "module";
    default:
      return null;
  }
}

function byLabel(a: NavNode, b: NavNode): number {
  return a.label.localeCompare(b.label);
}

function inferGroups(decls: TDDeclaration[]): Array<{ title: string; children: number[] }> {
  const groupMap = new Map<string, number[]>();
  for (const decl of decls) {
    const title = kindGroupTitle(decl.kind);
    let arr = groupMap.get(title);
    if (!arr) {
      arr = [];
      groupMap.set(title, arr);
    }
    arr.push(decl.id);
  }
  return Array.from(groupMap.entries()).map(([title, children]) => ({
    title,
    children,
  }));
}

function kindGroupTitle(kind: number): string {
  switch (kind) {
    case Kind.Class:
      return "Classes";
    case Kind.Interface:
      return "Interfaces";
    case Kind.Function:
      return "Functions";
    case Kind.TypeAlias:
      return "Type Aliases";
    case Kind.Variable:
      return "Variables";
    case Kind.Enum:
      return "Enumerations";
    case Kind.Namespace:
      return "Namespaces";
    case Kind.Constructor:
      return "Constructors";
    case Kind.Property:
      return "Properties";
    case Kind.Method:
      return "Methods";
    case Kind.Accessor:
      return "Accessors";
    case Kind.EnumMember:
      return "Members";
    default:
      return "Other";
  }
}
