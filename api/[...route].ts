/**
 * api/[...route].ts — Single catch-all serverless function.
 * Handles ALL API routes to stay within Vercel Hobby plan's 12-function limit.
 *
 * Routes handled:
 *   POST   /api/auth/login
 *   POST   /api/auth/logout
 *   GET    /api/auth/me
 *   GET    /api/dashboard/stats
 *   GET    /api/hissab
 *   GET    /api/vendors            POST /api/vendors
 *   GET    /api/vendors/:id        PUT  /api/vendors/:id   DELETE /api/vendors/:id
 *   GET    /api/orders             POST /api/orders
 *   GET    /api/orders/:id         PUT  /api/orders/:id    DELETE /api/orders/:id
 *   GET    /api/transport          POST /api/transport
 *   GET    /api/transport/:id      PUT  /api/transport/:id DELETE /api/transport/:id
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { signJWT, verifyJWT, parseCookies } from '../lib/jwt'
import { baserowList, baserowGet, baserowCreate, baserowUpdate, baserowDelete, TABLE_IDS } from '../lib/baserow'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ok<T>(res: VercelResponse, data: T, status = 200) {
  return res.status(status).json({ success: true, data })
}
function err(res: VercelResponse, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message, message })
}
async function requireAuth(req: VercelRequest, res: VercelResponse) {
  const token = parseCookies(req.headers.cookie || '')['vtms_token']
  if (!token) { err(res, 'Unauthorized', 401); return null }
  const user = await verifyJWT(token)
  if (!user) { err(res, 'Unauthorized', 401); return null }
  return user
}
function allow(req: VercelRequest, res: VercelResponse, methods: string[]) {
  if (!methods.includes(req.method || '')) {
    err(res, `Method ${req.method} not allowed`, 405)
    return false
  }
  return true
}

// ─── Mappers ──────────────────────────────────────────────────────────────────
interface BaserowVendor   { id: number; name: string; created_on: string }
interface BaserowOrder    { id: number; vendor_id: number; vendor_name?: string; item: string; quantity: number; rate: number; amount: number; status: any; order_date: string }
interface BaserowTransport { id: number; vendor_id: number; lr_number: string; transport_name: string; city: string; item: string; quantity: number; dispatched_quantity: number; remaining_quantity: number; rate: number; amount: number; payment_status: any; transport_date: string }

const mapVendor    = (r: BaserowVendor)    => ({ id: r.id, name: r.name, created_at: r.created_on })
const mapOrder     = (r: BaserowOrder)     => ({ id: r.id, vendor_id: r.vendor_id, vendor_name: r.vendor_name ?? '', item: r.item, quantity: Number(r.quantity), rate: Number(r.rate), amount: Number(r.amount), status: r.status?.value ?? r.status, order_date: r.order_date })
const mapTransport = (r: BaserowTransport, vendorName?: string) => ({ id: r.id, vendor_id: r.vendor_id, vendor_name: vendorName ?? '', lr_number: r.lr_number, transport_name: r.transport_name, city: r.city, item: r.item, quantity: Number(r.quantity), dispatched_quantity: Number(r.dispatched_quantity), remaining_quantity: Number(r.remaining_quantity), rate: Number(r.rate), amount: Number(r.amount), payment_status: r.payment_status?.value ?? r.payment_status, transport_date: r.transport_date })

// ─── Route Handlers ───────────────────────────────────────────────────────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme'
const ADMIN_NAME     = process.env.ADMIN_NAME     || 'Administrator'

async function handleAuth(req: VercelRequest, res: VercelResponse, action: string) {
  if (action === 'login') {
    if (!allow(req, res, ['POST'])) return
    const { username, password } = req.body ?? {}
    if (!username || !password) return err(res, 'Username and password are required', 400)
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      await new Promise(r => setTimeout(r, 500))
      return err(res, 'Invalid credentials', 401)
    }
    const token = await signJWT({ sub: username, name: ADMIN_NAME })
    res.setHeader('Set-Cookie', [`vtms_token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`])
    return res.status(200).json({ success: true, user: { username, name: ADMIN_NAME } })
  }
  if (action === 'me') {
    if (!allow(req, res, ['GET'])) return
    const token = parseCookies(req.headers.cookie || '')['vtms_token']
    if (!token) return err(res, 'Unauthorized', 401)
    const user = await verifyJWT(token)
    if (!user) return err(res, 'Unauthorized', 401)
    return res.status(200).json({ success: true, user: { username: user.sub, name: user.name } })
  }
  if (action === 'logout') {
    if (!allow(req, res, ['POST'])) return
    res.setHeader('Set-Cookie', ['vtms_token=; HttpOnly; Path=/; Max-Age=0'])
    return res.status(200).json({ success: true })
  }
  return err(res, 'Not found', 404)
}

async function handleDashboardStats(req: VercelRequest, res: VercelResponse) {
  if (!allow(req, res, ['GET'])) return
  const user = await requireAuth(req, res); if (!user) return
  const [vendors, orders, transport] = await Promise.all([
    baserowList<{ id: number }>(TABLE_IDS.vendors),
    baserowList<{ id: number; status: any }>(TABLE_IDS.orders),
    baserowList<{ id: number; payment_status: any; dispatched_quantity: number; rate: number }>(TABLE_IDS.transport),
  ])
  return ok(res, {
    total_vendors: vendors.length,
    total_orders: orders.length,
    pending_orders: orders.filter(o => (o.status?.value ?? o.status) === 'Pending').length,
    total_transport: transport.length,
    pending_payments: transport.filter(t => (t.payment_status?.value ?? t.payment_status) === 'Pending').length,
    total_dispatched_quantity: transport.reduce((s, t) => s + Number(t.dispatched_quantity), 0),
    total_hissab_amount: Math.round(transport.reduce((s, t) => s + Number(t.dispatched_quantity) * Number(t.rate), 0) * 100) / 100,
  })
}

async function handleHissab(req: VercelRequest, res: VercelResponse) {
  if (!allow(req, res, ['GET'])) return
  const user = await requireAuth(req, res); if (!user) return
  const { vendor_id, city } = req.query as Record<string, string>
  const params: Record<string, string> = {}
  if (vendor_id) params['filter__vendor_id__equal'] = vendor_id
  if (city)      params['filter__city__equal']      = city
  const [rows, vend] = await Promise.all([
    baserowList<BaserowTransport>(TABLE_IDS.transport, params),
    baserowList<BaserowVendor>(TABLE_IDS.vendors),
  ])
  const vmap = Object.fromEntries(vend.map(v => [v.id, v.name]))
  const entries = rows.map(t => {
    const dispatchedQty = Number(t.dispatched_quantity)
    const rate = Number(t.rate)
    return { transport_id: t.id, vendor_id: t.vendor_id, vendor_name: vmap[t.vendor_id] ?? '', city: t.city, item: t.item, lr_number: t.lr_number, dispatched_quantity: dispatchedQty, rate, hissab_amount: Math.round(dispatchedQty * rate * 100) / 100, transport_date: t.transport_date, payment_status: t.payment_status?.value ?? t.payment_status }
  })
  return ok(res, { entries, total_hissab_amount: Math.round(entries.reduce((s, e) => s + e.hissab_amount, 0) * 100) / 100, total_dispatched_quantity: entries.reduce((s, e) => s + e.dispatched_quantity, 0) })
}

async function handleVendors(req: VercelRequest, res: VercelResponse, id?: string) {
  const user = await requireAuth(req, res); if (!user) return
  if (!id) {
    if (!allow(req, res, ['GET', 'POST'])) return
    if (req.method === 'GET') {
      const { search } = req.query as { search?: string }
      const params: Record<string, string> = {}
      if (search) params['filter__name__contains'] = search
      return ok(res, (await baserowList<BaserowVendor>(TABLE_IDS.vendors, params)).map(mapVendor))
    }
    const { name } = req.body ?? {}
    if (!name || typeof name !== 'string' || name.trim().length < 2) return err(res, 'Vendor name must be at least 2 characters', 400)
    return ok(res, mapVendor(await baserowCreate<BaserowVendor>(TABLE_IDS.vendors, { name: name.trim() })), 201)
  }
  const rid = Number(id)
  if (!rid || isNaN(rid)) return err(res, 'Invalid vendor ID', 400)
  if (!allow(req, res, ['GET', 'PUT', 'DELETE'])) return
  if (req.method === 'GET')    return ok(res, mapVendor(await baserowGet<BaserowVendor>(TABLE_IDS.vendors, rid)))
  if (req.method === 'DELETE') { await baserowDelete(TABLE_IDS.vendors, rid); return ok(res, { deleted: true }) }
  const { name } = req.body ?? {}
  if (!name || typeof name !== 'string' || name.trim().length < 2) return err(res, 'Vendor name must be at least 2 characters', 400)
  return ok(res, mapVendor(await baserowUpdate<BaserowVendor>(TABLE_IDS.vendors, rid, { name: name.trim() })))
}

async function handleOrders(req: VercelRequest, res: VercelResponse, id?: string) {
  const user = await requireAuth(req, res); if (!user) return
  if (!id) {
    if (!allow(req, res, ['GET', 'POST'])) return
    if (req.method === 'GET') {
      const { search, vendor_id, status } = req.query as Record<string, string>
      const params: Record<string, string> = {}
      if (search)    params['filter__item__contains']   = search
      if (vendor_id) params['filter__vendor_id__equal'] = vendor_id
      if (status)    params['filter__status__equal']    = status
      const [rows, vend] = await Promise.all([baserowList<BaserowOrder>(TABLE_IDS.orders, params), baserowList<BaserowVendor>(TABLE_IDS.vendors)])
      const vmap = Object.fromEntries(vend.map(v => [v.id, v.name]))
      return ok(res, rows.map(o => ({ ...mapOrder(o), vendor_name: vmap[o.vendor_id] ?? '' })))
    }
    const { vendor_id, item, quantity, rate, status = 'Pending', order_date } = req.body ?? {}
    if (!vendor_id || !item || !quantity || !rate || !order_date) return err(res, 'Missing required fields: vendor_id, item, quantity, rate, order_date', 400)
    if (Number(quantity) <= 0) return err(res, 'Quantity must be positive', 400)
    if (Number(rate)     <= 0) return err(res, 'Rate must be positive', 400)
    if (!['Pending', 'Received'].includes(status)) return err(res, 'Invalid status', 400)
    const amount = Math.round(Number(quantity) * Number(rate) * 100) / 100
    return ok(res, mapOrder(await baserowCreate<BaserowOrder>(TABLE_IDS.orders, { vendor_id: Number(vendor_id), item: String(item).trim(), quantity: Number(quantity), rate: Number(rate), amount, status, order_date })), 201)
  }
  const rid = Number(id)
  if (!rid || isNaN(rid)) return err(res, 'Invalid order ID', 400)
  if (!allow(req, res, ['GET', 'PUT', 'DELETE'])) return
  if (req.method === 'GET')    return ok(res, mapOrder(await baserowGet<BaserowOrder>(TABLE_IDS.orders, rid)))
  if (req.method === 'DELETE') { await baserowDelete(TABLE_IDS.orders, rid); return ok(res, { deleted: true }) }
  const { vendor_id, item, quantity, rate, status, order_date } = req.body ?? {}
  if (quantity !== undefined && Number(quantity) <= 0) return err(res, 'Quantity must be positive', 400)
  if (rate     !== undefined && Number(rate)     <= 0) return err(res, 'Rate must be positive', 400)
  if (status && !['Pending', 'Received'].includes(status)) return err(res, 'Invalid status', 400)
  const updates: Record<string, unknown> = {}
  if (vendor_id  !== undefined) updates.vendor_id  = Number(vendor_id)
  if (item       !== undefined) updates.item        = String(item).trim()
  if (quantity   !== undefined) updates.quantity    = Number(quantity)
  if (rate       !== undefined) updates.rate        = Number(rate)
  if (quantity !== undefined || rate !== undefined) {
    const ex = await baserowGet<BaserowOrder>(TABLE_IDS.orders, rid)
    const q = quantity !== undefined ? Number(quantity) : Number(ex.quantity)
    const r = rate     !== undefined ? Number(rate)     : Number(ex.rate)
    updates.amount = Math.round(q * r * 100) / 100
  }
  if (status     !== undefined) updates.status     = status
  if (order_date !== undefined) updates.order_date = order_date
  return ok(res, mapOrder(await baserowUpdate<BaserowOrder>(TABLE_IDS.orders, rid, updates)))
}

async function handleTransport(req: VercelRequest, res: VercelResponse, id?: string) {
  const user = await requireAuth(req, res); if (!user) return
  if (!id) {
    if (!allow(req, res, ['GET', 'POST'])) return
    if (req.method === 'GET') {
      const { search, vendor_id, payment_status, city } = req.query as Record<string, string>
      const params: Record<string, string> = {}
      if (search)         params['filter__lr_number__contains']   = search
      if (vendor_id)      params['filter__vendor_id__equal']      = vendor_id
      if (payment_status) params['filter__payment_status__equal'] = payment_status
      if (city)           params['filter__city__equal']           = city
      const [rows, vend] = await Promise.all([baserowList<BaserowTransport>(TABLE_IDS.transport, params), baserowList<BaserowVendor>(TABLE_IDS.vendors)])
      const vmap = Object.fromEntries(vend.map(v => [v.id, v.name]))
      return ok(res, rows.map(t => mapTransport(t, vmap[t.vendor_id])))
    }
    const { vendor_id, lr_number, transport_name, city, item, quantity, dispatched_quantity = 0, rate, payment_status = 'Pending', transport_date } = req.body ?? {}
    if (!vendor_id || !lr_number || !transport_name || !city || !item || !quantity || !rate || !transport_date) return err(res, 'Missing required fields', 400)
    const qty = Number(quantity), dispatched = Number(dispatched_quantity), r = Number(rate)
    if (qty <= 0)         return err(res, 'Quantity must be positive', 400)
    if (r <= 0)           return err(res, 'Rate must be positive', 400)
    if (dispatched < 0)   return err(res, 'Dispatched quantity cannot be negative', 400)
    if (dispatched > qty) return err(res, 'Dispatched quantity cannot exceed total quantity', 400)
    if (!['Pending', 'Paid', 'Partial'].includes(payment_status)) return err(res, 'Invalid payment_status', 400)
    return ok(res, mapTransport(await baserowCreate<BaserowTransport>(TABLE_IDS.transport, { vendor_id: Number(vendor_id), lr_number: String(lr_number).trim(), transport_name: String(transport_name).trim(), city: String(city).trim(), item: String(item).trim(), quantity: qty, dispatched_quantity: dispatched, remaining_quantity: Math.max(0, qty - dispatched), rate: r, amount: Math.round(qty * r * 100) / 100, payment_status, transport_date })), 201)
  }
  const rid = Number(id)
  if (!rid || isNaN(rid)) return err(res, 'Invalid transport ID', 400)
  if (!allow(req, res, ['GET', 'PUT', 'DELETE'])) return
  if (req.method === 'GET')    return ok(res, mapTransport(await baserowGet<BaserowTransport>(TABLE_IDS.transport, rid)))
  if (req.method === 'DELETE') { await baserowDelete(TABLE_IDS.transport, rid); return ok(res, { deleted: true }) }
  const body = req.body ?? {}
  const ex = await baserowGet<BaserowTransport>(TABLE_IDS.transport, rid)
  const qty        = body.quantity            !== undefined ? Number(body.quantity)            : Number(ex.quantity)
  const dispatched = body.dispatched_quantity !== undefined ? Number(body.dispatched_quantity) : Number(ex.dispatched_quantity)
  const rate       = body.rate                !== undefined ? Number(body.rate)                : Number(ex.rate)
  if (qty <= 0)         return err(res, 'Quantity must be positive', 400)
  if (rate <= 0)        return err(res, 'Rate must be positive', 400)
  if (dispatched < 0)   return err(res, 'Dispatched quantity cannot be negative', 400)
  if (dispatched > qty) return err(res, 'Dispatched quantity cannot exceed total quantity', 400)
  const updates: Record<string, unknown> = { quantity: qty, dispatched_quantity: dispatched, remaining_quantity: Math.max(0, qty - dispatched), rate, amount: Math.round(qty * rate * 100) / 100 }
  if (body.vendor_id      !== undefined) updates.vendor_id      = Number(body.vendor_id)
  if (body.lr_number      !== undefined) updates.lr_number      = String(body.lr_number).trim()
  if (body.transport_name !== undefined) updates.transport_name = String(body.transport_name).trim()
  if (body.city           !== undefined) updates.city           = String(body.city).trim()
  if (body.item           !== undefined) updates.item           = String(body.item).trim()
  if (body.transport_date !== undefined) updates.transport_date = body.transport_date
  if (body.payment_status !== undefined) {
    if (!['Pending', 'Paid', 'Partial'].includes(body.payment_status)) return err(res, 'Invalid payment_status', 400)
    updates.payment_status = body.payment_status
  }
  return ok(res, mapTransport(await baserowUpdate<BaserowTransport>(TABLE_IDS.transport, rid, updates)))
}

// ─── Main Router ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const segments = (req.query.route as string[]) || []
  const [seg0, seg1] = segments

  try {
    // /api/auth/login|me|logout
    if (seg0 === 'auth' && seg1)        return await handleAuth(req, res, seg1)
    // /api/dashboard/stats
    if (seg0 === 'dashboard')           return await handleDashboardStats(req, res)
    // /api/hissab
    if (seg0 === 'hissab')              return await handleHissab(req, res)
    // /api/vendors or /api/vendors/:id
    if (seg0 === 'vendors')             return await handleVendors(req, res, seg1)
    // /api/orders or /api/orders/:id
    if (seg0 === 'orders')              return await handleOrders(req, res, seg1)
    // /api/transport or /api/transport/:id
    if (seg0 === 'transport')           return await handleTransport(req, res, seg1)

    return err(res, 'Not found', 404)
  } catch (e: any) {
    console.error(`[API Error] ${req.method} /api/${segments.join('/')}:`, e.message)
    return err(res, e.message || 'Internal server error', 500)
  }
}
