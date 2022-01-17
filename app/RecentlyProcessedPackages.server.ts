import axios from 'axios'
import pMemoize from 'p-memoize'

export type RecentlyProcessedPackage = {
  name: string
  version: string
}

export const loadRecentlyProcessedPackages = pMemoize(
  async (): Promise<RecentlyProcessedPackage[]> => {
    if (!process.env.AMPLITUDE_API_KEY || !process.env.AMPLITUDE_SECRET_KEY) {
      return []
    }
    const url = 'https://amplitude.com/api/3/chart/418h7jd/query'
    const response = await axios.get(url, {
      auth: {
        username: process.env.AMPLITUDE_API_KEY!,
        password: process.env.AMPLITUDE_SECRET_KEY!,
      },
    })
    const output: RecentlyProcessedPackage[] = []
    for (const series of response.data.data.seriesMeta) {
      const name = series.eventGroupBy
      const m = name.match(/^(.+)@([^@]+)$/)
      if (m) {
        output.push({
          name: m[1],
          version: m[2],
        })
      }
    }
    return output
  },
)
