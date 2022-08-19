import { groupBy } from 'lodash'
import { Link } from 'react-router-dom'
import { HeadersFunction, json, LoaderFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Layout } from '~/Layout'
import { Prose } from '~/Prose'
import { loadRecentlyProcessedPackages } from '~/RecentlyProcessedPackages.server'
import * as semver from 'semver'

type PageData = {
  recent: {
    name: string
    version: string
    to: string
  }[]
}

const getCacheControl = () =>
  process.env.NODE_ENV === 'production' && !process.env.APIREF_LOCAL
    ? 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200'
    : 'no-cache'

export const headers: HeadersFunction = () => {
  return {
    'Cache-Control': getCacheControl(),
  }
}

export let loader: LoaderFunction = async ({ context }) => {
  const recentGroups = groupBy(
    await loadRecentlyProcessedPackages(),
    (p) => p.name,
  )
  const pageData: PageData = {
    recent: Object.keys(recentGroups)
      .sort()
      .map((name) => {
        const version = maxVersion(recentGroups[name].map((p) => p.version))
        return {
          name,
          version,
          to: `/package/${name}@${version}`,
        }
      }),
  }
  return json(pageData, {
    headers: {
      'Cache-Control': getCacheControl(),
    },
  })
}

function maxVersion(versions: string[]) {
  return versions.reduce((max, v) => (semver.gt(v, max) ? v : max))
}

export default function Index() {
  const data: PageData = useLoaderData()
  return (
    <Layout showProject>
      <Prose>
        <h1>Recently processed packages</h1>
        {data.recent.length ? (
          <ul>
            {data.recent.map((recent) => (
              <li key={recent.name}>
                <Link to={recent.to} className="no-underline">
                  {recent.name}
                  <span className="text-#8b8685">@{recent.version}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No information to show right now.</p>
        )}
      </Prose>
    </Layout>
  )
}
