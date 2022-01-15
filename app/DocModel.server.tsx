import {
  ApiDocumentedItem,
  ApiItem,
  ApiItemKind,
  ApiModel,
  ApiReleaseTagMixin,
  ReleaseTag,
} from '@microsoft/api-extractor-model'
import { writeFileSync, mkdirSync } from 'fs'
import fixture from '../fixtures/node-core-library.api.json'
import { once, sortBy } from 'lodash'
import { DocComment } from '@microsoft/tsdoc'

const loadApiModel = once(() => {
  const apiModel = new ApiModel()
  mkdirSync('/tmp/docfixtures/', { recursive: true })
  writeFileSync(
    '/tmp/docfixtures/node-core-library.api.json',
    JSON.stringify(fixture, null, 2),
  )
  apiModel.loadPackage('/tmp/docfixtures/node-core-library.api.json')
  return apiModel
})

export async function getApiModel(packageIdentifier: string) {
  const apiModel = loadApiModel()
  const pages = generatePages(apiModel)
  const linkGenerator = new LinkGenerator(pages, `/${packageIdentifier}`)
  return { apiModel, pages, linkGenerator }
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

  const slugGenerator = new PageSlugGenerator()
  const pages = pageInfos.map((pageInfo): Page => {
    return {
      info: pageInfo,
      slug: slugGenerator.generateSlug(pageInfo),
    }
  })
  return new DocPages(pages)
}

class PageSlugGenerator {
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

class HashSlugGenerator {
  used = new Set<string>()
  generateSlug(inputName: string): string {
    const candidate = this.generateSlugCandidates(inputName)
    for (;;) {
      const name = candidate.next().value as string
      if (!this.used.has(name)) {
        this.used.add(name)
        return name
      }
    }
  }
  *generateSlugCandidates(inputName: string) {
    let slugifiedName = inputName.replace(/[^a-zA-Z0-9_]/g, '')
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
  getAllPages() {
    return this.pages
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
        ...decorateNavigationItems(page.info.item),
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

function decorateNavigationItems(item: ApiItem) {
  if (!(item instanceof ApiDocumentedItem)) {
    return {}
  }
  const tsdocComment: DocComment | undefined = item.tsdocComment
  if (!tsdocComment) {
    return {}
  }
  const output: Pick<DocPageNavigationItem, 'beta' | 'deprecated'> = {}
  if (tsdocComment.deprecatedBlock) {
    output.deprecated = true
  }
  if (
    ApiReleaseTagMixin.isBaseClassOf(item) &&
    item.releaseTag === ReleaseTag.Beta
  ) {
    output.beta = true
  }
  return output
}

export type DocPageNavigationItem = {
  title: string
  slug: string
  kind: DocItemKind
  children: DocPageNavigationItem[]
  beta?: boolean
  deprecated?: boolean
}

export type DocItemKind = `${ApiItemKind}`

export class LinkGenerator {
  private canonicalReferenceToRouteMap = new Map<string, string>()

  constructor(pages: DocPages, prefix: string) {
    for (const page of pages.getAllPages()) {
      const apiItem = page.info.item
      const canonicalReference = apiItem.canonicalReference.toString()
      const base = `${prefix}/${page.slug}`
      this.canonicalReferenceToRouteMap.set(canonicalReference, base)
    }

    for (const page of pages.getAllPages()) {
      const apiItem = page.info.item
      const base = `${prefix}/${page.slug}`
      const linkableItems: ApiItem[] = []
      const visit = (item: ApiItem) => {
        const canonicalReference = item.canonicalReference.toString()
        if (this.canonicalReferenceToRouteMap.has(canonicalReference)) {
          return
        }
        linkableItems.push(item)
        visitMembers(item)
      }
      const visitMembers = (item: ApiItem) => {
        for (const member of item.members) {
          visit(member)
        }
      }
      visitMembers(apiItem)
      linkableItems.sort((a, b) => a.getSortKey().localeCompare(b.getSortKey()))
      const slugGenerator = new HashSlugGenerator()
      for (const item of linkableItems) {
        const slug = slugGenerator.generateSlug(item.displayName)
        const canonicalReference = item.canonicalReference.toString()
        if (!this.canonicalReferenceToRouteMap.has(canonicalReference)) {
          this.canonicalReferenceToRouteMap.set(
            canonicalReference,
            `${base}#${slug}`,
          )
        }
      }
    }
  }

  linkTo(apiItem: ApiItem): string | undefined {
    const canonicalReference = apiItem.canonicalReference.toString()
    return this.linkToReference(canonicalReference)
  }

  linkToReference(canonicalReference: string | undefined): string | undefined {
    return canonicalReference
      ? this.canonicalReferenceToRouteMap.get(canonicalReference)
      : undefined
  }
}
