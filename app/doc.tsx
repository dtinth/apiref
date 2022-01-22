import clsx from 'clsx'
import { createContext, memo, useMemo } from 'react'
import {
  VscChevronRight,
  VscGithubInverted,
  VscGlobe,
  VscLoading,
} from 'react-icons/vsc'
import { SiNpm } from 'react-icons/si'
import {
  HeadersFunction,
  json,
  Link,
  LoaderFunction,
  MetaFunction,
  useLoaderData,
  useTransition,
} from 'remix'
import {
  DocItemKind,
  DocPageNavigationItem,
  getApiModel as getApiDoc,
  PackageInfo,
} from './DocModel.server'
import { getSummary, renderDocPage } from './DocRenderer.server'
import { DocView, DocViewProps } from './DocView'
import { KindIcon } from './KindIcon'
import { Layout } from './Layout'
import { Diagnostic } from './DiagnosticWriter'
import { getCover } from './getCover'

type PageData = {
  title: string
  slug: string
  navigation: DocPageNavigationItem[]
  baseUrl: string
  summary: string
  docViewProps: DocViewProps
  packageName: string
  packageInfo?: PackageInfo
  diagnostic: string
}

const getCacheControl = () =>
  process.env.NODE_ENV === 'production' && !process.env.APIREF_LOCAL
    ? 'public, max-age=60, s-maxage=60, stale-while-revalidate=3600'
    : 'no-cache'

export const headers: HeadersFunction = () => {
  return {
    'Cache-Control': getCacheControl(),
  }
}

export const loader: LoaderFunction = async ({ params, request, context }) => {
  const segments = (params['*'] as string).split('/').filter((x) => x)
  const diagnostic = new Diagnostic()
  const start = Date.now()
  diagnostic.write(`Handling request for "${request.url}"`)

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

  const { pages, apiModel, linkGenerator, packageInfo } = await getApiDoc(
    packageName,
    diagnostic,
  )
  const page = pages.getPage(path)
  if (!page) {
    throw new Response('Not Found - No page found.', {
      status: 404,
    })
  }

  const end = Date.now()
  diagnostic.write(
    `Response data for "${request.url}" generated in ${end - start}ms`,
  )

  const pageData: PageData = {
    baseUrl: '/package/' + packageName,
    packageName,
    slug: page.slug,
    title: page.info.pageTitle,
    navigation: pages.getNavigation(),
    docViewProps: await renderDocPage(page, { apiModel, linkGenerator }),
    summary: getSummary(page),
    packageInfo,
    diagnostic: diagnostic.messages.join('\n'),
  }

  return json(pageData, {
    headers: {
      'Cache-Control': getCacheControl(),
    },
  })
}

export const meta: MetaFunction = (args) => {
  const data: PageData = args.data
  const pkg = data.packageInfo
    ? `${data.packageInfo.name}@${data.packageInfo.version}`
    : data.packageName
  const sanitizedSummary = data.summary.replace(/\s+/g, ' ').trim()
  return {
    title: data.title + ' — ' + pkg + ' — apiref.page',
    description: sanitizedSummary,
    'og:image': getCover(
      data.title,
      sanitizedSummary.slice(0, 201),
      data.title === data.packageInfo?.name ? 'apiref.page' : pkg,
    ),
  }
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
        <>{!!packageInfo && <TopNavPackageInfo packageInfo={packageInfo} />}</>
      }
    >
      <DocView {...data.docViewProps} />
      <div data-diagnostic={`\n\n${data.diagnostic}\n\n`} />
    </Layout>
  )
}

function TopNavPackageInfo(props: { packageInfo: PackageInfo }) {
  const { packageInfo } = props
  return (
    <div className="flex self-center items-center px-[18px] border-l border-#353433 text-#8b8685 gap-3 flex-auto">
      <a
        href={`/package/${packageInfo.name}@${packageInfo.version}`}
        className="flex nowrap truncate overflow-hidden"
      >
        {packageInfo.name}@{packageInfo.version}
      </a>
      {!!packageInfo.homepage && (
        <a href={`${packageInfo.homepage}`} className="text-lg flex-none">
          {isGitHub(packageInfo.homepage) ? (
            <VscGithubInverted />
          ) : (
            <VscGlobe />
          )}
        </a>
      )}
      <a
        href={`https://www.npmjs.com/package/${packageInfo.name}/v/${packageInfo.version}`}
        className="text-lg flex-none"
      >
        <SiNpm />
      </a>
    </div>
  )
}

function isGitHub(link: string) {
  return link.match(/^https?:\/\/(?:www\.?)?github\.com\//)
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
          <NavItem
            active={activePage === nav.slug}
            to={`${props.baseUrl}/${nav.slug}`}
            depth={props.depth}
            hasChildren={nav.children.length > 0}
            kind={nav.kind}
            static={!!nav.static}
            beta={!!nav.beta}
            deprecated={!!nav.deprecated}
            title={nav.title}
          />
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

const NavItem = memo(function NavItem(props: {
  active: boolean
  title: string
  to: string
  depth: number
  hasChildren: boolean
  kind: DocItemKind
  static: boolean
  beta: boolean
  deprecated: boolean
}) {
  return (
    <Link
      className={clsx(
        'block pl-[calc(0.25rem+0.75rem*var(--depth))] pr-2 whitespace-nowrap',
        props.active && 'bg-#454443 js-nav-active',
      )}
      to={props.to}
      style={{ '--depth': props.depth } as any}
    >
      <span className="inline-block w-5 align-middle relative top-[-0.1em]">
        <LoadingConnector to={props.to}>
          {(loading) =>
            loading ? (
              <div className="animate-spin w-4 h-4">
                <VscLoading />
              </div>
            ) : props.hasChildren ? (
              <div className="rotate-90 w-4 h-4">
                <VscChevronRight />
              </div>
            ) : null
          }
        </LoadingConnector>
      </span>
      <KindIcon kind={props.kind} static={props.static} />
      {props.deprecated ? (
        <span className="line-through">{props.title}</span>
      ) : props.beta ? (
        <>
          {props.title} <span className="opacity-50">&beta;</span>
        </>
      ) : (
        props.title
      )}
    </Link>
  )
})

const LoadingConnector = (props: {
  to: string
  children: (loading: boolean) => React.ReactNode
}) => {
  const transition = useTransition()
  const loading =
    transition.state === 'loading' && transition.location?.pathname === props.to
  return useMemo(
    () => <>{props.children(loading)}</>,
    [loading, props.children],
  )
}
