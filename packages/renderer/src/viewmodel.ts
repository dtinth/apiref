/**
 * ViewModel types — the intermediate representation between TypeDoc JSON and
 * rendered HTML. This is an internal type, not a public API.
 */

export interface SiteViewModel {
  package: { name: string; version: string };
  pages: PageViewModel[];
  navTree: NavNode[];
}

export type PageKind =
  | "package-index"
  | "module"
  | "class"
  | "interface"
  | "function"
  | "type-alias"
  | "variable"
  | "enum"
  | "namespace";

export interface PageViewModel {
  url: string;
  title: string;
  kind: PageKind;
  breadcrumbs: Breadcrumb[];
  sections: Section[];
}

export interface Breadcrumb {
  label: string;
  url: string;
}

export type Section =
  | { kind: "summary"; doc: DocNode[] }
  | { kind: "constructor"; signatures: SignatureViewModel[] }
  | { kind: "signatures"; signatures: SignatureViewModel[] }
  | { kind: "members"; label: string; members: MemberViewModel[] }
  | { kind: "type-declaration"; type: TypeViewModel };

export interface MemberViewModel {
  anchor: string;
  name: string;
  flags: MemberFlags;
  signatures: SignatureViewModel[];
  type: TypeViewModel | null;
  doc: DocNode[];
}

export interface MemberFlags {
  optional?: boolean;
  deprecated?: boolean;
  static?: boolean;
  readonly?: boolean;
  abstract?: boolean;
}

export interface SignatureViewModel {
  typeParameters: TypeParameterViewModel[];
  parameters: ParameterViewModel[];
  returnType: TypeViewModel;
  doc: DocNode[];
}

export interface ParameterViewModel {
  name: string;
  type: TypeViewModel;
  optional: boolean;
  doc: DocNode[];
}

export interface TypeParameterViewModel {
  name: string;
  constraint: TypeViewModel | null;
  default: TypeViewModel | null;
}

export type TypeViewModel =
  | { kind: "reference"; name: string; url: string | null; typeArguments: TypeViewModel[] }
  | { kind: "union"; types: TypeViewModel[] }
  | { kind: "intersection"; types: TypeViewModel[] }
  | { kind: "literal"; value: string }
  | { kind: "array"; elementType: TypeViewModel }
  | { kind: "tuple"; elements: TypeViewModel[] }
  | { kind: "intrinsic"; name: string }
  | { kind: "reflection"; signatures: SignatureViewModel[]; members: MemberViewModel[] }
  | { kind: "type-operator"; operator: string; target: TypeViewModel }
  | { kind: "indexed-access"; objectType: TypeViewModel; indexType: TypeViewModel }
  | {
      kind: "conditional";
      checkType: TypeViewModel;
      extendsType: TypeViewModel;
      trueType: TypeViewModel;
      falseType: TypeViewModel;
    }
  | { kind: "unknown"; raw: string };

export type DocNode =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; url: string | null };

export interface NavNode {
  label: string;
  url: string;
  kind: string;
  flags: { deprecated?: boolean; beta?: boolean };
  children: NavNode[];
}
