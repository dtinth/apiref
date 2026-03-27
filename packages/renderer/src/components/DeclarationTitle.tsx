import type { DeclarationKind } from "../viewmodel.ts";
import { getKindIcon } from "./kind-icons.ts";

/**
 * Icon + title + kind label for declaration headers.
 * Returns a fragment so the parent can wrap in h1, h3, etc.
 */

export interface DeclarationTitleProps {
  kind: DeclarationKind;
  title: string;
}

export function DeclarationTitle({ kind, title }: DeclarationTitleProps) {
  const iconClass = getKindIcon(kind);
  return (
    <span class="ar-declaration-title-wrapper">
      <i class={`codicon ${iconClass} ar-kind-icon ar-kind-icon--${kind}`} />
      <span class="ar-declaration-title-text">
        <span>{title}</span>
        <span> </span>
        <span class="ar-declaration-kind">{kind}</span>
      </span>
    </span>
  );
}

export function SourceLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      class="ar-source-link"
      aria-label="View source on GitHub"
      title="View source on GitHub"
      target="_blank"
      rel="noreferrer"
    >
      <i class="codicon codicon-source-control" aria-hidden="true" />
    </a>
  );
}
