import api from '@/lib/api-client'
import type { HissabSummary, HissabQueryParams } from '@/types'

export const hissabService = {
  getSummary: async (params?: HissabQueryParams): Promise<HissabSummary> => {
    const { data } = await api.get('/hissab', { params })
    return data.data
  },
}
