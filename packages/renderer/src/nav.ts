import type { JSONOutput } from "typedoc";
import type { NavNode } from "./viewmodel.ts";
import { getKindIcon } from "./components/kind-icons.ts";
import { reflectionKindToDeclarationKind } from "./utils.ts";

type TDDeclaration = JSONOutput.DeclarationReflection | JSONOutput.ReferenceReflection;

export function buildModuleImportPath(pkgName: string, moduleName: string): string {
  if (moduleName === "index") {
    return pkgName;
  }
  return `${pkgName}/${moduleName}`;
}

export function declarationNavNode(decl: TDDeclaration, idToUrl: Map<number, string>): NavNode {
  const url = idToUrl.get(decl.id) ?? "index.html";
  const kindName = reflectionKindToDeclarationKind(decl.kind) ?? "unknown";
  const deprecated =
    decl.flags.isDeprecated ?? decl.comment?.modifierTags?.includes("@deprecated") ?? false;
  return {
    label: decl.name,
    url,
    kind: kindName,
    iconClass: getKindIcon(kindName),
    flags: { deprecated: deprecated || undefined },
    children: [],
  };
}
