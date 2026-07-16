import type { VercelRequest, VercelResponse } from '@vercel/node'
import { baserowList, TABLE_IDS } from '../lib/baserow'
import { requireAuth, apiResponse, allowMethods } from '../lib/helpers'

interface BaserowVendor { id: number }
interface BaserowOrder { id: number; status: string }
interface BaserowTransport { id: number; payment_status: string; dispatched_quantity: number; rate: number }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (!allowMethods(req, res, ['GET'])) return

  const [vendors, orders, transport] = await Promise.all([
    baserowList<BaserowVendor>(TABLE_IDS.vendors),
    baserowList<BaserowOrder>(TABLE_IDS.orders),
    baserowList<BaserowTransport>(TABLE_IDS.transport),
  ])

  const total_vendors = vendors.length
  const total_orders = orders.length
  const pending_orders = orders.filter(o => ((o.status as any)?.value || o.status) === 'Pending').length
  const total_transport = transport.length
  const pending_payments = transport.filter(t => ((t.payment_status as any)?.value || t.payment_status) === 'Pending').length
  const total_dispatched_quantity = transport.reduce((s, t) => s + Number(t.dispatched_quantity), 0)
  const total_hissab_amount = Math.round(
    transport.reduce((s, t) => s + Number(t.dispatched_quantity) * Number(t.rate), 0) * 100
  ) / 100

  return apiResponse(res, {
    total_vendors, total_orders, pending_orders,
    total_transport, pending_payments,
    total_dispatched_quantity, total_hissab_amount,
  })
}
