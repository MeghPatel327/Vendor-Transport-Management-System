import api from '@/lib/api-client'
import type { Transport, CreateTransportPayload, UpdateTransportPayload, TransportQueryParams } from '@/types'

export const transportService = {
  getAll: async (params?: TransportQueryParams): Promise<Transport[]> => {
    const { data } = await api.get('/transport', { params })
    return data.data
  },

  getById: async (id: number): Promise<Transport> => {
    const { data } = await api.get(`/transport/${id}`)
    return data.data
  },

  create: async (payload: CreateTransportPayload): Promise<Transport> => {
    const { data } = await api.post('/transport', payload)
    return data.data
  },

  update: async (id: number, payload: UpdateTransportPayload): Promise<Transport> => {
    const { data } = await api.put(`/transport/${id}`, payload)
    return data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/transport/${id}`)
  },
}
