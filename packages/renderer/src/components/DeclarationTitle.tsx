import type { DeclarationKind } from "../viewmodel.ts";

/**
 * Icon + title + kind label for declaration headers.
 * Returns a fragment so the parent can wrap in h1, h3, etc.
 */

const KIND_ICONS: Partial<Record<DeclarationKind, string>> = {
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
  property: "codicon-symbol-property",
  accessor: "codicon-symbol-property",
};

function getKindIcon(kind: DeclarationKind): string {
  return KIND_ICONS[kind] ?? "codicon-symbol-misc";
}

export interface DeclarationTitleProps {
  kind: DeclarationKind;
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
    <span class="ar-declaration-title-wrapper">
      <i class={`codicon ${iconClass} ar-kind-icon ar-kind-icon--${kind}`} />
      <span class="ar-declaration-title-text">
        <span>{title}</span>
        <span> </span>
        <span class={kindLabelClass}>{kind}</span>
      </span>
    </span>
  );
}
