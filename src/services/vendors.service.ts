import api from '@/lib/api-client'
import type { Vendor, CreateVendorPayload, UpdateVendorPayload, VendorQueryParams } from '@/types'

export const vendorsService = {
  getAll: async (params?: VendorQueryParams): Promise<Vendor[]> => {
    const { data } = await api.get('/vendors', { params })
    return data.data
  },

  getById: async (id: number): Promise<Vendor> => {
    const { data } = await api.get(`/vendors/${id}`)
    return data.data
  },

  create: async (payload: CreateVendorPayload): Promise<Vendor> => {
    const { data } = await api.post('/vendors', payload)
    return data.data
  },

  update: async (id: number, payload: UpdateVendorPayload): Promise<Vendor> => {
    const { data } = await api.put(`/vendors/${id}`, payload)
    return data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/vendors/${id}`)
  },
}
