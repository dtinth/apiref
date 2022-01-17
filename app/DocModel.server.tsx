import {
  ApiDocumentedItem,
  ApiItem,
  ApiItemKind,
  ApiMethod,
  ApiModel,
  ApiOptionalMixin,
  ApiProperty,
  ApiReleaseTagMixin,
  ApiStaticMixin,
  ReleaseTag,
} from '@microsoft/api-extractor-model'
import { mkdirSync, writeFileSync } from 'fs'
import pMemoize from 'p-memoize'
import axios from 'axios'
import { resolve } from 'path'
import { Diagnostic, DiagnosticWriter } from './DiagnosticWriter'

export type PackageInfo = {
  name: string
  version: string
  homepage?: string
}

type DocJsonInfo = {
  filePath: string
  packageInfo?: PackageInfo
}

async function time<T>(
  diagnostic: DiagnosticWriter,
  message: string,
  f: () => Promise<T>,
) {
  const start = Date.now()
  let failed = false
  try {
    return await f()
  } catch (e) {
    failed = true
    throw e
  } finally {
    const end = Date.now()
    diagnostic.write(
      `${message} ${failed ? 'FAILED' : 'succeeded'} in ${end - start}ms`,
    )
  }
}

async function fetchDocJson(
  packageIdentifier: string,
  diagnostic: DiagnosticWriter,
): Promise<DocJsonInfo> {
  if (process.env.APIREF_LOCAL) {
    if (packageIdentifier === 'apiref:local') {
      return { filePath: process.env.APIREF_LOCAL }
    }
    throw new Error(`Only apiref:local is supported in local mode`)
  }

  if (packageIdentifier === 'fixtures:node-core-library') {
    return {
      filePath: require.resolve('../../fixtures/node-core-library.api.json'),
      packageInfo: {
        name: '@rushstack/node-core-library',
        version: '3.45.0',
        homepage: 'https://github.com/microsoft/rushstack#readme',
      },
    }
  }

  const targetFolder = `/tmp/apirefcache/docmodel/v1-${packageIdentifier}`

  const packageJsonUrl = `https://unpkg.com/${packageIdentifier}/package.json`
  const packageJsonResponse = await time(
    diagnostic,
    `Fetching package.json file from "${packageJsonUrl}"`,
    () => axios.get(packageJsonUrl),
  )
  const packageJsonData = packageJsonResponse.data
  const docModelPath = packageJsonData.docModel
  if (!packageJsonData.docModel) {
    diagnostic.write(`No docModel found in package.json`)
    throw new Error(`No docModel found in package.json`)
  }

  const analyticsPromise = logAnalyticsEvent('package_fetch', {
    package_identifier: packageIdentifier,
    package_name: String(packageJsonData.name),
    resolved_package: String(
      `${packageJsonData.name}@${packageJsonData.version}`,
    ),
  })

  const resolvedDocModelPath = resolve('/', docModelPath)
  const docModelUrl = `https://unpkg.com/${packageIdentifier}${resolvedDocModelPath}`
  const docModelResponse = await time(
    diagnostic,
    `Fetching docModel file from "${docModelUrl}"`,
    () => axios.get(docModelUrl),
  )

  mkdirSync(targetFolder, { recursive: true })
  writeFileSync(
    `${targetFolder}/package.json`,
    JSON.stringify(packageJsonData, null, 2),
  )
  writeFileSync(
    `${targetFolder}/api.json`,
    JSON.stringify(docModelResponse.data, null, 2),
  )
  await analyticsPromise
  return {
    filePath: `${targetFolder}/api.json`,
    packageInfo: {
      name: String(packageJsonData.name),
      version: String(packageJsonData.version),
      homepage: getHomepage(packageJsonData),
    },
  }
}

