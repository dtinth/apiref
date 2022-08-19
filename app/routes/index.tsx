import { LoaderFunction, redirect } from '@remix-run/node'
import { Link } from '@remix-run/react'
import { Layout } from '~/Layout'
import { Prose } from '~/Prose'
import { Section } from '~/Section'

export let loader: LoaderFunction = ({ context }) => {
  if (process.env.APIREF_LOCAL) {
    return redirect('/package/apiref:local/')
  }
  return null
}

export default function Index() {
  return (
    <Layout showProject>
      <Prose>
        <h1>apiref</h1>
        <div className="prose-xl">
          <p>
            Automatically generated API reference sites for{' '}
            <abbr title="JavaScript" className="no-underline">
              JS
            </abbr>{' '}
            and{' '}
            <abbr title="TypeScript" className="no-underline">
              TS
            </abbr>{' '}
            libraries that use{' '}
            <a href="https://api-extractor.com/">API Extractor</a>.
          </p>
          <ul>
            <li>
              <a href="https://docs.dt.in.th/apiref/">Documentation</a>
            </li>
            <li>
              <a href="https://docs.dt.in.th/apiref/publishing.html">
                How to publish an API reference
              </a>
            </li>
            <li>
              <Link to="/recent">Recently processed packages</Link>
            </li>
            <li>
              <a href="https://github.com/dtinth/apiref">
                Source code on GitHub
              </a>
            </li>
          </ul>
        </div>
      </Prose>
    </Layout>
  )
}
