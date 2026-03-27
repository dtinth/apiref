import { expect, test } from 'vitest'
import { Diagnostic } from './DiagnosticWriter'
import { getApiModel } from './DocModel.server'
import { renderDocPage, serializeExcerptTokenText } from './DocRenderer.server'
import { RenderedTsdocNode } from './DocView'

test('ee', async () => {
  const model = await getApiModel(
    'fixtures:node-core-library',
    new Diagnostic(),
  )
  expect(model).toBeTruthy()
})

test('serializes multiline excerpt tokens from fixture types onto one line', async () => {
  const model = await getApiModel(
    'fixtures:node-core-library',
    new Diagnostic(),
  )
  const page = model.pages
    .getAllPages()
    .find(
      (candidate) =>
        candidate.info.item.canonicalReference.toString() ===
        '@rushstack/node-core-library!Enum.getValueByKey:member(1)',
    )
  expect(page).toBeTruthy()
  if (!page) {
    throw new Error('Expected Enum.getValueByKey page')
  }

  const doc = await renderDocPage(page, model)
  const parameterTable = doc.tables.find((table) => table.sectionTitle === 'Parameters')
  expect(parameterTable).toBeTruthy()
  if (!parameterTable) {
    throw new Error('Expected parameter table')
  }

  const enumObjectRow = parameterTable.rows.find(
    (row) => getRenderedText(row.cells[0]) === 'enumObject',
  )
  expect(enumObjectRow).toBeTruthy()
  expect(getRenderedText(enumObjectRow?.cells[1])).toBe(
    '{ [key: string]: TEnumValue | string; [key: number]: TEnumValue | string; }',
  )
})

test('serializes mapped type text onto one line', () => {
  expect(
    serializeExcerptTokenText('{\n  [K in keyof T]?: T[K];\n}'),
  ).toBe('{ [K in keyof T]?: T[K]; }')
})

function getRenderedText(node: RenderedTsdocNode | undefined): string {
  if (!node) {
    return ''
  }
  switch (node.kind) {
    case 'Paragraph':
    case 'Section':
    case 'Span':
    case 'Nowrap':
    case 'EmphasisSpan':
      return node.nodes.map((child) => getRenderedText(child)).join('')
    case 'PlainText':
    case 'CodeSpan':
      return node.text
    case 'SoftBreak':
      return '\n'
    case 'LinkTag':
    case 'RouteLink':
      return node.text
    case 'FencedCode':
      return getRenderedText(node.code)
  }
}
