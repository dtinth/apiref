import { Kind, type TDDeclaration } from "./typedoc.ts";
import type { DeclarationKind, NavNode } from "./viewmodel.ts";

export function reflectionKindToDeclarationKind(kind: number): DeclarationKind | null {
  switch (kind) {
    case Kind.Class:
      return "class";
    case Kind.Interface:
      return "interface";
    case Kind.Function:
      return "function";
    case Kind.TypeAlias:
      return "type-alias";
    case Kind.Variable:
      return "variable";
    case Kind.Enum:
      return "enum";
    case Kind.Namespace:
      return "namespace";
    case Kind.Module:
      return "module";
    default:
      return null;
  }
}

export function inferDeclarationKind(
  decl: TDDeclaration,
): Extract<DeclarationKind, "constructor" | "accessor" | "method" | "property"> {
  // Constructor
  if (decl.kind === Kind.Constructor) return "constructor";
  // Accessor (getter/setter)
  if (decl.getSignature || decl.setSignature) return "accessor";
  // Method
  if (decl.kind === Kind.Method) return "method";
  // Default to property
  return "property";
}

export function byLabel(a: NavNode, b: NavNode): number {
  return a.label.localeCompare(b.label);
}

export function inferGroups(decls: TDDeclaration[]): Array<{ title: string; children: number[] }> {
  const groupMap = new Map<string, number[]>();
  for (const decl of decls) {
    const title = kindGroupTitle(decl.kind);
    let arr = groupMap.get(title);
    if (!arr) {
      arr = [];
      groupMap.set(title, arr);
    }
    arr.push(decl.id);
  }
  return Array.from(groupMap.entries()).map(([title, children]) => ({
    title,
    children,
  }));
}

function kindGroupTitle(kind: number): string {
  switch (kind) {
    case Kind.Class:
      return "Classes";
    case Kind.Interface:
      return "Interfaces";
    case Kind.Function:
      return "Functions";
    case Kind.TypeAlias:
      return "Type Aliases";
    case Kind.Variable:
      return "Variables";
    case Kind.Enum:
      return "Enumerations";
    case Kind.Namespace:
      return "Namespaces";
    case Kind.Constructor:
      return "Constructors";
    case Kind.Property:
      return "Properties";
    case Kind.Method:
      return "Methods";
    case Kind.Accessor:
      return "Accessors";
    case Kind.EnumMember:
      return "Members";
    default:
      return "Other";
  }
}
