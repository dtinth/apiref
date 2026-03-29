import { getKindIcon } from "./components/kind-icons.ts";
import type { TDDeclaration } from "./typedoc.ts";
import { reflectionKindToDeclarationKind } from "./utils.ts";
import type { NavNode } from "./viewmodel.ts";

export function declarationNavNode(decl: TDDeclaration, idToUrl: Map<number, string>): NavNode {
  const url = idToUrl.get(decl.id) ?? "index.html";
  const kindName = reflectionKindToDeclarationKind(decl.kind) ?? "unknown";
  const deprecated = decl.comment?.modifierTags?.includes("@deprecated") ?? false;
  return {
    label: decl.name,
    url,
    kind: kindName,
    iconClass: getKindIcon(kindName),
    flags: { deprecated: deprecated || undefined },
    children: [],
  };
}
