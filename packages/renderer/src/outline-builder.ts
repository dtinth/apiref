import type { DeclarationKind, Section } from "./viewmodel.ts";
import { getKindIcon } from "./components/kind-icons.ts";

export interface OutlineItem {
  label: string;
  anchor: string;
  kind: DeclarationKind;
  iconClass: string;
  flags: { deprecated?: boolean };
}

export interface OutlineSection {
  label: string;
  id: string; // DOM id for the section (only present if section has an id)
  items: OutlineItem[];
}

/**
 * Build an outline structure from page sections.
 *
 * Extracts titled sections with ids and their card items (methods, properties, constructors, etc.)
 * for use in the outline sidebar panel. Only includes sections that have an explicit id.
 *
 * @param sections - The page sections to extract outline from
 * @returns Array of outline sections with items (only those with ids)
 */
export function buildOutline(sections: Section[]): OutlineSection[] {
  const result: OutlineSection[] = [];
  for (const section of sections) {
    if (section.title && section.id) {
      const items: OutlineItem[] = [];
      for (const block of section.body) {
        if (block.kind === "card") {
          const titleBlock = block.sections[0]?.body[0];
          if (titleBlock?.kind === "declaration-title") {
            items.push({
              label: titleBlock.name,
              anchor: block.anchor,
              kind: titleBlock.declarationKind,
              iconClass: getKindIcon(titleBlock.declarationKind),
              flags: { deprecated: block.flags.deprecated },
            });
          }
        }
      }
      result.push({
        label: section.title,
        id: section.id,
        items,
      });
    }
  }
  return result;
}
