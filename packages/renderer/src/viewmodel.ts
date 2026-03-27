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
 * The kind of declaration a page or member represents.
 * - `package-index`: The root documentation page
 * - `module`: A module or namespace grouping exports
 * - `class`, `interface`: Class or interface declaration
 * - `function`, `variable`: Standalone function or variable
 * - `type-alias`: TypeScript type alias
 * - `enum`: Enumeration
 * - `namespace`: TypeScript namespace
 * - `constructor`, `method`, `property`, `accessor`: Member declarations
 * - `multiple`: Multiple declarations with the same name (e.g., variable + type alias)
 */
export type DeclarationKind =
  | "package-index"
  | "module"
  | "class"
  | "interface"
  | "function"
  | "type-alias"
  | "variable"
  | "enum"
  | "namespace"
  | "constructor"
  | "method"
  | "property"
  | "accessor"
  | "multiple";

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
  kind: DeclarationKind;
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
 * A content block within a section.
 *
 * Blocks are the atomic units of content rendering. Types include:
 * - `declaration-title`: Member or page title with kind badge
 * - `doc`: Documentation text
 * - `signatures`: Callable signatures (functions, methods)
 * - `card`: A member/item rendered as a card (methods, properties, etc.)
 * - `type-declaration`: Type alias or variable type definition
 * - `flags`: Modifier badges (deprecated, static, abstract, readonly)
 * - `parameters`: Parameter documentation list
 */
export type SectionBlock =
  | { kind: "declaration-title"; name: string; declarationKind: DeclarationKind }
  | { kind: "doc"; doc: DocNode[] }
  | { kind: "signatures"; signatures: SignatureViewModel[] }
  | { kind: "card"; anchor: string; url?: string; flags: MemberFlags; sections: Section[] }
  | { kind: "type-declaration"; name?: string; type: TypeViewModel; optional?: boolean }
  | { kind: "flags"; flags: MemberFlags }
  | { kind: "parameters"; parameters: ParameterDocViewModel[] }
  | { kind: "examples"; examples: DocNode[][] };

/**
 * A section with optional title and flat list of content blocks.
 *
 * Sections appear at both page level and inside cards. Both use the same structure
 * to support recursive composition.
 */
export interface Section {
  /** Optional section title (e.g., "Methods", "Parameters", "Signature"). */
  title?: string;
  /** Content blocks in this section. */
  body: SectionBlock[];
}

/** Parameter documentation entry pre-shaped for rendering in a member subsection. */
export interface ParameterDocViewModel {
  /** Parameter name. */
  name: string;
  /** Parameter documentation. */
  doc: DocNode[];
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
  /** Deprecation message from `@deprecated` block tag, if any. */
  deprecatedMessage?: DocNode[];
  /** Member is static (not on instance). */
  static?: boolean;
  /** Member is read-only. */
  readonly?: boolean;
  /** Member is abstract (must be implemented in subclass). */
  abstract?: boolean;
}

/**
 * A callable signature (function or method definition) for rendering in `SignatureLine`.
 *
 * Purely for type-notation display (e.g., `<T extends string>(x: T): T`).
 * Documentation (param descriptions, @returns, @throws, @example, etc.)
 * is emitted as separate Section[] by the transformer, not attached here.
 */
export interface SignatureViewModel {
  /** Generic type parameters (e.g., `<T>`, `<K extends string>`). */
  typeParameters: TypeParameterViewModel[];
  /** Function/method parameters. */
  parameters: ParameterViewModel[];
  /** Return type of this signature. */
  returnType: TypeViewModel;
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
}

/**
 * A generic type parameter for rendering in `SignatureLine` (e.g., `<T extends string>`).
 *
 * Purely for type-notation display. Documentation for type params (@template)
 * is emitted as a separate { kind: "parameters" } section by the transformer.
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
  | { kind: "reflection"; signatures: SignatureViewModel[]; members: SectionBlock[] }
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
  /** Kind of declaration (class, function, module, etc.). */
  kind: string;
  /** Icon class for this kind (e.g., "codicon-symbol-class"). */
  iconClass: string;
  /** Optional flags (deprecated, beta). */
  flags: { deprecated?: boolean; beta?: boolean };
  /** Child nodes (for modules or nested containers). */
  children: NavNode[];
}
