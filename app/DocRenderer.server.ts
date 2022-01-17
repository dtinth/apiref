import {
  ApiDeclaredItem,
  ApiDocumentedItem,
  ApiEnum,
  ApiEnumMember,
  ApiItem,
  ApiItemKind,
  ApiMethod,
  ApiModel,
  ApiOptionalMixin,
  ApiParameterListMixin,
  ApiProperty,
  ApiPropertyItem,
  ApiReturnTypeMixin,
  ApiStaticMixin,
  Excerpt,
} from '@microsoft/api-extractor-model'
import {
  DocCodeSpan,
  DocFencedCode,
  DocLinkTag,
  DocNode,
  DocNodeContainer,
  DocParagraph,
  DocPlainText,
  DocSection,
  StandardTags,
} from '@microsoft/tsdoc'
import { isStatic, LinkGenerator, Page } from './DocModel.server'
import {
  DocViewProps,
  DocViewTable,
  DocViewTableRow,
  RenderedTsdocNode,
} from './DocView'
import { getHighlighter, Highlighter, IThemedToken } from 'shiki'
import { groupBy, partition } from 'lodash'

type DocRenderContext = {
  apiModel: ApiModel
  linkGenerator: LinkGenerator
}

type TsdocRenderContext = DocRenderContext & {
  apiItem: ApiItem
  renderCode: (code: string) => RenderedTsdocNode
}

