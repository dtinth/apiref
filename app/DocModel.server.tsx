import { ApiItem, ApiItemKind, ApiModel } from '@microsoft/api-extractor-model'

export async function getApiModel(_packageIdentifier: string) {
  const model = new ApiModel()
  model.loadPackage('fixtures/node-core-library.api.json')
  const pages = generatePages(model)
  return { model, pages }
}

export type PageInfo = {
  navigationTitle: string
  pageTitle: string
  item: ApiItem
  pageSortKey: string
  parentPath: ApiItem[]
}

export type Page = {
  info: PageInfo
  slug: string
}

function generatePages(model: ApiModel) {
  const pageInfos: PageInfo[] = []
  const visit = (
    node: ApiItem,
    parentKind: ApiItemKind | undefined = undefined,
    parentPath: ApiItem[] = [],
  ) => {
    let allowedKinds: ApiItemKind[] = []
    switch (parentKind) {
      case undefined:
        allowedKinds.push(ApiItemKind.Package)
        allowedKinds.push(ApiItemKind.EntryPoint)
        break
      case ApiItemKind.EntryPoint:
      case ApiItemKind.Package:
      case ApiItemKind.Namespace:
        allowedKinds.push(ApiItemKind.Class)
        allowedKinds.push(ApiItemKind.Enum)
        allowedKinds.push(ApiItemKind.Interface)
        allowedKinds.push(ApiItemKind.Function)
        allowedKinds.push(ApiItemKind.Namespace)
        allowedKinds.push(ApiItemKind.TypeAlias)
        allowedKinds.push(ApiItemKind.Variable)
        break
      case ApiItemKind.Class:
        allowedKinds.push(ApiItemKind.Constructor)
        allowedKinds.push(ApiItemKind.Method)
        allowedKinds.push(ApiItemKind.Property)
        break
      case ApiItemKind.Interface:
        allowedKinds.push(ApiItemKind.ConstructSignature)
        allowedKinds.push(ApiItemKind.MethodSignature)
        allowedKinds.push(ApiItemKind.PropertySignature)
        break
    }
    if (!allowedKinds.includes(node.kind)) {
      return
    }

    let navigationTitle = `${node.displayName}`
    let pageTitle = `${node.getScopedNameWithinPackage()}`
    switch (node.kind) {
      case ApiItemKind.EntryPoint:
        navigationTitle = pageTitle = [
          node.parent?.displayName,
          node.displayName,
        ]
          .filter(Boolean)
          .join('/')
        break
    }
    const pageInfo: PageInfo = {
      navigationTitle: navigationTitle,
      pageTitle: pageTitle,
      item: node,
      pageSortKey: node.canonicalReference.toString(),
      parentPath: parentPath,
    }
    pageInfos.push(pageInfo)
    const nextParentPath = [...parentPath, node]
    node.members.forEach((member) => visit(member, node.kind, nextParentPath))
  }
  visit(model.packages[0].entryPoints[0])
  pageInfos.sort((a, b) => a.pageSortKey.localeCompare(b.pageSortKey))

  const slugGenerator = new SlugGenerator()
  const pages = pageInfos.map((pageInfo): Page => {
    return {
      info: pageInfo,
      slug: slugGenerator.generateSlug(pageInfo),
    }
  })
  return new DocPages(pages)
}

class SlugGenerator {
  used = new Set<string>()
  generateSlug(pageInfo: PageInfo): string {
    const candidate = this.generateSlugCandidates(pageInfo)
    for (;;) {
      const name = candidate.next().value as string
      if (!this.used.has(name)) {
        this.used.add(name)
        return name
      }
    }
  }
  *generateSlugCandidates(pageInfo: PageInfo) {
    const scopedName = pageInfo.item.getScopedNameWithinPackage()
    let slugifiedName = scopedName.replace(/[^a-zA-Z0-9_.]/g, '')
    yield slugifiedName
    for (let i = 2; ; i++) {
      yield `${slugifiedName}_${i}`
    }
  }
}

class DocPages {
  private pages: Page[]
  private parentSlugMap = new Map<string, string>()
  constructor(pages: Page[]) {
    this.pages = pages
    for (const page of pages) {
      if (page.info.parentPath.length > 0) {
        const parentApiItem =
          page.info.parentPath[page.info.parentPath.length - 1]
        const parentPage = pages.find((p) => p.info.item === parentApiItem)
        if (parentPage) {
          this.parentSlugMap.set(page.slug, parentPage.slug)
        }
      }
    }
  }
  getPage(slug: string) {
    return this.pages.find((page) => page.slug === slug)
  }
  getNavigation(): DocPageNavigationItem[] {
    const navigationItems: DocPageNavigationItem[] = []
    const slugToNavigationMap = new Map<string, DocPageNavigationItem>()
    for (const page of this.pages) {
      const navigationItem: DocPageNavigationItem = {
        title: page.info.navigationTitle,
        slug: page.slug,
        kind: page.info.item.kind,
        children: [],
      }
      slugToNavigationMap.set(page.slug, navigationItem)
    }
    for (const page of this.pages) {
      const navigationItem = slugToNavigationMap.get(page.slug)
      if (!navigationItem) continue
      const parentSlug = this.parentSlugMap.get(page.slug)
      const parentNavigationItem =
        parentSlug != undefined
          ? slugToNavigationMap.get(parentSlug)
          : undefined
      if (parentNavigationItem) {
        parentNavigationItem.children.push(navigationItem)
      } else {
        navigationItems.push(navigationItem)
      }
    }
    return navigationItems
  }
}

export type DocPageNavigationItem = {
  title: string
  slug: string
  kind: DocItemKind
  children: DocPageNavigationItem[]
}

export type DocItemKind = `${ApiItemKind}`
