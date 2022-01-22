export function getCover(title: string, description: string, name: string) {
  return `/cover?${new URLSearchParams({ title, description, name })}`
}
