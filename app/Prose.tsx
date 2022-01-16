import { ReactNode } from 'react'

export function Prose(props: { children?: ReactNode }) {
  return (
    <div className="prose prose-invert max-w-none prose-h1:text-#bbeeff prose-h1:[text-shadow:2px_2px_#00000040] prose-h2:text-#d7fc70 prose-h2:[text-shadow:2px_2px_#d7fc7026] prose-th:uppercase prose-th:font-normal prose-th:text-xs prose-th:text-#8b8685 prose-thead:border-#656463 prose-tr:border-#454443 prose-a:text-#ffffbb">
      {props.children}
    </div>
  )
}
