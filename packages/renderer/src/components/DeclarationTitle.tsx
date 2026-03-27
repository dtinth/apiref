import type { DeclarationKind } from "../viewmodel.ts";
import { getKindIcon } from "./kind-icons.ts";

/**
 * Icon + title + kind label for declaration headers.
 * Returns a fragment so the parent can wrap in h1, h3, etc.
 */

export interface DeclarationTitleProps {
  kind: DeclarationKind;
  title: string;
  kindLabelClass?: string;
}

export function DeclarationTitle({
  kind,
  title,
  kindLabelClass = "ar-declaration-kind",
}: DeclarationTitleProps) {
  const iconClass = getKindIcon(kind);
  return (
    <span class="ar-declaration-title-wrapper">
      <i class={`codicon ${iconClass} ar-kind-icon ar-kind-icon--${kind}`} />
      <span class="ar-declaration-title-text">
        <span>{title}</span>
        <span> </span>
        <span class={kindLabelClass}>{kind}</span>
      </span>
    </span>
  );
}
