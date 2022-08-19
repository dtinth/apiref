import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
} from '@remix-run/react'
import type { LoaderFunction, MetaFunction } from '@remix-run/node'
import styles from './tailwind.css'
import { useEffect } from 'react'

export function links() {
  return [{ rel: 'stylesheet', href: styles }]
}

export const meta: MetaFunction = () => {
  return { title: 'apiref.page' }
}

export const loader: LoaderFunction = () => {
  return {
    gaEnabled:
      process.env.NODE_ENV === 'production' && !process.env.APIREF_LOCAL,
  }
}

export default function App() {
  const { gaEnabled } = useLoaderData()
  return (
    <html lang="en">
      <head>
        {gaEnabled && (
          <>
            <script
              async
              src="https://www.googletagmanager.com/gtag/js?id=G-5J92C1MDC0"
            ></script>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());

                  gtag('config', 'G-5J92C1MDC0');
                `,
              }}
            />
          </>
        )}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="shortcut icon" href="/interface.svg" />
        <style>{`body ::-webkit-scrollbar {
    height: 0.5rem;
    width: 0.5rem;
}
body ::-webkit-scrollbar-thumb {
  background-color: #8b8685;
  background-color: #8b868580;
}`}</style>
        <Meta />
        <Links />
      </head>
      <body className="bg-#252423 text-#e9e8e7 antialiased">
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        {process.env.NODE_ENV === 'development' && <LiveReload />}
        {gaEnabled && <GaSender />}
      </body>
    </html>
  )
}

function GaSender(props: {}) {
  const location = useLocation()
  const pathname = location.pathname
  useEffect(() => {
    const gtag = (window as any).gtag
    gtag?.('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.origin + location.pathname,
    })
  }, [pathname])
  return <></>
}
