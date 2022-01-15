import {
  ApiDocumentedItem,
  ApiItem,
  ApiModel,
} from '@microsoft/api-extractor-model'
import {
  DocLinkTag,
  DocNode,
  DocNodeContainer,
  DocParagraph,
  DocPlainText,
  DocSection,
} from '@microsoft/tsdoc'
import { Page } from './DocModel.server'
import { DocViewProps, RenderedTsdocNode } from './DocView'

type DocRenderContext = {
  apiModel: ApiModel
}

type TsdocRenderContext = DocRenderContext & {
  apiItem: ApiItem
}

export function renderDocPage(
  page: Page,
  context: DocRenderContext,
): DocViewProps {
  const apiItem = page.info.item
  const tsdocRenderContext: TsdocRenderContext = { ...context, apiItem }
  let summary: RenderedTsdocNode | undefined = undefined

  // TODO: Breadcrumb

  // TODO: Deprecated block

  // Summary
  if (apiItem instanceof ApiDocumentedItem) {
    const tsdocComment = apiItem.tsdocComment
    if (tsdocComment) {
      summary = renderDocNode(tsdocComment.summarySection, tsdocRenderContext)
    }
  }

  // TODO: Excerpt

  // TODO: Extends for class
  // TODO: Implements for class
  // TODO: Extends for interface
  // TODO: Referenced types type alias

  // TODO: Decorators

  // TODO: Remarks

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
    summary,
  }
}

function renderDocNode(
  node: DocNode,
  context: TsdocRenderContext,
): RenderedTsdocNode | undefined {
  console.log(node.kind)
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
          // TODO: return { kind: 'LinkTag', text, url: '#' }
          return { kind: 'PlainText', text }
        }
      } else if (linkTag.urlDestination) {
        const text = linkTag.linkText || linkTag.urlDestination
        return { kind: 'LinkTag', text, url: linkTag.urlDestination }
      } else if (linkTag.linkText) {
        return { kind: 'PlainText', text: linkTag.linkText }
      }
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
