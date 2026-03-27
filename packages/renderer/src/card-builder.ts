import { Kind, PAGE_KINDS } from "./typedoc.ts";
import type { TDDeclaration, TDSignature } from "./typedoc.ts";
import type {
  Breadcrumb,
  Section,
  SectionBlock,
  MemberFlags,
  SignatureViewModel,
  DeclarationKind,
  DocNode,
  TypeViewModel,
  ParameterDocViewModel,
} from "./viewmodel.ts";
import type { TransformContext } from "./transform-context.ts";
import { transformSignature, transformType, transformFlags } from "./type-transformer.ts";
import {
  transformComment,
  transformCommentParts,
  extractBlockTagSections,
} from "./comment-transformer.ts";
import { reflectionKindToDeclarationKind, inferDeclarationKind } from "./utils.ts";

/** Build section id from title and optional prefix. */
function buildSectionId(idPrefix: string, title: string): string {
  const sectionPart = title.toLowerCase().replace(/\s+/g, "-");
  if (!idPrefix) return `~${sectionPart}`;
  return `${idPrefix}~${sectionPart}`;
}

export function buildSignatureCard(
  name: string,
  label: string,
  anchor: string,
  sig: SignatureViewModel,
  flags: MemberFlags,
  kind: DeclarationKind,
  extraSections: Section[] = [],
  cardIdPrefix: string = "",
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
    id: buildSectionId(cardIdPrefix, "Signature"),
    body: [{ kind: "signatures", signatures: [sig] }],
  });

  sections.push(
    ...extraSections.map((s) => ({
      ...s,
      id: s.id || buildSectionId(cardIdPrefix, s.title || "section"),
    })),
  );

  return { kind: "card", anchor, url: undefined, flags, sections };
}

export function declarationAsCards(
  decl: TDDeclaration,
  ctx: TransformContext,
  _idPrefix: string = "",
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
  const referenceTarget = referenceTargetForDeclaration(decl, ctx);
  const url =
    referenceTarget?.url ?? (PAGE_KINDS.has(decl.kind) ? ctx.idToUrl.get(decl.id) : undefined);
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
        referenceBreadcrumbs: referenceTarget?.breadcrumbs,
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
      idPrefix: baseName,
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
      anchor,
    );
  });
}

function declarationKindForMember(
  decl: TDDeclaration,
  _signatures: SignatureViewModel[],
): DeclarationKind {
  const pageKind = reflectionKindToDeclarationKind(decl.kind);
  if (pageKind) return pageKind;
  return inferDeclarationKind(decl);
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
  idPrefix?: string;
}): Section[] {
  const idPrefix = input.idPrefix ?? "";

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
      id: buildSectionId(idPrefix, "Signature"),
      body: [{ kind: "signatures", signatures: input.signatures }],
    });
  } else if (input.type) {
    sections.push({
      title: "Type",
      id: buildSectionId(idPrefix, "Type"),
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
    sections.push(
      ...blockTags.examples.map((s) => ({
        ...s,
        id: s.id || buildSectionId(idPrefix, s.title || "examples"),
      })),
    );
    // Type parameters
    const typeParamDocs = (rawSig.typeParameters ?? [])
      .filter((tp) => tp.comment?.summary?.length)
      .map((tp) => ({ name: tp.name, doc: transformCommentParts(tp.comment!.summary, input.ctx) }));
    if (typeParamDocs.length > 0) {
      sections.push({
        title: "Type Parameters",
        id: buildSectionId(idPrefix, "Type Parameters"),
        body: [{ kind: "parameters", parameters: typeParamDocs }],
      });
    }
  }

  // Parameters
  for (const parameters of parameterDocsForSignatures(input.rawSignatures, input.ctx)) {
    sections.push({
      title: "Parameters",
      id: buildSectionId(idPrefix, "Parameters"),
      body: [{ kind: "parameters", parameters }],
    });
  }

  // Returns and throws
  for (const rawSig of input.rawSignatures) {
    const blockTags = extractBlockTagSections(rawSig.comment, input.ctx);
    sections.push(
      ...blockTags.returns.map((s) => ({
        ...s,
        id: s.id || buildSectionId(idPrefix, s.title || "returns"),
      })),
      ...blockTags.throws.map((s) => ({
        ...s,
        id: s.id || buildSectionId(idPrefix, s.title || "throws"),
      })),
    );
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

function referenceTargetForDeclaration(
  decl: TDDeclaration,
  ctx: TransformContext,
): { url: string; breadcrumbs: Breadcrumb[] } | null {
  if (decl.variant !== "reference" || typeof decl.target !== "number") return null;

  const url = ctx.idToUrl.get(decl.target);
  const breadcrumbs = ctx.idToBreadcrumbs.get(decl.target);
  if (!url || !breadcrumbs || breadcrumbs.length === 0) return null;

  return { url, breadcrumbs };
}
