import type { JSONOutput } from "typedoc";
import { Kind } from "./typedoc-kinds.ts";
import type { DeclarationKind, NavNode } from "./viewmodel.ts";

type TDDeclaration = JSONOutput.DeclarationReflection | JSONOutput.ReferenceReflection;
type TDSignature = JSONOutput.SignatureReflection;
type TDSource = JSONOutput.SourceReference;

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
  switch (decl.kind) {
    case Kind.Constructor:
      return "constructor";
    case Kind.Method:
      return "method";
    case Kind.Accessor:
      return "accessor";
  }

  if (decl.getSignature || decl.setSignature) return "accessor";
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

export function getSourceUrl(
  ...nodes: Array<{ sources?: TDSource[] } | TDSignature | TDDeclaration | undefined>
): string | undefined {
  for (const node of nodes) {
    const url = node?.sources?.map((source) => source.url).find(isGitHubUrl);
    if (url) return url;
  }
  return undefined;
}

export function isDeclarationReflection(
  reflection: JSONOutput.SomeReflection,
): reflection is TDDeclaration {
  return reflection.variant === "declaration" || reflection.variant === "reference";
}

export function isReferenceReflection(
  reflection: TDDeclaration,
): reflection is JSONOutput.ReferenceReflection {
  return reflection.variant === "reference";
}

export function getDeclarationChildren(reflection: {
  children?: JSONOutput.SomeReflection[];
}): TDDeclaration[] {
  return (reflection.children ?? []).filter(isDeclarationReflection);
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

function isGitHubUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "github.com" || parsed.hostname === "www.github.com";
  } catch {
    return false;
  }
}
