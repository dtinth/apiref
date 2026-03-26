import type { MemberViewModel, SignatureViewModel, DocNode } from "../viewmodel.ts";
import { DocView } from "./DocView.tsx";
import { SignatureLine, TypeView } from "./TypeView.tsx";
import { DeclarationTitle } from "./DeclarationTitle.tsx";

interface MemberListProps {
  members: MemberViewModel[];
}

function getMemberKind(member: MemberViewModel): string {
  // Use explicit kind if available (for declarations with their own pages)
  if (member.kind) return member.kind;
  // Otherwise infer from signatures/type
  if (member.signatures.length > 0) return "method";
  return "property";
}

function stripLinksFromDoc(doc: DocNode[]): DocNode[] {
  return doc.map((node) => {
    if (node.kind === "link") {
      return { kind: "text", text: node.text };
    }
    return node;
  });
}

export function MemberList({ members }: MemberListProps) {
  return (
    <div class="ar-member-list">
      {members.map((m) => {
        const cardClass = `ar-member-card${m.url ? " ar-member-card--link" : ""}`;
        const cardContent = <MemberView member={m} />;
        return m.url ? (
          <a href={m.url} id={m.anchor} key={m.anchor} class={cardClass}>
            {cardContent}
          </a>
        ) : (
          <div id={m.anchor} key={m.anchor} class={cardClass}>
            {cardContent}
          </div>
        );
      })}
    </div>
  );
}

function MemberView({ member }: { member: MemberViewModel }) {
  const { name, flags, signatures, type, doc, url } = member;
  const memberKind = getMemberKind(member);
  const displayName = signatures.length > 0 ? `${name}()` : name;

  // Abbreviated view for members with their own pages
  if (url) {
    const abbreviatedDoc = stripLinksFromDoc(doc);
    return (
      <>
        <h3 class="ar-member-card-header">
          <DeclarationTitle
            kind={memberKind}
            title={displayName}
            kindLabelClass="ar-member-card-kind"
          />
        </h3>
        {abbreviatedDoc.length > 0 && (
          <div class="ar-member-card-body">
            <DocView doc={abbreviatedDoc} />
          </div>
        )}
      </>
    );
  }

  // Full view for members without their own pages
  return (
    <>
      <h3 class="ar-member-card-header">
        <DeclarationTitle
          kind={memberKind}
          title={displayName}
          kindLabelClass="ar-member-card-kind"
        />
      </h3>

      <div class="ar-member-card-body">
        {(flags.deprecated || flags.static || flags.abstract || flags.readonly) && (
          <div>
            {flags.deprecated && <span class="ar-badge ar-badge--deprecated">deprecated</span>}
            {flags.static && <span class="ar-badge ar-badge--static">static</span>}
            {flags.abstract && <span class="ar-badge ar-badge--abstract">abstract</span>}
            {flags.readonly && <span class="ar-badge ar-badge--readonly">readonly</span>}
          </div>
        )}

        {signatures.length > 0 ? (
          <div class="ar-member-card-section">
            <div class="ar-member-card-section-label">Signature</div>
            <div class="ar-signature">
              {signatures.map((sig, i) => (
                <SignatureLine key={i} sig={sig} name={name} />
              ))}
            </div>
          </div>
        ) : type ? (
          <div class="ar-member-card-section">
            <div class="ar-member-card-section-label">Type</div>
            <div class="ar-signature">
              <span class="ar-sig-name">{name}</span>
              {flags.optional && "?"}
              {": "}
              <TypeView type={type} />
            </div>
          </div>
        ) : null}

        {doc.length > 0 && (
          <div class="ar-member-card-section">
            <DocView doc={doc} />
          </div>
        )}

        {signatures.map(
          (sig, i) =>
            sig.parameters.some((p) => p.doc.length > 0) && (
              <div key={i} class="ar-member-card-section">
                <div class="ar-member-card-section-label">Parameters</div>
                <ParamDocs sig={sig} />
              </div>
            ),
        )}
      </div>
    </>
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
