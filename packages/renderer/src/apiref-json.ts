import type { DeclarationKind, PageViewModel, SiteViewModel, NavNode } from "./viewmodel.ts";

export const GENERATOR_VERSION = 1;

export interface ApirefOutlineItem {
  name: string;
  kind: DeclarationKind;
  anchor: string;
  linkTo?: string;
}

export interface ApirefTreeNode {
  name: string;
  kind: string;
  url: string;
  children?: ApirefTreeNode[];
  outline?: ApirefOutlineItem[];
}

export interface ApirefJson {
  package: string;
  version: string;
  generatorVersion: typeof GENERATOR_VERSION;
  tree: ApirefTreeNode[];
}

/**
 * Collect outline items from a page's sections.
 * Walks through sections looking for cards and extracts their member information,
 * including the optional linkTo from the card's url field.
 */
function collectOutlineItems(page: PageViewModel): ApirefOutlineItem[] {
  const items: ApirefOutlineItem[] = [];

  for (const section of page.sections) {
    if (section.title && section.id) {
      for (const block of section.body) {
        if (block.kind === "card") {
          const titleBlock = block.sections[0]?.body[0];
          if (titleBlock?.kind === "declaration-title") {
            const item: ApirefOutlineItem = {
              name: titleBlock.name,
              kind: titleBlock.declarationKind,
              anchor: block.anchor,
            };
            if (block.url) {
              item.linkTo = block.url;
            }
            items.push(item);
          }
        }
      }
    }
  }

  return items;
}

/**
 * Convert a NavNode to an ApirefTreeNode, including outline items for pages.
 * Recursively processes children.
 */
function navToTreeNode(node: NavNode, urlToPage: Map<string, PageViewModel>): ApirefTreeNode {
  const treeNode: ApirefTreeNode = {
    name: node.label,
    kind: node.kind,
    url: node.url,
  };

  // Attach outline for pages that have members
  const page = urlToPage.get(node.url);
  if (page) {
    const outline = collectOutlineItems(page);
    if (outline.length > 0) {
      treeNode.outline = outline;
    }
  }

  // Recursively process children
  if (node.children.length > 0) {
    treeNode.children = node.children.map((child) => navToTreeNode(child, urlToPage));
  }

  return treeNode;
}

/**
 * Build the apiref.json structure from a SiteViewModel.
 * Combines the hierarchical navTree with per-page outline information.
 */
export function buildApirefJson(site: SiteViewModel): ApirefJson {
  // Build a map from URL to PageViewModel for quick lookup when processing navTree
  const urlToPage = new Map<string, PageViewModel>();
  for (const page of site.pages) {
    urlToPage.set(page.url, page);
  }

  return {
    package: site.package.name,
    version: site.package.version,
    generatorVersion: GENERATOR_VERSION,
    tree: site.navTree.map((node) => navToTreeNode(node, urlToPage)),
  };
}
