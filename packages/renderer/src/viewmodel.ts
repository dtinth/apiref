/**
 * ViewModel types — the intermediate representation between TypeDoc JSON and
 * rendered HTML. These types describe the complete structure of a documentation site.
 */

/**
 * The root object representing an entire API documentation site.
 *
 * @example
 * ```typescript
 * const site = transform(typedocJson);
 * // site.package = { name: "@my/lib", version: "1.0.0" }
 * // site.pages = [ { url: "index.html", ... }, ... ]
 * // site.navTree = [ { label: "MyClass", url: "MyClass.html", ... }, ... ]
 * ```
 */
export interface SiteViewModel {
  /** Package metadata (name and version). */
  package: { name: string; version: string };
  /** All documentation pages, one per declaration. */
  pages: PageViewModel[];
  /** Navigation tree for the sidebar, hierarchically organized by kind/module. */
  navTree: NavNode[];
}

/**
 * The kind of declaration a page represents.
 * - `package-index`: The root documentation page
 * - `module`: A module or namespace grouping exports
 * - `class`, `interface`: Class or interface declaration
 * - `function`, `variable`: Standalone function or variable
 * - `type-alias`: TypeScript type alias
 * - `enum`: Enumeration
 * - `namespace`: TypeScript namespace
 */
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

/**
 * A single documentation page representing a declaration (class, function, etc.)
 * or the package index.
 *
 * Renders to a complete HTML document at the specified URL.
 */
export interface PageViewModel {
  /** Relative URL for this page (e.g., "MyClass.html", "module/MyClass.html"). */
  url: string;
  /** Display title (usually the declaration name or package name). */
  title: string;
  /** The kind of declaration this page documents. */
  kind: PageKind;
  /** Breadcrumb navigation path (e.g., Package > Module > Class). */
  breadcrumbs: Breadcrumb[];
  /** Content sections (summary, members, signatures, etc.). */
  sections: Section[];
}

/** A single breadcrumb in the navigation path. */
export interface Breadcrumb {
  /** Display text for this breadcrumb. */
  label: string;
  /** URL to navigate to. */
  url: string;
}

/**
 * A content section within a page.
 *
 * Different section kinds render different content:
 * - `summary`: Documentation text/description
 * - `constructor`: Class constructor(s) with signatures
 * - `signatures`: Callable signatures (functions, methods)
 * - `members`: Listed members (properties, methods, etc.) within a class/interface
 * - `type-declaration`: Type alias or variable type definition
 */
export type Section =
  | { kind: "summary"; doc: DocNode[] }
  | { kind: "constructor"; signatures: SignatureViewModel[] }
  | { kind: "signatures"; signatures: SignatureViewModel[] }
  | { kind: "members"; label: string; members: MemberViewModel[] }
  | { kind: "type-declaration"; type: TypeViewModel };

/**
 * A member (property, method, accessor, etc.) of a class or interface.
 *
 * Can have optional signatures (for callable members) and/or a type (for properties).
 */
export interface MemberViewModel {
  /** URL anchor for this member (used in table of contents and links). */
  anchor: string;
  /** Member name. */
  name: string;
  /** Optional modifiers and flags. */
  flags: MemberFlags;
  /** Signatures if this member is callable (methods, getters, setters). */
  signatures: SignatureViewModel[];
  /** Type if this member has a static type (properties, fields). */
  type: TypeViewModel | null;
  /** JSDoc/TSDoc comments. */
  doc: DocNode[];
  /** URL to this member's page, if it has its own page. */
  url?: string;
}

/**
 * Modifiers and flags for a member.
 *
 * @example
 * ```typescript
 * // A readonly static property
 * flags: { readonly: true, static: true }
 * ```
 */
export interface MemberFlags {
  /** Member is optional (TypeScript optional property). */
  optional?: boolean;
  /** Member is marked as `@deprecated`. */
  deprecated?: boolean;
  /** Member is static (not on instance). */
  static?: boolean;
  /** Member is read-only. */
  readonly?: boolean;
  /** Member is abstract (must be implemented in subclass). */
  abstract?: boolean;
}

/**
 * A callable signature (function or method definition).
 *
 * Includes type parameters (generics), parameters, return type, and documentation.
 */
export interface SignatureViewModel {
  /** Generic type parameters (e.g., `<T>`, `<K extends string>`). */
  typeParameters: TypeParameterViewModel[];
  /** Function/method parameters. */
  parameters: ParameterViewModel[];
  /** Return type of this signature. */
  returnType: TypeViewModel;
  /** JSDoc/TSDoc comments. */
  doc: DocNode[];
}

/**
 * A function or method parameter.
 *
 * @example
 * ```typescript
 * // Function parameter: foo: string | number
 * { name: "foo", type: { kind: "union", ... }, optional: false, doc: [] }
 * ```
 */
export interface ParameterViewModel {
  /** Parameter name. */
  name: string;
  /** Parameter type. */
  type: TypeViewModel;
  /** Whether the parameter is optional. */
  optional: boolean;
  /** JSDoc `@param` documentation. */
  doc: DocNode[];
}

/**
 * A generic type parameter with optional constraint and default.
 *
 * @example
 * ```typescript
 * // <T extends string = "default">
 * { name: "T", constraint: { kind: "intrinsic", name: "string" }, default: { kind: "literal", value: "default" } }
 * ```
 */
export interface TypeParameterViewModel {
  /** Type parameter name (e.g., "T", "K"). */
  name: string;
  /** Constraint (e.g., `extends string`), if any. */
  constraint: TypeViewModel | null;
  /** Default type, if any. */
  default: TypeViewModel | null;
}

/**
 * A TypeScript type, represented as a tagged union.
 *
 * Covers all TypeScript type constructs including primitives, generics, unions,
 * intersections, conditional types, and reflections (inline object/function types).
 *
 * @example
 * ```typescript
 * // string | number
 * { kind: "union", types: [
 *   { kind: "intrinsic", name: "string" },
 *   { kind: "intrinsic", name: "number" }
 * ]}
 * ```
 */
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

/**
 * A documentation node, part of a JSDoc/TSDoc comment.
 *
 * Reassembled from TypeDoc's comment parts to support rendering with Markdown or custom handlers.
 *
 * @example
 * ```typescript
 * // "@param x The input value (see {@link MyType})"
 * [
 *   { kind: "text", text: "@param x The input value (see " },
 *   { kind: "link", text: "MyType", url: "MyType.html" },
 *   { kind: "text", text: ")" }
 * ]
 * ```
 */
export type DocNode =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; url: string | null };

/**
 * A node in the sidebar navigation tree.
 *
 * Organized hierarchically by module or kind, with declarations at the leaves.
 */
export interface NavNode {
  /** Display label for this node. */
  label: string;
  /** URL of the page this node links to. */
  url: string;
  /** Kind of declaration (class, function, module, etc.). Used to select icons. */
  kind: string;
  /** Optional flags (deprecated, beta). */
  flags: { deprecated?: boolean; beta?: boolean };
  /** Child nodes (for modules or nested containers). */
  children: NavNode[];
}
