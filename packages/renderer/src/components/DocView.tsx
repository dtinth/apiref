import type { DocNode } from "../viewmodel.ts";

interface DocViewProps {
  doc: DocNode[];
}

export function DocView({ doc }: DocViewProps) {
  if (doc.length === 0) return null;
  return (
    <div class="ar-description">
      {doc.map((node, i) => (
        <DocNodeView key={i} node={node} />
      ))}
    </div>
  );
}

function DocNodeView({ node }: { node: DocNode }) {
  switch (node.kind) {
    case "text":
      return <>{node.text}</>;
    case "code":
      return <code class="ar-inline-code">{node.text}</code>;
    case "link":
      if (node.url) {
        return (
          <a href={node.url} class="ar-link">
            {node.text}
          </a>
        );
      }
      return <span class="ar-link-unresolved">{node.text}</span>;
  }
}
