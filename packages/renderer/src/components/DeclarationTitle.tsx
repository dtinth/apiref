/**
 * Icon + title + kind label for declaration headers.
 * Returns a fragment so the parent can wrap in h1, h3, etc.
 */

const KIND_ICONS: Record<string, string> = {
  class: "codicon-symbol-class",
  interface: "codicon-symbol-interface",
  function: "codicon-symbol-function",
  "type-alias": "codicon-symbol-type-parameter",
  variable: "codicon-symbol-variable",
  enum: "codicon-symbol-enum",
  module: "codicon-symbol-module",
  namespace: "codicon-symbol-namespace",
  "package-index": "codicon-symbol-package",
  constructor: "codicon-symbol-method",
  method: "codicon-symbol-method",
  property: "codicon-symbol-field",
};

function getKindIcon(kind: string): string {
  return KIND_ICONS[kind] ?? "codicon-symbol-misc";
}

export interface DeclarationTitleProps {
  kind: string;
  title: string;
  kindLabelClass?: string;
}

export function DeclarationTitle({
  kind,
  title,
  kindLabelClass = "ar-declaration-kind",
}: DeclarationTitleProps) {
  const iconClass = getKindIcon(kind);
  return (
    <>
      <i class={`codicon ${iconClass} ar-kind-icon ar-kind-icon--${kind}`} />
      <span>{title}</span>
      <span class={kindLabelClass}>{kind}</span>
    </>
  );
}
