import { Fragment, ReactNode } from 'react'
import { Link } from 'remix'
import type { IThemedToken } from 'shiki'
import { DocItemKind } from './DocModel.server'
import { KindIcon } from './KindIcon'
import { Prose } from './Prose'
import { Section } from './Section'

export type DocViewProps = {
  title: string
  kind: DocItemKind
  static?: boolean
  summary?: RenderedTsdocNode
  remarks?: RenderedTsdocNode
  examples?: RenderedTsdocNode[]
  tables: DocViewTable[]
  signature?: { text: string; tokens: IThemedToken[][] }
}

export function DocView(props: DocViewProps) {
  return (
    <Prose>
      {
        // TODO: Breadcrumb
      }
      <h1 className="text-xl md:text-3xl">
        <KindIcon kind={props.kind} static={props.static} />
        {props.title} &nbsp;
        <small className="text-lg font-normal text-#8b8685">
          {props.static ? 'Static ' : ''}
          {props.kind}
        </small>
      </h1>
      {
        // TODO: Deprecated block
      }
      {!!props.summary && (
        <div className="prose-lg md:prose-xl">
          {tsdocToReactNode(props.summary)}
        </div>
      )}

      {!!props.signature && (
        <Section title="Signature">
          <CodeBlock>
            <code>{renderCode(props.signature.tokens)}</code>
          </CodeBlock>
        </Section>
      )}

      {
        // TODO: Extends for class
        // TODO: Implements for class
        // TODO: Extends for interface
        // TODO: Referenced types type alias
        // TODO: Decorators
      }
      {!!props.remarks && (
        <Section title="Remarks">{tsdocToReactNode(props.remarks)}</Section>
      )}
      {!!props.examples &&
        props.examples.map((example, i, array) => (
          <Section
            title={array.length === 1 ? 'Example' : `Example ${i + 1}`}
            key={i}
          >
            {tsdocToReactNode(example)}
          </Section>
        ))}
      {props.tables.map((table, i) => {
        return (
          <Section key={i} title={table.sectionTitle}>
            <table>
              <thead>
                <tr>
                  {table.headerTitles.map((title, j) => (
                    <th key={j}>{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, j) => (
                  <tr key={j}>
                    {row.cells.map((cell, k) => (
                      <td key={k}>{tsdocToReactNode(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )
      })}
    </Prose>
  )
}

export type RenderedTsdocNode =
  | { kind: 'Paragraph'; nodes: RenderedTsdocNode[] }
  | { kind: 'Section'; nodes: RenderedTsdocNode[] }
  | { kind: 'Span'; nodes: RenderedTsdocNode[] }
  | { kind: 'Nowrap'; nodes: RenderedTsdocNode[] }
  | { kind: 'PlainText'; text: string }
  | { kind: 'CodeSpan'; text: string; tokens?: IThemedToken[][] }
  | { kind: 'FencedCode'; code: RenderedTsdocNode }
  | { kind: 'SoftBreak' }
  | { kind: 'LinkTag'; url: string; text: string }
  | { kind: 'RouteLink'; to: string; text: string; targetKind?: DocItemKind }
  | {
      kind: 'EmphasisSpan'
      nodes: RenderedTsdocNode[]
      bold?: boolean
      italic?: boolean
    }

export type DocViewTable = {
  sectionTitle: string
  headerTitles: string[]
  rows: DocViewTableRow[]
}

export type DocViewTableRow = {
  cells: (RenderedTsdocNode | undefined)[]
}

export function tsdocToReactNode(node?: RenderedTsdocNode): ReactNode {
  if (!node) {
    return null
  }
  switch (node.kind) {
    case 'Paragraph':
      return <p>{tsdocChildren(node.nodes)}</p>
    case 'Section':
      return <section>{tsdocChildren(node.nodes)}</section>
    case 'Span':
      return <>{tsdocChildren(node.nodes)}</>
    case 'Nowrap':
      return (
        <span className="whitespace-nowrap">{tsdocChildren(node.nodes)}</span>
      )
    case 'PlainText':
      return node.text
    case 'SoftBreak':
      return ''
    case 'LinkTag':
      return <a href={node.url}>{node.text}</a>
    case 'RouteLink':
      return <Link to={node.to}>{node.text}</Link>
    case 'CodeSpan':
      return <code>{node.tokens ? renderCode(node.tokens) : node.text}</code>
    case 'FencedCode':
      return <CodeBlock>{tsdocToReactNode(node.code)}</CodeBlock>
    case 'EmphasisSpan':
      return emphasize(tsdocChildren(node.nodes), node.bold, node.italic)
  }
}

function tsdocChildren(nodes: RenderedTsdocNode[]): ReactNode[] {
  return nodes.map((n, i) => <Fragment key={i}>{tsdocToReactNode(n)}</Fragment>)
}

function emphasize(
  children: ReactNode,
  bold?: boolean,
  italic?: boolean,
): ReactNode {
  if (bold && italic) {
    return (
      <strong>
        <em>{children}</em>
      </strong>
    )
  } else if (bold) {
    return <strong>{children}</strong>
  } else if (italic) {
    return <em>{children}</em>
  } else {
    return children
  }
}

function CodeBlock(props: { children: ReactNode }) {
  return <pre>{props.children}</pre>
}

function renderCode(tokens: IThemedToken[][]): ReactNode {
  return tokens.map((line, i) => (
    <Fragment key={i}>
      {i > 0 ? '\n' : ''}
      {line.map((token, j) => (
        <span key={j} style={{ color: token.color }}>
          {token.content}
        </span>
      ))}
    </Fragment>
  ))
}
