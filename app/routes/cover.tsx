import { LoaderFunction } from 'remix'
import path from 'path'
import type { CanvasKit } from 'canvaskit-wasm'

let ck: CanvasKit | undefined
const getCanvasKit = () => {
  if (!ck) {
    require.resolve('canvaskit-wasm/canvaskit.wasm')
    ck = require('canvaskit-wasm')({
      locateFile: (file: string) => {
        return path.resolve(require.resolve('canvaskit-wasm'), '..', file)
      },
    })
  }
  return ck!
}

const getCacheControl = () =>
  process.env.NODE_ENV === 'production' && !process.env.APIREF_LOCAL
    ? 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200'
    : 'no-cache'

export let loader: LoaderFunction = async ({ context }) => {
  const canvasKit = await getCanvasKit()
  const canvas = canvasKit.MakeCanvas(1200, 1200)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#333'
  ctx.fillRect(0, 0, 1200, 1200)
  const dataUrl = canvas.toDataURL('image/png')
  return new Response(Buffer.from(dataUrl.split(',')[1], 'base64'), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': getCacheControl(),
    },
  })
}
