import { Kind, type TDProject, type TDDeclaration } from "./typedoc.ts";
import type { PageViewModel, Breadcrumb, Section } from "./viewmodel.ts";
import type { TransformContext } from "./transform-context.ts";
import {
  transformComment,
  transformCommentParts,
  extractBlockTagSections,
} from "./comment-transformer.ts";
import { declarationAsCards } from "./card-builder.ts";
import { inferGroups, reflectionKindToDeclarationKind } from "./utils.ts";
import {
  buildClassSections,
  buildMemberSections,
  buildFunctionSections,
  buildTypeAliasSections,
  buildEnumSections,
  buildVariableSections,
} from "./section-builders.ts";

export function buildPackageIndexPage(
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

export function buildModulePage(
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

export function buildMultiDeclarationPage(
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