export async function renderDocPage(
  page: Page,
  context: DocRenderContext,
): Promise<DocViewProps> {
  const highlighter = await getHighlighter({
    theme: 'one-dark-pro',
    langs: ['typescript'],
  })
  const renderCode = (code: string): RenderedTsdocNode => ({
    kind: 'CodeSpan',
    text: code,
    tokens: highlighter.codeToThemedTokens(code, 'typescript'),
  })
  const apiItem = page.info.item
  const tsdocItem =
    page.info.item.kind === ApiItemKind.EntryPoint
      ? page.info.item.parent
      : page.info.item
  const tsdocRenderContext: TsdocRenderContext = {
    ...context,
    apiItem,
    renderCode,
  }

  let summary: RenderedTsdocNode | undefined = undefined
  let remarks: RenderedTsdocNode | undefined = undefined
  let signature: DocViewProps['signature'] = undefined
  let examples: RenderedTsdocNode[] = []

  // TODO: Breadcrumb

  // TODO: Deprecated block

  if (tsdocItem instanceof ApiDocumentedItem) {
    const tsdocComment = tsdocItem.tsdocComment
    if (tsdocComment) {
      // Summary
      summary = renderDocNode(tsdocComment.summarySection, tsdocRenderContext)

      // Remarks
      if (tsdocComment.remarksBlock) {
        remarks = renderDocNode(
          tsdocComment.remarksBlock.content,
          tsdocRenderContext,
        )
      }

      // Examples
      for (const block of tsdocComment.customBlocks) {
        if (
          block.blockTag.tagNameWithUpperCase ===
          StandardTags.example.tagNameWithUpperCase
        ) {
          const rendered = renderDocNode(block.content, tsdocRenderContext)
          if (rendered) {
            examples.push(rendered)
          }
        }
      }
    }
  }

  const renderLinkToReference = (
    canonicalReference: string,
    text: string,
  ): RenderedTsdocNode => {
    const link = context.linkGenerator.linkToReference(canonicalReference)
    if (link) {
      return { kind: 'RouteLink', to: link, text: text }
    } else {
      return { kind: 'PlainText', text: text }
    }
  }
  const renderExcerpt = (excerpt: Excerpt): RenderedTsdocNode => {
    return {
      kind: 'Span',
      nodes: excerpt.spannedTokens.map((token) => {
        const canonicalReference = token.canonicalReference?.toString()
        const link = context.linkGenerator.linkToReference(canonicalReference)
        if (link) {
          return { kind: 'RouteLink', to: link, text: token.text }
        } else {
          return { kind: 'PlainText', text: token.text }
        }
      }),
    }
  }

  if (apiItem instanceof ApiDeclaredItem) {
    // Signature
    const code = apiItem.getExcerptWithModifiers()
    if (code.trim()) {
      signature = {
        text: code,
        tokens: highlighter.codeToThemedTokens(code, 'typescript'),
      }
    }
  }

  // TODO: Extends for class
  // TODO: Implements for class
  // TODO: Extends for interface
  // TODO: Referenced types type alias

  // TODO: Decorators

  const renderDescription = (apiItem: ApiItem): RenderedTsdocNode => {
    // TODO: Beta
    // TODO: Optional
    const parts: RenderedTsdocNode[] = []
    if (apiItem instanceof ApiDocumentedItem) {
      const summary = getFirstParagraph(apiItem.tsdocComment?.summarySection)
      if (summary) {
        parts.push(...renderDocChildren(summary, tsdocRenderContext))
      }
    }
    return { kind: 'Span', nodes: parts }
  }

  const tables: DocViewTable[] = []

  const membersByKind = groupBy(apiItem.members, (m) => m.kind)
  const getMembersByKind = <T extends ApiItem = ApiItem>(
    kind: ApiItemKind,
  ): T[] => {
    return (membersByKind[kind] || []) as unknown as T[]
  }
  type Column<T extends ApiItem> = {
    header: string
    render: (member: T) => RenderedTsdocNode
  }
  const addMemberTable = <T extends ApiItem = ApiItem>(
    members: T[] | undefined,
    sectionTitle: string,
    headerTitle: string,
    extraColumns: Column<T>[] = [],
  ) => {
    if (!members?.length) return
    tables.push({
      sectionTitle,
      headerTitles: [
        headerTitle,
        ...extraColumns.map((c) => c.header),
        'Description',
      ],
      rows: members.map((m) => {
        let text = m.displayName
        let beforeText = ''
        let afterText = ''
        if (m instanceof ApiProperty || m instanceof ApiMethod) {
          if (ApiStaticMixin.isBaseClassOf(m) && m.isStatic) {
            beforeText = `static ${beforeText}`
          }
        }
        if (ApiOptionalMixin.isBaseClassOf(m) && m.isOptional) {
          afterText += `?`
        }
        if (ApiParameterListMixin.isBaseClassOf(m)) {
          afterText += `(${m.parameters.map((p) => p.name).join(', ')})`
        }
        return {
          cells: [
            {
              kind: 'Nowrap',
              nodes: [
                { kind: 'PlainText', text: beforeText },
                renderLinkToReference(m.canonicalReference.toString(), text),
                { kind: 'PlainText', text: afterText },
              ],
            },
            ...extraColumns.map((c) => c.render(m)),
            renderDescription(m),
          ],
        }
      }),
    })
  }
  const addMemberTableByKind = <T extends ApiItem = ApiItem>(
    kind: ApiItemKind,
    sectionTitle: string,
    headerTitle: string,
    extraColumns: Column<T>[] = [],
  ) => {
    addMemberTable(
      getMembersByKind<T>(kind),
      sectionTitle,
      headerTitle,
      extraColumns,
    )
  }
  const typeColumn: Column<ApiPropertyItem> = {
    header: 'Type',
    render: (m) => {
      return renderExcerpt(m.propertyTypeExcerpt)
    },
  }

  switch (apiItem.kind) {
    case ApiItemKind.Constructor:
    case ApiItemKind.ConstructSignature:
    case ApiItemKind.Method:
    case ApiItemKind.MethodSignature:
    case ApiItemKind.Function: {
      const rows: DocViewTableRow[] = []
      if (ApiParameterListMixin.isBaseClassOf(apiItem)) {
        // Function => Parameters
        for (const apiParameter of apiItem.parameters) {
          rows.push({
            cells: [
              { kind: 'PlainText', text: apiParameter.name },
              renderExcerpt(apiParameter.parameterTypeExcerpt),
              renderDocNode(
                apiParameter.tsdocParamBlock?.content,
                tsdocRenderContext,
              ),
            ],
          })
        }

        // Function => Returns
        if (ApiReturnTypeMixin.isBaseClassOf(apiItem)) {
          const returnTypeExcerpt = apiItem.returnTypeExcerpt
          rows.push({
            cells: [
              {
                kind: 'EmphasisSpan',
                nodes: [{ kind: 'PlainText', text: '(Returns)' }],
                bold: true,
              },
              renderExcerpt(returnTypeExcerpt),
              apiItem instanceof ApiDocumentedItem &&
              apiItem.tsdocComment?.returnsBlock
                ? renderDocNode(
                    apiItem.tsdocComment.returnsBlock.content,
                    tsdocRenderContext,
                  )
                : undefined,
            ],
          })
        }

        // TODO: Function => Throws

        tables.push({
          sectionTitle: 'Parameters',
          headerTitles: ['Parameter', 'Type', 'Description'],
          rows: rows,
        })
      }
      break
    }
    case ApiItemKind.Enum: {
      addMemberTableByKind<ApiEnumMember>(
        ApiItemKind.EnumMember,
        'Enumeration Members',
        'Member',
        [
          {
            header: 'Value',
            render: (m) => renderCode(m.initializerExcerpt.text),
          },
        ],
      )
      break
    }
    case ApiItemKind.EntryPoint:
    case ApiItemKind.Package:
    case ApiItemKind.Namespace: {
      addMemberTableByKind(ApiItemKind.Class, 'Classes', 'Class')
      addMemberTableByKind(ApiItemKind.Enum, 'Enumerations', 'Enumeration')
      addMemberTableByKind(ApiItemKind.Function, 'Functions', 'Function')
      addMemberTableByKind(ApiItemKind.Interface, 'Interfaces', 'Interface')
      addMemberTableByKind(ApiItemKind.Namespace, 'Namespaces', 'Namespace')
      addMemberTableByKind(ApiItemKind.Variable, 'Variables', 'Variable')
      addMemberTableByKind(ApiItemKind.TypeAlias, 'Type Aliases', 'Type Alias')
      break
    }
    case ApiItemKind.Class: {
      const [events, properties] = partition(
        getMembersByKind<ApiPropertyItem>(ApiItemKind.Property),
        (m) => m.isEventProperty,
      )
      addMemberTableByKind(
        ApiItemKind.Constructor,
        'Constructors',
        'Constructor',
      )
      addMemberTable(properties, 'Properties', 'Property', [typeColumn])
      addMemberTable(events, 'Events', 'event', [typeColumn])
      addMemberTableByKind(ApiItemKind.Method, 'Methods', 'Method')
      break
    }
    case ApiItemKind.Interface: {
      const [events, properties] = partition(
        getMembersByKind<ApiPropertyItem>(ApiItemKind.PropertySignature),
        (m) => m.isEventProperty,
      )
      addMemberTableByKind(
        ApiItemKind.ConstructSignature,
        'Constructors',
        'Constructor',
      )
      addMemberTable(properties, 'Properties', 'Property', [typeColumn])
      addMemberTable(events, 'Events', 'event', [typeColumn])
      addMemberTableByKind(ApiItemKind.MethodSignature, 'Methods', 'Method')
      break
    }
  }

  return {
    title: page.info.pageTitle,
    kind: page.info.item.kind,
    summary,
    signature,
    remarks,
    examples,
    tables,
    static: isStatic(page.info.item),
  }
}

