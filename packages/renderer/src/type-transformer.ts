import type {
  TDType,
  TDTypeParameter,
  TDSignature,
  TDParameter,
  TDDeclaration,
} from "./typedoc.ts";
import type { TransformContext } from "./transform-context.ts";
import type {
  TypeViewModel,
  TypeParameterViewModel,
  SignatureViewModel,
  ParameterViewModel,
  MemberFlags,
} from "./viewmodel.ts";
import { buildReflectionMemberBlocks } from "./transformer.ts";

export function transformType(tdType: TDType, ctx: TransformContext): TypeViewModel {
  switch (tdType.type) {
    case "intrinsic":
      return { kind: "intrinsic", name: tdType.name };

    case "literal": {
      const val = tdType.value;
      if (val === null) return { kind: "literal", value: "null" };
      if (typeof val === "string") return { kind: "literal", value: JSON.stringify(val) };
      // val is number | boolean at this point
      return { kind: "literal", value: (val as number | boolean).toString() };
    }

    case "reference": {
      const url =
        typeof tdType.target === "number" ? (ctx.idToUrl.get(tdType.target) ?? null) : null;
      const typeArguments = (tdType.typeArguments ?? []).map((t) => transformType(t, ctx));
      return { kind: "reference", name: tdType.name, url, typeArguments };
    }

    case "union":
      return {
        kind: "union",
        types: tdType.types.map((t) => transformType(t, ctx)),
      };

    case "intersection":
      return {
        kind: "intersection",
        types: tdType.types.map((t) => transformType(t, ctx)),
      };

    case "array":
      return {
        kind: "array",
        elementType: transformType(tdType.elementType, ctx),
      };

    case "tuple":
      return {
        kind: "tuple",
        elements: tdType.elements.map((t) => transformType(t, ctx)),
      };

    case "typeOperator":
      return {
        kind: "type-operator",
        operator: tdType.operator,
        target: transformType(tdType.target, ctx),
      };

    case "indexedAccess":
      return {
        kind: "indexed-access",
        objectType: transformType(tdType.objectType, ctx),
        indexType: transformType(tdType.indexType, ctx),
      };

    case "conditional":
      return {
        kind: "conditional",
        checkType: transformType(tdType.checkType, ctx),
        extendsType: transformType(tdType.extendsType, ctx),
        trueType: transformType(tdType.trueType, ctx),
        falseType: transformType(tdType.falseType, ctx),
      };

    case "reflection": {
      const decl = tdType.declaration;
      const sigs = (decl.signatures ?? []).map((s) => transformSignature(s, ctx));
      // For reflection members, extract just the essential type info (not full cards)
      const members = (decl.children ?? []).flatMap((c) => buildReflectionMemberBlocks(c, ctx));
      return { kind: "reflection", signatures: sigs, members };
    }

    default:
      // Unknown or future TypeDoc type variants — preserve as raw JSON
      return { kind: "unknown", raw: JSON.stringify(tdType) };
  }
}

export function transformTypeParameter(
  tp: TDTypeParameter,
  ctx: TransformContext,
): TypeParameterViewModel {
  return {
    name: tp.name,
    constraint: tp.type ? transformType(tp.type, ctx) : null,
    default: tp.default ? transformType(tp.default, ctx) : null,
  };
}

export function transformSignature(sig: TDSignature, ctx: TransformContext): SignatureViewModel {
  const typeParameters: TypeParameterViewModel[] = (sig.typeParameters ?? []).map((tp) =>
    transformTypeParameter(tp, ctx),
  );
  const parameters: ParameterViewModel[] = (sig.parameters ?? []).map((p) =>
    transformParameter(p, ctx),
  );
  const returnType: TypeViewModel = sig.type
    ? transformType(sig.type, ctx)
    : { kind: "intrinsic", name: "void" };
  return { typeParameters, parameters, returnType };
}

export function transformParameter(param: TDParameter, ctx: TransformContext): ParameterViewModel {
  const type = param.type
    ? transformType(param.type, ctx)
    : { kind: "intrinsic" as const, name: "unknown" };
  return {
    name: param.name,
    type,
    optional: param.flags.isOptional ?? false,
  };
}

export function transformFlags(flags: TDDeclaration["flags"]): MemberFlags {
  const result: MemberFlags = {};
  if (flags.isOptional) result.optional = true;
  if (flags.isReadonly) result.readonly = true;
  if (flags.isStatic) result.static = true;
  if (flags.isAbstract) result.abstract = true;
  if (flags.isDeprecated) result.deprecated = true;
  return result;
}
