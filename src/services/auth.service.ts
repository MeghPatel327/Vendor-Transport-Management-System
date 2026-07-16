import api from '@/lib/api-client'
import type { AuthUser, LoginPayload } from '@/types'

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthUser> => {
    const { data } = await api.post('/auth/login', payload)
    return data.user
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout')
  },

  me: async (): Promise<AuthUser> => {
    const { data } = await api.get('/auth/me')
    return data.user
  },
}
