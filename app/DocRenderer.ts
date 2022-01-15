import {
  ApiDeclaredItem,
  ApiDocumentedItem,
  ApiItem,
  ApiItemKind,
  ApiModel,
  ApiParameterListMixin,
  ApiReturnTypeMixin,
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
import { LinkGenerator, Page } from './DocModel.server'
import {
  DocViewProps,
  DocViewTable,
  DocViewTableRow,
  RenderedTsdocNode,
} from './DocView'

type DocRenderContext = {
  apiModel: ApiModel
  linkGenerator: LinkGenerator
}

type TsdocRenderContext = DocRenderContext & {
  apiItem: ApiItem
}

export function renderDocPage(
  page: Page,
  context: DocRenderContext,
): DocViewProps {
  const apiItem = page.info.item
  const tsdocItem =
    page.info.item.kind === ApiItemKind.EntryPoint
      ? page.info.item.parent
      : page.info.item
  const tsdocRenderContext: TsdocRenderContext = { ...context, apiItem }

  let summary: RenderedTsdocNode | undefined = undefined
  let remarks: RenderedTsdocNode | undefined = undefined
  let signature: string | undefined = undefined
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
    signature = apiItem.getExcerptWithModifiers()
  }

  // TODO: Extends for class
  // TODO: Implements for class
  // TODO: Extends for interface
  // TODO: Referenced types type alias

  // TODO: Decorators

  const tables: DocViewTable[] = []
  switch (apiItem.kind) {
    case ApiItemKind.Constructor:
    case ApiItemKind.ConstructSignature:
    case ApiItemKind.Method:
    case ApiItemKind.MethodSignature:
    case ApiItemKind.Function: {
      const rows: DocViewTableRow[] = []
      if (ApiParameterListMixin.isBaseClassOf(apiItem)) {
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

        tables.push({
          sectionTitle: 'Parameters',
          headerTitles: ['Parameter', 'Type', 'Description'],
          rows: rows,
        })
      }
      break
    }
  }
  // TODO: Class => Events
  // TODO: Class => Constructors
  // TODO: Class => Properties
  // TODO: Class => Methods
  // TODO: Enum => Members
  // TODO: Interface => Events
  // TODO: Interface => Properties
  // TODO: Interface => Methods
  // TODO: Function => Parameters
  // TODO: Function => Throws
  // TODO: Namespace => Classes
  // TODO: Namespace => Enumerations
  // TODO: Namespace => Functions
  // TODO: Namespace => Interfaces
  // TODO: Namespace => Namespaces
  // TODO: Namespace => Variables
  // TODO: Namespace => TypeAliases
  // TODO: Root => Entrypoints

  return {
    title: page.info.pageTitle,
    kind: page.info.item.kind,
    summary,
    signature,
    remarks,
    examples,
    tables,
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
      return { kind: 'Section', nodes: renderDocNodes(section, context) }
    }
    case 'Paragraph': {
      const paragraph = node as DocParagraph
      return { kind: 'Paragraph', nodes: renderDocNodes(paragraph, context) }
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
      return { kind: 'FencedCode', text: fencedCode.code }
    }
  }
  console.warn(`Unhandled DocNode kind: ${node.kind}`)
  return undefined
}

function renderDocNodes(
  nodes: DocNodeContainer,
  context: TsdocRenderContext,
): RenderedTsdocNode[] {
  return nodes.getChildNodes().flatMap((node) => {
    const rendered = renderDocNode(node, context)
    return rendered ? [rendered] : []
  })
}
