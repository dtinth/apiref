import type { TransformContext } from "./transform-context.ts";
import type { TDComment, TDCommentPart } from "./typedoc.ts";
import type { DocNode, Section } from "./viewmodel.ts";

export function transformComment(comment: TDComment, ctx: TransformContext): DocNode[] {
  return transformCommentParts(comment.summary, ctx);
}

export function transformCommentParts(parts: TDCommentPart[], ctx: TransformContext): DocNode[] {
  return parts.map((part): DocNode => {
    if (part.kind === "inline-tag") {
      const url = typeof part.target === "number" ? (ctx.idToUrl.get(part.target) ?? null) : null;
      return { kind: "link", text: part.text, url };
    }
    // "text" | "code" — both have a `text` field and map 1:1
    return { kind: part.kind, text: part.text };
  });
}

export interface BlockTagSections {
  examples: Section[];
  returns: Section[];
  throws: Section[];
}

export function extractBlockTagSections(
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
      if (doc.length > 0)
        result.throws.push({
          title: "Throws",
          body: [{ kind: "doc", doc }],
        });
    }
  }
  if (examples.length > 0) {
    result.examples.push({ title: "Example", body: [{ kind: "examples", examples }] });
  }
  return result;
}
