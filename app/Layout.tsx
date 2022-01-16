import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'remix'
import clsx from 'clsx'
import { VscGithubInverted, VscMenu } from 'react-icons/vsc'

export function Layout(props: {
  children?: ReactNode
  sidebar?: ReactNode
  navigationId?: string
  headerItems?: ReactNode
  showProject?: boolean
}) {
  const [responsiveMenu, setResponsiveMenu] = useState<
    'hide' | 'show' | 'none'
  >('none')
  const sidebarRef = useRef<HTMLElement>(null)
  useEffect(() => {
    setResponsiveMenu('hide')
  }, [])
  const responsiveMode = responsiveMenu !== 'none'
  useEffect(() => {
    const sidebar = sidebarRef.current
    if (sidebar && responsiveMode) {
      const currentItem = sidebar.querySelector('.js-nav-active')
      if (currentItem) {
        const sidebarRect = sidebar.getBoundingClientRect()
        const currentItemRect = currentItem.getBoundingClientRect()
        if (
          currentItemRect.top < sidebarRect.top ||
          currentItemRect.bottom > sidebarRect.bottom
        ) {
          currentItem.scrollIntoView({ block: 'center' })
        }
      }
    }
  }, [responsiveMode, props.navigationId])
  const toggleMenu = () => {
    setResponsiveMenu((r) => (r === 'show' ? 'hide' : 'show'))
  }
  return (
    <>
      <header className="h-[58px] fixed top-0 inset-x-0 bg-#090807 border-b border-#454443 z-20 flex">
        <div className="flex items-center pl-[18px] flex-none md:hidden">
          <button onClick={toggleMenu} title="Toggle menu">
            <VscMenu />
          </button>
        </div>
        <div className="flex items-center px-[18px] flex-none">
          <Link
            to="/"
            className="flex items-center text-#8b8685 text-lg font-medium"
          >
            apiref
          </Link>
        </div>
        {props.headerItems}
        {!!props.showProject && (
          <>
            <div className="flex items-center ml-auto px-[18px]">
              <a href="https://github.com/dtinth/apiref" className="text-3xl">
                <VscGithubInverted />
              </a>
            </div>
          </>
        )}
      </header>
      <main
        className={clsx(
          'pt-[58px] bg-#353433',
          !!props.sidebar && 'md:ml-[20rem]',
        )}
      >
        <div className="max-w-4xl mx-auto p-6 py-12">{props.children}</div>
      </main>
      {!!props.sidebar && (
        <aside
          className={clsx(
            'md:fixed md:top-[58px] md:w-[20rem] md:bottom-0 md:left-0 md:overflow-y-auto overflow-x-hidden bg-#252423 leading-relaxed md:border-r border-#454443 text-gray-300 z-10',
            responsiveMenu != 'none' &&
              'fixed top-[58px] w-[20rem] bottom-0 left-0 overflow-y-auto border-r transition-transform',
            responsiveMenu === 'hide' && '-translate-x-full md:translate-x-0',
          )}
          ref={sidebarRef}
        >
          {props.sidebar}
        </aside>
      )}
    </>
  )
}
