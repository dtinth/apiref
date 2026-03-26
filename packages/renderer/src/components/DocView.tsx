import { marked } from "marked";
import type { DocNode } from "../viewmodel.ts";
import { useResolveLink } from "./PageContext.tsx";

interface DocViewProps {
  doc: DocNode[];
}

/** Reassemble DocNode[] back into a markdown string, converting link nodes to markdown links. */
function docToMarkdown(doc: DocNode[], resolve: (url: string) => string): string {
  return doc
    .map((node) => {
      switch (node.kind) {
        case "text":
          return node.text;
        case "code":
          return node.text;
        case "link":
          return node.url ? `[${node.text}](${resolve(node.url)})` : node.text;
      }
    })
    .join("");
}

export function DocView({ doc }: DocViewProps) {
  const resolve = useResolveLink();
  if (doc.length === 0) return null;
  const html = marked.parse(docToMarkdown(doc, resolve)) as string;
  return <div class="ar-description" dangerouslySetInnerHTML={{ __html: html }}></div>;
}
