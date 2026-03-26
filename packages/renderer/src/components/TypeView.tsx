import { Fragment } from "preact";
import type {
  MemberViewModel,
  TypeViewModel,
  SignatureViewModel,
  TypeParameterViewModel,
  ParameterViewModel,
} from "../viewmodel.ts";

interface TypeViewProps {
  type: TypeViewModel;
}

export function TypeView({ type }: TypeViewProps) {
  return <span class="ar-type">{renderType(type)}</span>;
}

function renderType(type: TypeViewModel): preact.ComponentChild {
  switch (type.kind) {
    case "intrinsic":
      return <span class="ar-type-intrinsic">{type.name}</span>;

    case "literal":
      return <span class="ar-type-literal">{type.value}</span>;

    case "reference": {
      const inner = (
        <>
          {type.name}
          {type.typeArguments.length > 0 && (
            <>
              {"<"}
              {type.typeArguments.map((a, i) => (
                <Fragment key={i}>
                  {i > 0 && ", "}
                  {renderType(a)}
                </Fragment>
              ))}
              {">"}
            </>
          )}
        </>
      );
      if (type.url) {
        return (
          <a href={type.url} class="ar-type-ref">
            {inner}
          </a>
        );
      }
      return <span class="ar-type-ref ar-type-ref--external">{inner}</span>;
    }

    case "union":
      return (
        <>
          {type.types.map((t, i) => (
            <Fragment key={i}>
              {i > 0 && <span class="ar-type-op"> | </span>}
              {renderType(t)}
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
              {renderType(t)}
            </Fragment>
          ))}
        </>
      );

    case "array":
      return (
        <>
          {renderType(type.elementType)}
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
              {renderType(t)}
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
            {renderSignatureParams(type.signatures[0]!)}
            {") => "}
            {renderType(type.signatures[0]!.returnType)}
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
                {renderReflectionTypeMember(member)}
              </Fragment>
            ))}
            {" }"}
          </>
        );
      }
      return <span class="ar-type-reflection">{"{}"}</span>;
    }

    case "type-operator":
      return (
        <>
          <span class="ar-type-keyword">{type.operator} </span>
          {renderType(type.target)}
        </>
      );

    case "indexed-access":
      return (
        <>
          {renderType(type.objectType)}
          {"["}
          {renderType(type.indexType)}
          {"]"}
        </>
      );

    case "conditional":
      return (
        <>
          {renderType(type.checkType)}
          <span class="ar-type-keyword"> extends </span>
          {renderType(type.extendsType)}
          {" ? "}
          {renderType(type.trueType)}
          {" : "}
          {renderType(type.falseType)}
        </>
      );

    case "unknown":
      return <span class="ar-type-unknown">{type.raw}</span>;
  }
}

function renderReflectionTypeMember(member: MemberViewModel) {
  let typeSubsection: Extract<
    MemberViewModel["subsections"][number],
    { kind: "type-declaration" }
  > | null = null;
  let signatureSubsection: Extract<
    MemberViewModel["subsections"][number],
    { kind: "signatures" }
  > | null = null;

  for (const subsection of member.subsections) {
    if (subsection.kind === "type-declaration") {
      typeSubsection = subsection;
    } else if (subsection.kind === "signatures") {
      signatureSubsection = subsection;
    }
    if (typeSubsection && signatureSubsection) break;
  }

  return (
    <>
      {member.name}
      {member.flags.optional ? "?" : ""}
      {typeSubsection?.kind === "type-declaration" ? (
        <>
          {": "}
          {renderType(typeSubsection.type)}
        </>
      ) : signatureSubsection?.kind === "signatures" && signatureSubsection.signatures[0] ? (
        <>
          {": ("}
          {renderSignatureParams(signatureSubsection.signatures[0])}
          {") => "}
          {renderType(signatureSubsection.signatures[0].returnType)}
        </>
      ) : null}
    </>
  );
}

function renderSignatureParams(sig: SignatureViewModel): preact.ComponentChild {
  const parts: preact.ComponentChild[] = [];
  if (sig.typeParameters.length > 0) {
    parts.push(
      <>
        {"<"}
        {sig.typeParameters.map((tp, i) => (
          <Fragment key={i}>
            {i > 0 && ", "}
            {renderTypeParam(tp)}
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
          {renderParam(p)}
        </Fragment>
      ))}
    </>,
  );
  return <>{parts}</>;
}

function renderTypeParam(tp: TypeParameterViewModel): preact.ComponentChild {
  return (
    <>
      <span class="ar-type-param">{tp.name}</span>
      {tp.constraint && (
        <>
          <span class="ar-type-keyword"> extends </span>
          {renderType(tp.constraint)}
        </>
      )}
      {tp.default && (
        <>
          {" = "}
          {renderType(tp.default)}
        </>
      )}
    </>
  );
}

function renderParam(p: ParameterViewModel): preact.ComponentChild {
  return (
    <>
      <span class="ar-param-name">{p.name}</span>
      {p.optional && "?"}
      {": "}
      {renderType(p.type)}
    </>
  );
}

/** Render a full signature line, e.g. `<T>(param: Type): ReturnType` */
export function SignatureLine({ sig, name }: { sig: SignatureViewModel; name: string }) {
  return (
    <div class="ar-signature-line">
      <span class="ar-sig-name">{name}</span>
      {sig.typeParameters.length > 0 && (
        <>
          {"<"}
          {sig.typeParameters.map((tp, i) => (
            <Fragment key={i}>
              {i > 0 && ", "}
              {renderTypeParam(tp)}
            </Fragment>
          ))}
          {">"}
        </>
      )}
      {"("}
      {sig.parameters.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ", "}
          {renderParam(p)}
        </Fragment>
      ))}
      {")"}
      {": "}
      {renderType(sig.returnType)}
    </div>
  );
}
