export const KIND_ICONS: Record<string, string> = {
  "package-index": "codicon-symbol-package",
  module: "codicon-symbol-module",
  class: "codicon-symbol-class",
  interface: "codicon-symbol-interface",
  function: "codicon-symbol-function",
  "type-alias": "codicon-symbol-type-parameter",
  variable: "codicon-symbol-variable",
  enum: "codicon-symbol-enum",
  namespace: "codicon-symbol-namespace",
  constructor: "codicon-symbol-method",
  method: "codicon-symbol-method",
  property: "codicon-symbol-property",
  accessor: "codicon-symbol-property",
  "enum-member": "codicon-symbol-enum-member",
  member: "codicon-symbol-misc",
};

export function getKindIcon(kind: string): string {
  return KIND_ICONS[kind] ?? "codicon-symbol-misc";
}
