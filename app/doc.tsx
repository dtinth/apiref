import { Link, LoaderFunction, useLoaderData } from 'remix'
import {
  DocPageNavigationItem,
  getApiModel as getApiDoc,
} from './DocModel.server'
import { renderDocPage } from './DocRenderer'
import { DocView, DocViewProps } from './DocView'
import { KindIcon } from './KindIcon'

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

  const { pages, apiModel } = await getApiDoc(packageName)
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
    docViewProps: renderDocPage(page, { apiModel }),
  }
}

export default function Doc() {
  const data: PageData = useLoaderData()
  console.log(data.navigation)
  return (
    <>
      <header className="h-10 fixed top-0 inset-x-0 bg-gray-200">
        [Header]
      </header>
      <main className="ml-[20rem] pt-10">
        <div className="max-w-4xl mx-auto p-6">
          <DocView {...data.docViewProps} />
        </div>
      </main>
      <aside className="fixed top-10 w-[20rem] bottom-0 left-0 overflow-y-auto overflow-x-hidden bg-gray-100">
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
      </aside>
    </>
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
        className="block pl-[calc(0.75rem*var(--depth))]"
        to={`${props.baseUrl}/${nav.slug}`}
        style={{ '--depth': props.depth } as any}
      >
        <KindIcon kind={nav.kind} />
        {nav.title}
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
