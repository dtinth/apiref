import clsx from 'clsx'
import { createContext } from 'react'
import { VscChevronRight } from 'react-icons/vsc'
import {
  HeadersFunction,
  json,
  Link,
  LoaderFunction,
  useLoaderData,
} from 'remix'
import {
  DocPageNavigationItem,
  getApiModel as getApiDoc,
  PackageInfo,
} from './DocModel.server'
import { renderDocPage } from './DocRenderer.server'
import { DocView, DocViewProps } from './DocView'
import { KindIcon } from './KindIcon'
import { Layout } from './Layout'

type PageData = {
  title: string
  slug: string
  navigation: DocPageNavigationItem[]
  baseUrl: string
  docViewProps: DocViewProps
  packageInfo?: PackageInfo
}

const CACHE_CONTROL =
  process.env.NODE_ENV === 'production'
    ? 'public, max-age=60, s-maxage=60, stale-while-revalidate=3600'
    : 'no-cache'

export const headers: HeadersFunction = () => {
  return {
    'Cache-Control': CACHE_CONTROL,
  }
}

export const loader: LoaderFunction = async ({ params }) => {
  const segments = (params['*'] as string).split('/').filter((x) => x)
  console.log(params['*'])
  if (segments.length === 0) {
    throw new Response('Not Found - No package name specified.', {
      status: 404,
    })
  }
  let packageName = segments.shift() as string
  if (packageName.startsWith('@')) {
    packageName += '/' + segments.shift()
  }
  const path = segments.join('/')
  console.log({ packageName, path })

  const { pages, apiModel, linkGenerator, packageInfo } = await getApiDoc(
    packageName,
  )
  const page = pages.getPage(path)
  if (!page) {
    throw new Response('Not Found - No page found.', {
      status: 404,
    })
  }

  const pageData: PageData = {
    baseUrl: '/package/' + packageName,
    slug: page.slug,
    title: page.info.pageTitle,
    navigation: pages.getNavigation(),
    docViewProps: await renderDocPage(page, { apiModel, linkGenerator }),
    packageInfo,
  }

  return json(pageData, {
    headers: {
      'Cache-Control': CACHE_CONTROL,
    },
  })
}

export default function Doc() {
  const data: PageData = useLoaderData()
  const packageInfo = data.packageInfo
  return (
    <Layout
      navigationId={data.baseUrl + data.slug}
      sidebar={
        <nav>
          <ActivePageContext.Provider value={data.slug}>
            {data.navigation.map((nav, i) => (
              <NavigationTree
                nav={nav}
                key={i}
                baseUrl={data.baseUrl}
                depth={0}
              />
            ))}
          </ActivePageContext.Provider>
        </nav>
      }
      headerItems={
        <>
          {!!packageInfo && (
            <div className="flex self-center items-center px-[18px] flex-none border-l border-#353433 text-#8b8685">
              <a
                href={`https://www.npmjs.com/package/${packageInfo.name}/v/${packageInfo.version}`}
              >
                {packageInfo.name}@{packageInfo.version}
              </a>
            </div>
          )}
        </>
      }
    >
      <DocView {...data.docViewProps} />
    </Layout>
  )
}

const ActivePageContext = createContext<string | undefined>(undefined)

function NavigationTree(props: {
  nav: DocPageNavigationItem
  baseUrl: string
  depth: number
}) {
  const { nav } = props
  return (
    <>
      <ActivePageContext.Consumer>
        {(activePage) => (
          <Link
            className={clsx(
              'block pl-[calc(0.25rem+0.75rem*var(--depth))] pr-2 whitespace-nowrap',
              activePage === nav.slug && 'bg-#454443 js-nav-active',
            )}
            to={`${props.baseUrl}/${nav.slug}`}
            style={{ '--depth': props.depth } as any}
          >
            <span className="inline-block w-5 align-middle relative top-[-0.1em]">
              {nav.children.length > 0 && (
                <div className="rotate-90 w-4 h-4">
                  <VscChevronRight />
                </div>
              )}
            </span>
            <KindIcon kind={nav.kind} static={nav.static} />
            {nav.deprecated ? (
              <span className="line-through">{nav.title}</span>
            ) : nav.beta ? (
              <>
                {nav.title} <span className="opacity-50">&beta;</span>
              </>
            ) : (
              nav.title
            )}
          </Link>
        )}
      </ActivePageContext.Consumer>
      {nav.children.length > 0 && (
        <ul>
          {nav.children.map((child, i) => (
            <li key={i}>
              <NavigationTree
                nav={child}
                baseUrl={props.baseUrl}
                depth={props.depth + 1}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
