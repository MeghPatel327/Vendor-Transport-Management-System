import api from '@/lib/api-client'
import type { Order, CreateOrderPayload, UpdateOrderPayload, OrderQueryParams } from '@/types'

export const ordersService = {
  getAll: async (params?: OrderQueryParams): Promise<Order[]> => {
    const { data } = await api.get('/orders', { params })
    return data.data
  },

  getById: async (id: number): Promise<Order> => {
    const { data } = await api.get(`/orders/${id}`)
    return data.data
  },

  create: async (payload: CreateOrderPayload): Promise<Order> => {
    const { data } = await api.post('/orders', payload)
    return data.data
  },

  update: async (id: number, payload: UpdateOrderPayload): Promise<Order> => {
    const { data } = await api.put(`/orders/${id}`, payload)
    return data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/orders/${id}`)
  },
}
