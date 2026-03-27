import type { TDDeclaration } from "./typedoc.ts";
import type { Section } from "./viewmodel.ts";
import type { TransformContext } from "./transform-context.ts";
import { transformType, transformSignature } from "./type-transformer.ts";
import { declarationAsCards, buildSignatureCard } from "./card-builder.ts";
import { transformCommentParts, extractBlockTagSections } from "./comment-transformer.ts";
import { inferGroups } from "./utils.ts";

export function buildClassSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
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

export function buildMemberSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
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

export function buildFunctionSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
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

export function buildTypeAliasSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
  if (!decl.type) return [];
  return [
    {
      body: [{ kind: "type-declaration", type: transformType(decl.type, ctx) }],
    },
  ];
}

export function buildEnumSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
  const children = decl.children ?? [];
  if (children.length === 0) return [];
  return [
    {
      title: "Members",
      body: children.flatMap((d) => declarationAsCards(d, ctx)),
    },
  ];
}

export function buildVariableSections(decl: TDDeclaration, ctx: TransformContext): Section[] {
  if (!decl.type) return [];
  return [
    {
      body: [{ kind: "type-declaration", type: transformType(decl.type, ctx) }],
    },
  ];
}