function renderDocNode(
  node: DocNode | undefined,
  context: TsdocRenderContext,
): RenderedTsdocNode | undefined {
  if (!node) {
    return undefined
  }
  switch (node.kind) {
    case 'Section': {
      const section = node as DocSection
      return { kind: 'Section', nodes: renderDocChildren(section, context) }
    }
    case 'Paragraph': {
      const paragraph = node as DocParagraph
      return { kind: 'Paragraph', nodes: renderDocChildren(paragraph, context) }
    }
    case 'PlainText': {
      const text = (node as DocPlainText).text
      return { kind: 'PlainText', text }
    }
    case 'SoftBreak': {
      return { kind: 'SoftBreak' }
    }
    case 'LinkTag': {
      const linkTag = node as DocLinkTag
      if (linkTag.codeDestination) {
        const result = context.apiModel.resolveDeclarationReference(
          linkTag.codeDestination,
          context.apiItem,
        )
        if (result.resolvedApiItem) {
          const { resolvedApiItem } = result
          const text =
            linkTag.linkText || resolvedApiItem.getScopedNameWithinPackage()
          const to = context.linkGenerator.linkTo(resolvedApiItem)
          return to
            ? { kind: 'RouteLink', to, text }
            : { kind: 'PlainText', text }
        }
      } else if (linkTag.urlDestination) {
        const text = linkTag.linkText || linkTag.urlDestination
        return { kind: 'LinkTag', text, url: linkTag.urlDestination }
      } else if (linkTag.linkText) {
        return { kind: 'PlainText', text: linkTag.linkText }
      }
    }
    case 'CodeSpan': {
      const codeSpan = node as DocCodeSpan
      return { kind: 'CodeSpan', text: codeSpan.code }
    }
    case 'FencedCode': {
      const fencedCode = node as DocFencedCode
      return {
        kind: 'FencedCode',
        code: context.renderCode(fencedCode.code),
      }
    }
  }
  console.warn(`Unhandled DocNode kind: ${node.kind}`)
  return undefined
}

function renderDocChildren(
  nodes: DocNodeContainer,
  context: TsdocRenderContext,
): RenderedTsdocNode[] {
  return nodes.getChildNodes().flatMap((node) => {
    const rendered = renderDocNode(node, context)
    return rendered ? [rendered] : []
  })
}

function getFirstParagraph(
  section: DocSection | undefined,
): DocParagraph | undefined {
  if (!section) return undefined
  const firstParagraph = section
    .getChildNodes()
    .find((node) => node.kind === 'Paragraph')
  return firstParagraph as DocParagraph | undefined
}
