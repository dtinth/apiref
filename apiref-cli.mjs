#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import express from 'express'
import { createRequestHandler } from '@remix-run/express'
import { getPublicPath, loadBuild } from './apiref-local-loader.cjs'

yargs(hideBin(process.argv))
  .demandCommand()
  .strict()
  .help()
  .command(
    ['$0', 'dev'],
    'Test documentation',
    {
      port: {
        alias: 'p',
        type: 'number',
        default: +process.env.PORT || 3000,
        demand: true,
      },
      input: {
        alias: 'i',
        type: 'string',
        demand: true,
      },
    },
    (argv) => {
      const app = express()
      process.env.NODE_ENV = 'production'
      process.env.APIREF_LOCAL = argv.input
      app.use(express.static(getPublicPath()))
      app.all(
        '*',
        createRequestHandler({
          build: loadBuild(),
          getLoadContext(_req, _res) {
            return {}
          },
        }),
      )
      app.listen(argv.port, () => {
        console.log(`Listening on port ${argv.port}`)
      })
    },
  )
  .parse()
