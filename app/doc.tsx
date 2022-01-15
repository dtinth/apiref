import { Link, LoaderFunction, useLoaderData } from 'remix'
import {
  DocItemKind,
  DocPageNavigationItem,
  getApiModel as getApiDoc,
} from './DocModel.server'
import {
  VscJson,
  VscSymbolClass,
  VscSymbolEnum,
  VscSymbolField,
  VscSymbolInterface,
  VscSymbolMethod,
  VscSymbolProperty,
  VscSymbolVariable,
} from 'react-icons/vsc'

type PageData = {
  title: string
  navigation: DocPageNavigationItem[]
  baseUrl: string
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

  const { pages } = await getApiDoc(packageName)
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
  }
}

export default function Doc() {
  const data: PageData = useLoaderData()
  console.log(data.navigation)
  return (
    <>
      <h1 className="text-3xl">{data.title}</h1>
      <nav>
        {data.navigation.map((nav, i) => (
          <NavigationTree nav={nav} key={i} baseUrl={data.baseUrl} />
        ))}
      </nav>
    </>
  )
}

function NavigationTree(props: {
  nav: DocPageNavigationItem
  baseUrl: string
}) {
  const { nav } = props
  return (
    <>
      <KindIcon kind={nav.kind} />
      <Link to={`${props.baseUrl}/${nav.slug}`}>{nav.title}</Link>
      {nav.children.length > 0 && (
        <ul className="pl-3">
          {nav.children.map((child, i) => (
            <li key={i}>
              <NavigationTree nav={child} baseUrl={props.baseUrl} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function KindIcon(props: { kind: DocItemKind }) {
  let icon = null
  let color = 'text-gray-600'
  switch (props.kind) {
    case 'EntryPoint':
    case 'Namespace':
    case 'Package':
      icon = <VscJson />
      break
    case 'Class':
      icon = <VscSymbolClass />
      color = 'text-orange-600'
      break
    case 'Constructor':
    case 'ConstructSignature':
      icon = <VscSymbolProperty />
      break
    case 'Enum':
      icon = <VscSymbolEnum />
      color = 'text-orange-600'
      break
    case 'Interface':
      icon = <VscSymbolInterface />
      color = 'text-sky-600'
      break
    case 'Function':
    case 'Method':
    case 'MethodSignature':
      icon = <VscSymbolMethod />
      color = 'text-purple-600'
      break
    case 'Property':
    case 'PropertySignature':
      icon = <VscSymbolField />
      color = 'text-sky-600'
      break
    case 'Variable':
      icon = <VscSymbolVariable />
      color = 'text-sky-600'
      break
  }
  return <span className={`inline-block w-5 ${color}`}>{icon}</span>
}
