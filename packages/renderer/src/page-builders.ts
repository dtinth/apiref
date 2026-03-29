import { Kind } from "./typedoc-kinds.ts";
import { getDeclarationChildren } from "./typedoc.ts";
import type { TDComment, TDDeclaration, TDProject } from "./typedoc.ts";
import type { PageViewModel, Breadcrumb, Section } from "./viewmodel.ts";
import type { TransformContext } from "./transform-context.ts";
import {
  transformComment,
  transformCommentParts,
  extractBlockTagSections,
} from "./comment-transformer.ts";
import { declarationAsCards } from "./card-builder.ts";
import { getSourceUrl, inferGroups, reflectionKindToDeclarationKind } from "./utils.ts";
import {
  buildClassSections,
  buildMemberSections,
  buildFunctionSections,
  buildTypeAliasSections,
  buildEnumSections,
  buildVariableSections,
} from "./section-builders.ts";

/** Build section id from title and optional prefix. */
function buildSectionId(idPrefix: string, title: string): string {
  const sectionPart = title.toLowerCase().replace(/\s+/g, "-");
  if (!idPrefix) return `~${sectionPart}`;
  return `${idPrefix}~${sectionPart}`;
}

function buildCommentSections(
  comment: TDComment | undefined,
  ctx: TransformContext,
  options: { includeBlockTags?: boolean } = {},
): Section[] {
  if (!comment) return [];

  const sections: Section[] = [];
  const doc = transformComment(comment, ctx);
  if (doc.length > 0) sections.push({ body: [{ kind: "doc", doc }] });

  if (options.includeBlockTags !== false) {
    const blockTags = extractBlockTagSections(comment, ctx);
    sections.push(
      ...blockTags.examples.map((s) => ({
        ...s,
        id: s.id || buildSectionId("", s.title || "examples"),
      })),
      ...blockTags.returns.map((s) => ({
        ...s,
        id: s.id || buildSectionId("", s.title || "returns"),
      })),
      ...blockTags.throws.map((s) => ({
        ...s,
        id: s.id || buildSectionId("", s.title || "throws"),
      })),
    );
  }

  return sections;
}

