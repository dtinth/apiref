const { createRequestHandler } = require('@remix-run/vercel')

// Any JSON file used during app runtime must be referenced here
// in order for the Remix app to not crash at runtime on Vercel.
//
// I spent a long time figuring out this workaround.
//
// Here's how it works:
//
// When a Remix app is deployed to Vercel, any file that is not
// statically referenced in the app's source code will be pruned
// from the deployment package.
//
// Since a few Node.js packages do load JSON files dynamically
// (e.g. `@microsoft/tsdoc-config` and `shiki` does this) but did
// not statically reference them, they have been pruned out of
// the `node_modules` folder. (The `node_modules` folder contains
// the dependencies, but the files in there are incomplete.)
//
// This resulted in an app working find locally, but crashes when
// deployed to Vercel.
//
// To add insult to injury, Vercel does not provide any way to
// download the built serverless function package, so I couldn't
// have figured out the above behavior just by looking at the build
// logs.
//
// So how did I figure it out?
//
// I created `app/routes/shell.tsx` which allows running arbitrary
// shell commands on Vercel. (It has been disabled now but the source
// code is still there - go take a look.)
//
// With a Remote Code Execution endpoint, this let me send HTTP
// requests like `GET /shell?cmd=ls+-la+output/server/pages/node_modules`
// to inspect Vercel’s Serverless Function’s runtime.
//
// That's when I noticed that some files were missing.
//
// With that figured out, the workaround looks like this:
//
require('../fixtures/node-core-library.api.json')
require('@microsoft/tsdoc/schemas/tsdoc.schema.json')
require('shiki/languages/typescript.tmLanguage.json')
require('shiki/themes/one-dark-pro.json')

module.exports = createRequestHandler({
  build: require('./_build'),
})
