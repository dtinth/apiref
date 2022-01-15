const { createRequestHandler } = require('@remix-run/vercel')

require('@microsoft/tsdoc/schemas/tsdoc.schema.json')

module.exports = createRequestHandler({
  build: require('./_build'),
})
