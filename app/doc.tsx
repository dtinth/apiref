import { Link, LoaderFunction, useLoaderData } from 'remix'
import {
  DocPageNavigationItem,
  getApiModel as getApiDoc,
} from './DocModel.server'
import { renderDocPage } from './DocRenderer'
import { DocView, DocViewProps } from './DocView'
import { KindIcon } from './KindIcon'
import { Layout } from './Layout'

type PageData = {
  title: string
  navigation: DocPageNavigationItem[]
  baseUrl: string
  docViewProps: DocViewProps
}

export const loader: LoaderFunction = async ({ params }): Promise<PageData> => {
  const segments = (params['*'] as string).split('/').filter((x) => x)
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

  const { pages, apiModel, linkGenerator } = await getApiDoc(packageName)
  const page = pages.getPage(path)
  if (!page) {
    throw new Response('Not Found - No page found.', {
      status: 404,
    })
  }

  return {
    baseUrl: '/' + packageName,
    title: page.info.pageTitle,
    navigation: pages.getNavigation(),
    docViewProps: await renderDocPage(page, { apiModel, linkGenerator }),
  }
}

export default function Doc() {
  const data: PageData = useLoaderData()
  console.log(data.navigation)
  return (
    <Layout
      sidebar={
        <nav>
          {data.navigation.map((nav, i) => (
            <NavigationTree
              nav={nav}
              key={i}
              baseUrl={data.baseUrl}
              depth={0}
            />
          ))}
        </nav>
      }
    >
      <DocView {...data.docViewProps} />
    </Layout>
  )
}

function NavigationTree(props: {
  nav: DocPageNavigationItem
  baseUrl: string
  depth: number
}) {
  const { nav } = props
  return (
    <>
      <Link
        className="block pl-[calc(0.5rem+0.75rem*var(--depth))] pr-2 whitespace-nowrap"
        to={`${props.baseUrl}/${nav.slug}`}
        style={{ '--depth': props.depth } as any}
      >
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
