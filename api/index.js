const { createRequestHandler } = require('@remix-run/vercel')

// ???
require('@microsoft/tsdoc')
require('@microsoft/api-extractor-model')

module.exports = createRequestHandler({
  build: require('./_build'),
})
