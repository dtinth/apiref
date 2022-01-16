import { ReactNode } from 'react'
import { Link } from 'remix'
import clsx from 'clsx'

export function Layout(props: { children?: ReactNode; sidebar?: ReactNode }) {
  return (
    <>
      <header className="h-[58px] fixed top-0 inset-x-0 bg-#090807 border-b border-#454443 z-20 flex">
        <div className="flex items-center px-[18px] flex-none">
          <Link
            to="/"
            className="flex items-center text-#8b8685 text-lg font-medium"
          >
            apiref
          </Link>
        </div>
      </header>
      <main className={clsx('pt-[58px]', !!props.sidebar && 'ml-[20rem]')}>
        <div className="max-w-4xl mx-auto p-6">{props.children}</div>
      </main>
      {!!props.sidebar && (
        <aside className="fixed top-[58px] w-[20rem] bottom-0 left-0 overflow-y-auto overflow-x-hidden bg-#252423 leading-relaxed border-r border-#454443 text-gray-300 z-10">
          {props.sidebar}
        </aside>
      )}
    </>
  )
}
