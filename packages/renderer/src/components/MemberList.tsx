import type { MemberViewModel, SignatureViewModel } from "../viewmodel.ts";
import { DocView } from "./DocView.tsx";
import { SignatureLine, TypeView } from "./TypeView.tsx";

interface MemberListProps {
  members: MemberViewModel[];
}

export function MemberList({ members }: MemberListProps) {
  return (
    <ul class="ar-member-list">
      {members.map((m) => (
        <li id={m.anchor} key={m.anchor} class="ar-member">
          <MemberView member={m} />
        </li>
      ))}
    </ul>
  );
}

function MemberView({ member }: { member: MemberViewModel }) {
  const { name, flags, signatures, type, doc } = member;

  return (
    <div class="ar-member-body">
      {flags.deprecated && <span class="ar-badge ar-badge--deprecated">deprecated</span>}
      {flags.static && <span class="ar-badge ar-badge--static">static</span>}
      {flags.abstract && <span class="ar-badge ar-badge--abstract">abstract</span>}
      {flags.readonly && <span class="ar-badge ar-badge--readonly">readonly</span>}

      {signatures.length > 0 ? (
        <div class="ar-signature">
          {signatures.map((sig, i) => (
            <SignatureLine key={i} sig={sig} name={name} />
          ))}
        </div>
      ) : type ? (
        <div class="ar-signature">
          <span class="ar-sig-name">{name}</span>
          {flags.optional && "?"}
          {": "}
          <TypeView type={type} />
        </div>
      ) : (
        <div class="ar-signature">
          <span class="ar-sig-name">{name}</span>
        </div>
      )}

      <DocView doc={doc} />

      {signatures.map(
        (sig, i) => sig.parameters.some((p) => p.doc.length > 0) && <ParamDocs key={i} sig={sig} />,
      )}
    </div>
  );
}

function ParamDocs({ sig }: { sig: SignatureViewModel }) {
  const paramsWithDocs = sig.parameters.filter((p) => p.doc.length > 0);
  if (paramsWithDocs.length === 0) return null;
  return (
    <dl class="ar-param-list">
      {paramsWithDocs.map((p) => (
        <>
          <dt key={`dt-${p.name}`} class="ar-param-name">
            {p.name}
          </dt>
          <dd key={`dd-${p.name}`} class="ar-param-doc">
            <DocView doc={p.doc} />
          </dd>
        </>
      ))}
    </dl>
  );
}
