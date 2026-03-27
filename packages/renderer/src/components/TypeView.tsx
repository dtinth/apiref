import { Fragment } from "preact";
import type {
  MemberViewModel,
  TypeViewModel,
  SignatureViewModel,
  TypeParameterViewModel,
  ParameterViewModel,
} from "../viewmodel.ts";
import { useResolveLink } from "./PageContext.tsx";

interface TypeViewProps {
  type: TypeViewModel;
}

export function TypeView({ type }: TypeViewProps) {
  const resolve = useResolveLink();
  return <span class="ar-type">{renderType(type, resolve)}</span>;
}

function renderType(type: TypeViewModel, resolve: (url: string) => string): preact.ComponentChild {
  switch (type.kind) {
    case "intrinsic":
      return <span class="ar-type-intrinsic">{type.name}</span>;

    case "literal":
      return <span class="ar-type-literal">{type.value}</span>;

    case "reference": {
      const name = type.url ? (
        <a href={resolve(type.url)} class="ar-type-ref">
          {type.name}
        </a>
      ) : (
        <span class="ar-type-ref ar-type-ref--external">{type.name}</span>
      );

      const typeArgs =
        type.typeArguments.length > 0 ? (
          <>
            {"<"}
            {type.typeArguments.map((a, i) => (
              <Fragment key={i}>
                {i > 0 && ", "}
                {renderType(a, resolve)}
              </Fragment>
            ))}
            {">"}
          </>
        ) : null;

      return (
        <>
          {name}
          {typeArgs}
        </>
      );
    }

    case "union":
      return (
        <>
          {type.types.map((t, i) => (
            <Fragment key={i}>
              {i > 0 && <span class="ar-type-op"> | </span>}
              {renderType(t, resolve)}
            </Fragment>
          ))}
        </>
      );

    case "intersection":
      return (
        <>
          {type.types.map((t, i) => (
            <Fragment key={i}>
              {i > 0 && <span class="ar-type-op"> &amp; </span>}
              {renderType(t, resolve)}
            </Fragment>
          ))}
        </>
      );

    case "array":
      return (
        <>
          {renderType(type.elementType, resolve)}
          {"[]"}
        </>
      );

    case "tuple":
      return (
        <>
          {"["}
          {type.elements.map((t, i) => (
            <Fragment key={i}>
              {i > 0 && ", "}
              {renderType(t, resolve)}
            </Fragment>
          ))}
          {"]"}
        </>
      );

    case "reflection": {
      if (type.signatures.length > 0) {
        return (
          <>
            {"("}
            {renderSignatureParams(type.signatures[0]!, resolve)}
            {") => "}
            {renderType(type.signatures[0]!.returnType, resolve)}
          </>
        );
      }
      if (type.members.length > 0) {
        return (
          <>
            {"{ "}
            {type.members.map((member, i) => (
              <Fragment key={i}>
                {i > 0 && "; "}
                {renderReflectionTypeMember(member, resolve)}
              </Fragment>
            ))}
            {" }"}
          </>
        );
      }
      return <span class="ar-type-reflection">{"{}"}</span>;
    }

    case "query":
      return (
        <>
          <span class="ar-type-keyword">typeof </span>
          {renderType(type.queryType, resolve)}
        </>
      );

    case "type-operator":
      return (
        <>
          <span class="ar-type-keyword">{type.operator} </span>
          {renderType(type.target, resolve)}
        </>
      );

    case "indexed-access":
      return (
        <>
          {renderType(type.objectType, resolve)}
          {"["}
          {renderType(type.indexType, resolve)}
          {"]"}
        </>
      );

    case "mapped":
      return (
        <>
          {"{ "}
          {type.readonlyModifier && (
            <span class="ar-type-keyword">
              {renderMappedModifier(type.readonlyModifier, "readonly")}
            </span>
          )}
          {"["}
          {type.parameter}
          <span class="ar-type-keyword"> in </span>
          {renderType(type.parameterType, resolve)}
          {"]"}
          {type.optionalModifier && (
            <span class="ar-type-keyword">{renderMappedModifier(type.optionalModifier, "?")}</span>
          )}
          {": "}
          {renderType(type.templateType, resolve)}
          {" }"}
        </>
      );

    case "conditional":
      return (
        <>
          {renderType(type.checkType, resolve)}
          <span class="ar-type-keyword"> extends </span>
          {renderType(type.extendsType, resolve)}
          {" ? "}
          {renderType(type.trueType, resolve)}
          {" : "}
          {renderType(type.falseType, resolve)}
        </>
      );

    case "template-literal":
      return (
        <>
          {"`"}
          {type.head}
          {type.tail.map((item, i) => (
            <Fragment key={i}>
              {" ${"}
              {renderType(item[0], resolve)}
              {"}"}
              {item[1]}
            </Fragment>
          ))}
          {"`"}
        </>
      );

    case "predicate":
      return (
        <>
          {type.name}
          <span class="ar-type-keyword"> is </span>
          {type.targetType ? (
            renderType(type.targetType, resolve)
          ) : (
            <span class="ar-type-unknown">unknown</span>
          )}
        </>
      );

    case "unknown":
      return <span class="ar-type-unknown">{type.raw}</span>;
  }
}

