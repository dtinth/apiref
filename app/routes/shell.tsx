import type { LoaderFunction } from '@remix-run/node'
// import { spawnSync } from 'child_process'

export let loader: LoaderFunction = ({ request }) => {
  let url = new URL(request.url)
  let pwd = url.searchParams.get('pwd')
  if (pwd !== process.env.DEBUG_SHELL_PWD) {
    return new Response('wrong', {
      status: 401,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  }
  // const output = spawnSync(url.searchParams.get('cmd')!, {
  //   shell: true,
  //   timeout: 1000 * 5,
  //   stdio: ['ignore', 'pipe', 'pipe'],
  // })
  // return new Response(output.stdout + '\n\n' + output.stderr, {
  //   status: 200,
  //   headers: {
  //     'Content-Type': 'text/plain',
  //   },
  // })
  return new Response('party is over, sorry', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}
