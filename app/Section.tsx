import { ReactNode } from 'react'

export function Section(props: { children: ReactNode; title: string }) {
  return (
    <section>
      <h2>{props.title}</h2>
      <div className="md:ml-8">{props.children}</div>
    </section>
  )
}