export function buildPackageIndexPage(
  project: TDProject,
  topLevel: TDDeclaration[],
  ctx: TransformContext,
): PageViewModel {
  const sections: Section[] = [];

  sections.push({
    body: [
      {
        kind: "declaration-title",
        name: ctx.pkgName,
        declarationKind: "package-index",
        sourceUrl: undefined,
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

  // List modules
  sections.push({
    title: "Modules",
    id: "~modules",
    body: topLevel.flatMap((d) => declarationAsCards(d, ctx, "~modules")),
  });

  return {
    url: "index.html",
    title: ctx.pkgName,
    kind: "package-index",
    breadcrumbs: [],
    sections,
  };
}

export function buildModulePage(
  mod: TDDeclaration,
  breadcrumbs: Breadcrumb[],
  ctx: TransformContext,
): PageViewModel {
  const url = ctx.idToUrl.get(mod.id) ?? "index.html";
  const sections: Section[] = [];

  sections.push({
    body: [
      {
        kind: "declaration-title",
        name: mod.name,
        declarationKind: "module",
        sourceUrl: getSourceUrl(mod),
      },
    ],
  });

  if (mod.comment) {
    const doc = transformComment(mod.comment, ctx);
    if (doc.length > 0) sections.push({ body: [{ kind: "doc", doc }] });
  }

  const children = getDeclarationChildren(mod);
  const groups = mod.groups ?? inferGroups(children);
  const idToDecl = new Map<number, TDDeclaration>(children.map((c) => [c.id, c]));

  for (const group of groups) {
    const members = (group.children ?? [])
      .map((id) => idToDecl.get(id))
      .filter((d): d is TDDeclaration => d !== undefined);
    const groupId = `~${group.title.toLowerCase().replace(/\s+/g, "-")}`;
    sections.push({
      title: group.title,
      id: groupId,
      body: members.flatMap((d) => declarationAsCards(d, ctx, groupId)),
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

export function buildMultiDeclarationPage(
  decls: TDDeclaration[],
  parentBreadcrumbs: Breadcrumb[],
  ctx: TransformContext,
): PageViewModel | null {
  if (decls.length === 0) return null;

  // Use the URL from the first declaration (all share the same URL)
  const url = ctx.idToUrl.get(decls[0].id);
  if (!url) return null;

  // Sort declarations: functions first, then namespaces, then others
  const sortedDecls = [...decls].sort((a, b) => {
    const kindPriority = (kind: number) => {
      if (kind === Kind.Function) return 0;
      if (kind === Kind.Namespace) return 1;
      return 2;
    };
    return kindPriority(a.kind) - kindPriority(b.kind);
  });

  const sections: Section[] = [];

  // Build sections for each declaration
  for (const decl of sortedDecls) {
    // Add a heading for this declaration's kind
    const kind = reflectionKindToDeclarationKind(decl.kind);

    // Add the declaration-title for this specific declaration
    if (kind) {
      sections.push({
        body: [
          {
            kind: "declaration-title",
            name: decl.name,
            declarationKind: kind,
            sourceUrl: getSourceUrl(decl, decl.signatures?.[0]),
          },
        ],
      });
    }

    // Summary from comment
    const commentSource =
      decl.kind === Kind.Function || decl.kind === Kind.Variable
        ? (decl.signatures?.[0]?.comment ?? decl.comment)
        : decl.comment;

    sections.push(
      ...buildCommentSections(commentSource, ctx, {
        includeBlockTags: decl.kind !== Kind.Function,
      }),
    );

    // Build kind-specific sections
    switch (decl.kind) {
      case Kind.Class:
        sections.push(...buildClassSections(decl, ctx, ""));
        break;
      case Kind.Interface:
        sections.push(...buildMemberSections(decl, ctx, ""));
        break;
      case Kind.Function:
        sections.push(...buildFunctionSections(decl, ctx, ""));
        break;
      case Kind.TypeAlias:
        sections.push(...buildTypeAliasSections(decl, ctx, ""));
        break;
      case Kind.Enum:
        sections.push(...buildEnumSections(decl, ctx, ""));
        break;
      case Kind.Variable:
        sections.push(...buildVariableSections(decl, ctx, ""));
        break;
      case Kind.Namespace:
        sections.push(...buildMemberSections(decl, ctx, ""));
        break;
    }
  }

  return {
    url,
    title: sortedDecls[0].name,
    kind: "multiple",
    breadcrumbs: parentBreadcrumbs,
    sections,
  };
}

export function buildDeclarationPage(
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
    body: [
      {
        kind: "declaration-title",
        name: decl.name,
        declarationKind: kind,
        sourceUrl: getSourceUrl(decl, decl.signatures?.[0]),
      },
    ],
  });

  // Summary from comment (prefer signature comment for functions)
  const commentSource =
    decl.kind === Kind.Function || decl.kind === Kind.Variable
      ? (decl.signatures?.[0]?.comment ?? decl.comment)
      : decl.comment;

  sections.push(
    ...buildCommentSections(commentSource, ctx, {
      includeBlockTags: decl.kind !== Kind.Function,
    }),
  );

  switch (decl.kind) {
    case Kind.Class:
      sections.push(...buildClassSections(decl, ctx, ""));
      break;
    case Kind.Interface:
      sections.push(...buildMemberSections(decl, ctx, ""));
      break;
    case Kind.Function:
      sections.push(...buildFunctionSections(decl, ctx, ""));
      break;
    case Kind.TypeAlias:
      sections.push(...buildTypeAliasSections(decl, ctx, ""));
      break;
    case Kind.Enum:
      sections.push(...buildEnumSections(decl, ctx, ""));
      break;
    case Kind.Variable:
      sections.push(...buildVariableSections(decl, ctx, ""));
      break;
    case Kind.Namespace:
      sections.push(...buildMemberSections(decl, ctx, ""));
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
