import { Fragment, ReactNode } from 'react'

export type DocViewProps = {
  title: string
  summary?: RenderedTsdocNode
  remarks?: RenderedTsdocNode
  examples?: RenderedTsdocNode[]
}

export function DocView(props: DocViewProps) {
  return (
    <div className="prose max-w-none">
      {
        // TODO: Breadcrumb
      }
      <h1 className="text-3xl">{props.title}</h1>
      {
        // TODO: Deprecated block
      }
      {!!props.summary && (
        <div className="prose-xl">{tsdocToReactNode(props.summary)}</div>
      )}

      {
        // TODO: Excerpt
        // TODO: Extends for class
        // TODO: Implements for class
        // TODO: Extends for interface
        // TODO: Referenced types type alias
        // TODO: Decorators
      }
      {!!props.remarks && (
        <Section title="Remarks">{tsdocToReactNode(props.remarks)}</Section>
      )}
      {
        // TODO: Examples
      }
      {
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
      }
    </div>
  )
}

export function Section(props: { children: ReactNode; title: string }) {
  return (
    <section>
      <h2>{props.title}</h2>
      <div className="ml-8">{props.children}</div>
    </section>
  )
}

export type RenderedTsdocNode =
  | { kind: 'Paragraph'; nodes: RenderedTsdocNode[] }
  | { kind: 'Section'; nodes: RenderedTsdocNode[] }
  | { kind: 'PlainText'; text: string }
  | { kind: 'CodeSpan'; text: string }
  | { kind: 'FencedCode'; text: string }
  | { kind: 'SoftBreak' }
  | { kind: 'LinkTag'; url: string; text: string }

export function tsdocToReactNode(node?: RenderedTsdocNode): ReactNode {
  if (!node) {
    return null
  }
  switch (node.kind) {
    case 'Paragraph':
      return <p>{tsdocChildren(node.nodes)}</p>
    case 'Section':
      return <section>{tsdocChildren(node.nodes)}</section>
    case 'PlainText':
      return node.text
    case 'SoftBreak':
      return ''
    case 'LinkTag':
      return <a href={node.url}>{node.text}</a>
    case 'CodeSpan':
      return <code>{node.text}</code>
    case 'FencedCode':
      return <pre>{node.text}</pre>
  }
}

function tsdocChildren(nodes: RenderedTsdocNode[]): ReactNode[] {
  return nodes.map((n, i) => <Fragment key={i}>{tsdocToReactNode(n)}</Fragment>)
}
