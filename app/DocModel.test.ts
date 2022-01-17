import { expect, test } from 'vitest'
import { Diagnostic } from './DiagnosticWriter'
import { getApiModel } from './DocModel.server'

test('ee', async () => {
  const model = await getApiModel(
    'fixtures:node-core-library',
    new Diagnostic(),
  )
  expect(model).toBeTruthy()
})
