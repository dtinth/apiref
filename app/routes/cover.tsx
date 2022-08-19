import { LoaderFunction } from '@remix-run/node'
import path from 'path'
import { readFileSync } from 'fs'
import type { CanvasKit } from 'canvaskit-wasm'
import { once } from 'lodash'

let ck: CanvasKit | undefined
const getCanvasKit = () => {
  if (!ck) {
    require.resolve('canvaskit-wasm/bin/canvaskit.wasm')
    ck = require('canvaskit-wasm')({
      locateFile: (file: string) => {
        return path.resolve(require.resolve('canvaskit-wasm'), '..', file)
      },
    })
  }
  return ck!
}

const getFont = once(() => {
  return readFileSync(
    require.resolve('@fontsource/sarabun/files/sarabun-all-400-normal.woff'),
  )
})
const getBoldFont = once(() => {
  return readFileSync(
    require.resolve('@fontsource/sarabun/files/sarabun-all-700-normal.woff'),
  )
})

const getCacheControl = () =>
  process.env.NODE_ENV === 'production' && !process.env.APIREF_LOCAL
    ? 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200'
    : 'no-cache'

export let loader: LoaderFunction = async ({ request }) => {
  const query = new URL(request.url).searchParams
  const title = query.get('title') || 'Hello World'
  const description = query.get('description') || 'Hello World'
  const name = query.get('name') || 'Hello World'
  const canvasKit = await getCanvasKit()
  const canvas = canvasKit.MakeCanvas(1200, 1200)

  canvas.loadFont(getFont(), {
    family: 'Sarabun',
    style: 'normal',
    weight: '400',
  })
  canvas.loadFont(getBoldFont(), {
    family: 'Sarabun',
    style: 'normal',
    weight: '700',
  })

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#252423'
  ctx.fillRect(0, 0, 1200, 1200)
  ctx.fillStyle = '#353433'
  ctx.fillRect(0, (1200 - 630) / 2, 1200, 630)

  ctx.font = '700 96px Sarabun'
  ctx.fillStyle = '#bef'
  if (ctx.measureText(title).width > 1080) {
    bsearchFit(700, (size) => {
      ctx.font = `700 ${Math.round(size)}px Sarabun`
      return ctx.measureText(title).width <= 1080
    })
  }
  ctx.fillText(title, (1200 - ctx.measureText(title).width) / 2, 560)

  ctx.font = '400 36px Sarabun'
  ctx.fillStyle = '#e9e8e7'
  let text = description.slice(0, 200)
  if (ctx.measureText(text).width > 1080) {
    bsearchFit(200, (size) => {
      text = description.slice(0, size) + (size < description.length ? '…' : '')
      return ctx.measureText(text).width <= 1080
    })
  }
  ctx.fillText(text, (1200 - ctx.measureText(text).width) / 2, 660)

  text = name
  ctx.fillStyle = '#8b8685'
  ctx.fillText(text, (1200 - ctx.measureText(text).width) / 2, 720)

  const dataUrl = canvas.toDataURL('image/png')
  return new Response(Buffer.from(dataUrl.split(',')[1], 'base64'), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': getCacheControl(),
    },
  })
}

function bsearchFit(init: number, test: (value: number) => boolean) {
  let min = 1
  let max = init
  let found = min
  for (let i = 0; i < 7; i++) {
    const mid = Math.floor((min + max) / 2)
    if (test(mid)) {
      min = mid
      found = mid
    } else {
      max = mid
    }
  }
  test(found)
}