async function logAnalyticsEvent(
  eventName: string,
  eventParams: Record<string, string>,
) {
  const promises: Promise<any>[] = []
  const analyticsDiag = new Diagnostic()

  if (process.env.GA_MP_API_SECRET) {
    promises.push(
      time(analyticsDiag, `Sending event to Google Analytics`, () =>
        axios
          .post(
            'https://www.google-analytics.com/mp/collect',
            {
              client_id: 'apirefserver',
              events: [{ name: eventName, params: eventParams }],
            },
            {
              params: {
                api_secret: process.env.GA_MP_API_SECRET,
                measurement_id: 'G-5J92C1MDC0',
              },
              timeout: 500,
            },
          )
          .catch((e) => {
            analyticsDiag.write(
              'Unable to send event to Google Analytics: ' + String(e),
            )
          }),
      ),
    )
  }

  if (process.env.AMPLITUDE_API_KEY) {
    promises.push(
      time(analyticsDiag, `Sending event to Amplitude`, () =>
        axios
          .post(
            'https://api.amplitude.com/2/httpapi',
            {
              api_key: process.env.AMPLITUDE_API_KEY,
              events: [
                {
                  user_id: 'apirefserver',
                  device_id: 'apirefserver',
                  event_type: eventName,
                  event_properties: eventParams,
                },
              ],
            },
            { timeout: 500 },
          )
          .catch((e) => {
            analyticsDiag.write(
              'Unable to send event to Amplitude: ' + String(e),
            )
          }),
      ),
    )
  }

  await Promise.all(promises)
}

const doLoadApiModel = async (
  packageIdentifier: string,
  diagnostic: DiagnosticWriter,
) => {
  const apiModel = new ApiModel()
  const docJsonInfo = await fetchDocJson(packageIdentifier, diagnostic)
  await time(
    diagnostic,
    `Reading docModel file from "${docJsonInfo.filePath}"`,
    async () => apiModel.loadPackage(docJsonInfo.filePath),
  )
  return { apiModel, docJsonInfo }
}

const loadApiModel = process.env.APIREF_LOCAL
  ? doLoadApiModel
  : pMemoize(doLoadApiModel)

function getHomepage(packageJsonData: any): string | undefined {
  if (
    typeof packageJsonData.homepage === 'string' &&
    packageJsonData.homepage.match(/^https?:\/\//)
  ) {
    return packageJsonData.homepage
  }
  const repoUrl = packageJsonData.repository?.url
  if (typeof repoUrl === 'string') {
    const m = repoUrl.match(
      /^(https?:\/\/(?:www\.)?github\.com\/.*?)(?:\.git)?$/,
    )
    if (m) return m[1]
  }
  return undefined
}

export async function getApiModel(
  packageIdentifier: string,
  diagnostic: DiagnosticWriter,
) {
  const { apiModel, docJsonInfo } = await loadApiModel(
    packageIdentifier,
    diagnostic,
  )
  const pages = await time(
    diagnostic,
    `Generating navigation tree of "${packageIdentifier}"`,
    async () => generatePages(apiModel),
  )
  const linkGenerator = new LinkGenerator(
    pages,
    `/package/${packageIdentifier}`,
  )
  const { packageInfo } = docJsonInfo
  return { apiModel, pages, linkGenerator, packageInfo }
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
    if (isOptional(node)) {
      navigationTitle += '?'
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
        deprecated: isDeprecated(page.info.item),
        beta: isBeta(page.info.item),
        static: isStatic(page.info.item),
        optional: isOptional(page.info.item),
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

export function isStatic(item: ApiItem) {
  return (
    (item instanceof ApiProperty || item instanceof ApiMethod) &&
    ApiStaticMixin.isBaseClassOf(item) &&
    item.isStatic
  )
}
export function isBeta(item: ApiItem) {
  return (
    ApiReleaseTagMixin.isBaseClassOf(item) &&
    item.releaseTag === ReleaseTag.Beta
  )
}
export function isDeprecated(item: ApiItem) {
  return (
    item instanceof ApiDocumentedItem && !!item.tsdocComment?.deprecatedBlock
  )
}
export function isOptional(item: ApiItem) {
  return ApiOptionalMixin.isBaseClassOf(item) && item.isOptional
}

export type DocPageNavigationItem = {
  title: string
  slug: string
  kind: DocItemKind
  children: DocPageNavigationItem[]
  beta?: boolean
  deprecated?: boolean
  static?: boolean
  optional?: boolean
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
