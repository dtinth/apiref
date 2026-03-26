import type { MemberSubsection, MemberViewModel } from "../viewmodel.ts";
import { DocView } from "./DocView.tsx";
import { SignatureLine, TypeView } from "./TypeView.tsx";
import { DeclarationTitle } from "./DeclarationTitle.tsx";

interface MemberListProps {
  members: MemberViewModel[];
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
  const { name, kind, title, subsections } = member;
  return (
    <>
      <h3 class="ar-member-card-header">
        <DeclarationTitle kind={kind} title={title} kindLabelClass="ar-member-card-kind" />
      </h3>

      {subsections.length > 0 && (
        <div class="ar-member-card-body">{subsections.map((section, index) => renderSubsection(section, index, name))}</div>
      )}
    </>
  );
}

function renderSubsection(subsection: MemberSubsection, index: number, memberName: string) {
  switch (subsection.kind) {
    case "flags":
      return (
        <div key={index}>
          {subsection.flags.deprecated && <span class="ar-badge ar-badge--deprecated">deprecated</span>}
          {subsection.flags.static && <span class="ar-badge ar-badge--static">static</span>}
          {subsection.flags.abstract && <span class="ar-badge ar-badge--abstract">abstract</span>}
          {subsection.flags.readonly && <span class="ar-badge ar-badge--readonly">readonly</span>}
        </div>
      );

    case "summary":
      return (
        <div key={index} class="ar-member-card-section">
          <DocView doc={subsection.doc} />
        </div>
      );

    case "signatures":
      return (
        <div key={index} class="ar-member-card-section">
          <div class="ar-member-card-section-label">Signature</div>
          <div class="ar-signature">
            {subsection.signatures.map((sig, i) => (
              <SignatureLine key={i} sig={sig} name={memberName} />
            ))}
          </div>
        </div>
      );

    case "type-declaration":
      return (
        <div key={index} class="ar-member-card-section">
          <div class="ar-member-card-section-label">Type</div>
          <div class="ar-signature">
            <span class="ar-sig-name">{subsection.name}</span>
            {subsection.optional && "?"}
            {": "}
            <TypeView type={subsection.type} />
          </div>
        </div>
      );

    case "parameters":
      return (
        <div key={index} class="ar-member-card-section">
          <div class="ar-member-card-section-label">Parameters</div>
          <dl class="ar-param-list">
            {subsection.parameters.map((parameter) => (
              <>
                <dt key={`dt-${parameter.name}`} class="ar-param-name">
                  {parameter.name}
                </dt>
                <dd key={`dd-${parameter.name}`} class="ar-param-doc">
                  <DocView doc={parameter.doc} />
                </dd>
              </>
            ))}
          </dl>
        </div>
      );
  }
}
