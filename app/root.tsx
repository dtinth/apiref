import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'remix'
import type { MetaFunction } from 'remix'
import styles from './tailwind.css'

export function links() {
  return [{ rel: 'stylesheet', href: styles }]
}

export const meta: MetaFunction = () => {
  return { title: 'New Remix App' }
}

export default function App() {
  return (
    <html lang="en">
      <head>
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
      </body>
    </html>
  )
}
