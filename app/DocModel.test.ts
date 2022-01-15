import { expect, test } from 'vitest'
import { getApiModel } from './DocModel.server'

test('ee', async () => {
  const model = await getApiModel('_fixture')
  expect(model).toBeTruthy()
})
