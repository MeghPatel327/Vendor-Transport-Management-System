import api from '@/lib/api-client'
import type { DashboardStats } from '@/types'

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await api.get('/dashboard/stats')
    return data.data
  },
}
