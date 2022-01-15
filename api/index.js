const { createRequestHandler } = require('@remix-run/vercel')

require('@microsoft/tsdoc')

module.exports = createRequestHandler({
  build: require('./_build'),
})
