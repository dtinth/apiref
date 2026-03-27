/**
 * TypeDoc JSON schema types (schema version 2.0).
 * Only the fields and variants actually used by the transformer are typed here.
 */

export interface TDProject {
  schemaVersion: string;
  id: number;
  name: string;
  variant: "project";
  kind: 1;
  flags: TDFlags;
  children?: TDDeclaration[];
  comment?: TDComment;
  packageVersion?: string;
  packageName?: string;
  readme?: TDCommentPart[];
  groups?: TDGroup[];
}

export interface TDDeclaration {
  id: number;
  name: string;
  variant: "declaration";
  kind: number;
  flags: TDFlags;
  comment?: TDComment;
  children?: TDDeclaration[];
  signatures?: TDSignature[];
  indexSignatures?: TDSignature[];
  sources?: TDSource[];
  type?: TDType;
  typeParameters?: TDTypeParameter[];
  getSignature?: TDSignature;
  setSignature?: TDSignature;
  groups?: TDGroup[];
}

export interface TDGroup {
  title: string;
  children: number[];
}

export interface TDSignature {
  id: number;
  name: string;
  variant: "signature";
  kind: number;
  flags: TDFlags;
  comment?: TDComment;
  parameters?: TDParameter[];
  type?: TDType;
  typeParameters?: TDTypeParameter[];
  sources?: TDSource[];
}

export interface TDParameter {
  id: number;
  name: string;
  variant: "param";
  kind: 32768;
  flags: TDFlags;
  comment?: TDComment;
  type?: TDType;
  defaultValue?: string;
}

export interface TDTypeParameter {
  id: number;
  name: string;
  variant: "typeParam";
  kind: 131072;
  flags: TDFlags;
  comment?: TDComment;
  /** Constraint */
  type?: TDType;
  default?: TDType;
}

export interface TDSource {
  fileName: string;
  line: number;
  character: number;
  url?: string;
}

export interface TDFlags {
  isOptional?: boolean;
  isReadonly?: boolean;
  isStatic?: boolean;
  isAbstract?: boolean;
  isPrivate?: boolean;
  isProtected?: boolean;
  isConst?: boolean;
  isDeprecated?: boolean;
}

export interface TDComment {
  summary: TDCommentPart[];
  blockTags?: TDBlockTag[];
  modifierTags?: string[];
}

export type TDCommentPart =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "inline-tag"; tag: string; text: string; target?: number | string };

export interface TDBlockTag {
  tag: string;
  content: TDCommentPart[];
}

export type TDType =
  | {
      type: "reference";
      target?: number | TDExternalTarget;
      name: string;
      package?: string;
      typeArguments?: TDType[];
      refersToTypeParameter?: boolean;
    }
  | { type: "intrinsic"; name: string }
  | { type: "literal"; value: string | number | boolean | null }
  | { type: "union"; types: TDType[] }
  | { type: "intersection"; types: TDType[] }
  | { type: "array"; elementType: TDType }
  | { type: "tuple"; elements: TDType[] }
  | { type: "reflection"; declaration: TDDeclaration }
  | { type: "typeOperator"; operator: "keyof" | "unique" | "readonly"; target: TDType }
  | { type: "indexedAccess"; indexType: TDType; objectType: TDType }
  | {
      type: "conditional";
      checkType: TDType;
      extendsType: TDType;
      trueType: TDType;
      falseType: TDType;
    }
  | {
      type: "mapped";
      parameter: string;
      parameterType: TDType;
      templateType: TDType;
      optionalModifier?: "+" | "-";
      readonlyModifier?: "+" | "-";
    }
  | { type: "query"; queryType: TDType }
  | { type: "predicate"; name: string; asserts: boolean; targetType?: TDType }
  | { type: "templateLiteral"; head: string; tail: [TDType, string][] }
  | { type: "namedTupleMember"; element: TDType; name: string; isOptional: boolean }
  | { type: "rest"; elementType: TDType }
  | { type: "optional"; elementType: TDType }
  | { type: "unknown"; name: string };

export interface TDExternalTarget {
  packageName?: string;
  packagePath?: string;
  qualifiedName?: string;
  sourceFileName?: string;
}

/** ReflectionKind numeric values from TypeDoc. */
export const Kind = {
  Project: 1,
  Module: 2,
  Namespace: 4,
  Enum: 8,
  EnumMember: 16,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  CallSignature: 4096,
  IndexSignature: 8192,
  ConstructorSignature: 16384,
  Parameter: 32768,
  TypeLiteral: 65536,
  TypeParameter: 131072,
  Accessor: 262144,
  GetSignature: 524288,
  SetSignature: 1048576,
  TypeAlias: 2097152,
} as const;

/** Kinds that become their own HTML pages. */
export const PAGE_KINDS: Set<number> = new Set([
  Kind.Project,
  Kind.Module,
  Kind.Namespace,
  Kind.Enum,
  Kind.Variable,
  Kind.Function,
  Kind.Class,
  Kind.Interface,
  Kind.TypeAlias,
]);

/** Kinds that become anchors on their parent's page. */
export const ANCHOR_KINDS: Set<number> = new Set([
  Kind.EnumMember,
  Kind.Constructor,
  Kind.Property,
  Kind.Method,
  Kind.Accessor,
]);
