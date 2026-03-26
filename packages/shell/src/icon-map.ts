/**
 * Shared icon mapping for declaration and member kinds.
 * Used by both renderer components (DeclarationTitle) and shell components (ar-outline).
 */

export const KIND_ICONS: Record<string, string> = {
  // Declaration kinds
  class: "codicon-symbol-class",
  interface: "codicon-symbol-interface",
  function: "codicon-symbol-function",
  "type-alias": "codicon-symbol-type-parameter",
  variable: "codicon-symbol-variable",
  enum: "codicon-symbol-enum",
  module: "codicon-symbol-module",
  namespace: "codicon-symbol-namespace",
  "package-index": "codicon-symbol-package",

  // Member kinds
  constructor: "codicon-symbol-method",
  method: "codicon-symbol-method",
  property: "codicon-symbol-field",
  accessor: "codicon-symbol-field",
  "enum-member": "codicon-symbol-enum-member",
  member: "codicon-symbol-misc",
};

export function getKindIcon(kind: string): string {
  return KIND_ICONS[kind] ?? "codicon-symbol-misc";
}
