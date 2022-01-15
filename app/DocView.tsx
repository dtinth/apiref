import { Fragment, ReactNode } from 'react'

export type DocViewProps = {
  title: string
  summary?: RenderedTsdocNode
}

export function DocView(props: DocViewProps) {
  return (
    <>
      <h1 className="text-3xl">{props.title}</h1>
      {tsdocToReactNode(props.summary)}
    </>
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
