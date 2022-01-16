const { createRequestHandler } = require('@remix-run/vercel')

require('./fixtures/node-core-library.api.json')
require('@microsoft/tsdoc/schemas/tsdoc.schema.json')
require('shiki/languages/typescript.tmLanguage.json')
require('shiki/themes/one-dark-pro.json')

module.exports = createRequestHandler({
  build: require('./_build'),
})