function renderReflectionTypeMember(
  member: MemberViewModel,
  resolve: (url: string) => string,
): preact.ComponentChild {
  if (member.signatures && member.signatures[0]) {
    const sig = member.signatures[0];
    return (
      <>
        {member.name}
        {": ("}
        {renderSignatureParams(sig, resolve)}
        {") => "}
        {renderType(sig.returnType, resolve)}
      </>
    );
  }

  if (member.type) {
    return (
      <>
        {member.name}
        {member.flags?.optional ? "?" : ""}
        {": "}
        {renderType(member.type, resolve)}
      </>
    );
  }

  return <>{member.name}</>;
}

function renderSignatureParams(
  sig: SignatureViewModel,
  resolve: (url: string) => string,
): preact.ComponentChild {
  const parts: preact.ComponentChild[] = [];
  if (sig.typeParameters.length > 0) {
    parts.push(
      <>
        {"<"}
        {sig.typeParameters.map((tp, i) => (
          <Fragment key={i}>
            {i > 0 && ", "}
            {renderTypeParam(tp, resolve)}
          </Fragment>
        ))}
        {">"}
      </>,
    );
  }
  parts.push(
    <>
      {sig.parameters.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ", "}
          {renderParam(p, resolve)}
        </Fragment>
      ))}
    </>,
  );
  return <>{parts}</>;
}

function renderTypeParam(
  tp: TypeParameterViewModel,
  resolve: (url: string) => string,
): preact.ComponentChild {
  return (
    <>
      <span class="ar-type-param">{tp.name}</span>
      {tp.constraint && (
        <>
          <span class="ar-type-keyword"> extends </span>
          {renderType(tp.constraint, resolve)}
        </>
      )}
      {tp.default && (
        <>
          {" = "}
          {renderType(tp.default, resolve)}
        </>
      )}
    </>
  );
}

function renderParam(
  p: ParameterViewModel,
  resolve: (url: string) => string,
): preact.ComponentChild {
  return (
    <>
      <span class="ar-param-name">{p.name}</span>
      {p.optional && "?"}
      {": "}
      {renderType(p.type, resolve)}
    </>
  );
}

function renderMappedModifier(modifier: "+" | "-" | null, target: "readonly" | "?"): string {
  if (modifier === "+") return `+${target}${target === "readonly" ? " " : ""}`;
  if (modifier === "-") return `-${target}`;
  return "";
}

/** Render a full signature line, e.g. `<T>(param: Type): ReturnType` */
export function SignatureLine({ sig, name }: { sig: SignatureViewModel; name: string }) {
  const resolve = useResolveLink();
  return (
    <div class="ar-signature-line">
      <span class="ar-sig-name">{name}</span>
      {sig.typeParameters.length > 0 && (
        <>
          {"<"}
          {sig.typeParameters.map((tp, i) => (
            <Fragment key={i}>
              {i > 0 && ", "}
              {renderTypeParam(tp, resolve)}
            </Fragment>
          ))}
          {">"}
        </>
      )}
      {"("}
      {sig.parameters.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ", "}
          {renderParam(p, resolve)}
        </Fragment>
      ))}
      {")"}
      {": "}
      {renderType(sig.returnType, resolve)}
    </div>
  );
}

/** Render an index signature, e.g. `[key: string]: any` */
export function IndexSignatureLine({ sig }: { sig: SignatureViewModel }) {
  const resolve = useResolveLink();
  return (
    <div class="ar-signature-line">
      {"["}
      {sig.parameters.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ", "}
          {renderParam(p, resolve)}
        </Fragment>
      ))}
      {"]: "}
      {renderType(sig.returnType, resolve)}
    </div>
  );
}
