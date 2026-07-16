/**
 * Single Vercel serverless function that handles all /api/* routes.
 * This keeps the deployment within Hobby plan's 12-function limit.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─── ENV ─────────────────────────────────────────────────────────────────────
const ADMIN_USERNAME  = process.env.ADMIN_USERNAME  || 'admin'
const ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD  || 'changeme'
const ADMIN_NAME      = process.env.ADMIN_NAME      || 'Administrator'
const JWT_SECRET      = process.env.JWT_SECRET      || 'dev-secret'
const BASEROW_API_URL = process.env.BASEROW_API_URL || 'https://api.baserow.io'
const BASEROW_TOKEN   = process.env.BASEROW_TOKEN   || ''
const TABLE_IDS = {
  vendors:   Number(process.env.BASEROW_VENDORS_TABLE_ID),
  orders:    Number(process.env.BASEROW_ORDERS_TABLE_ID),
  transport: Number(process.env.BASEROW_TRANSPORT_TABLE_ID),
}

// ─── JWT ──────────────────────────────────────────────────────────────────────
const b64enc = (s: string) => Buffer.from(s).toString('base64url')
const b64dec = (s: string) => Buffer.from(s, 'base64url').toString('utf8')

async function importKey(usage: 'sign' | 'verify') {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, [usage])
}

async function signJWT(payload: Record<string, unknown>) {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 60 * 60 * 24 * 7
  const header = b64enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body   = b64enc(JSON.stringify({ ...payload, iat, exp }))
  const data   = `${header}.${body}`
  const key    = await importKey('sign')
  const sig    = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))).toString('base64url')
  return `${data}.${sig}`
}

async function verifyJWT(token: string) {
  try {
    const [header, body, sig] = token.split('.')
    if (!header || !body || !sig) return null
    const data  = `${header}.${body}`
    const key   = await importKey('verify')
    const valid = await crypto.subtle.verify('HMAC', key, Buffer.from(sig, 'base64url'), new TextEncoder().encode(data))
    if (!valid) return null
    const payload = JSON.parse(b64dec(body))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map(c => { const [k, ...v] = c.trim().split('='); return [k?.trim() ?? '', v.join('=').trim()] }).filter(([k]) => k)
  )
}

async function getAuthUser(req: VercelRequest) {
  const token = parseCookies(req.headers.cookie || '')['vtms_token']
  return token ? verifyJWT(token) : null
}

// ─── Baserow ──────────────────────────────────────────────────────────────────
const brHeaders = () => ({ Authorization: `Token ${BASEROW_TOKEN}`, 'Content-Type': 'application/json' })

async function brList(tableId: number, params: Record<string, string> = {}) {
  const url = new URL(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/`)
  url.searchParams.set('user_field_names', 'true')
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v)
  const r = await fetch(url.toString(), { headers: brHeaders() })
  if (!r.ok) throw new Error(`Baserow list ${r.status}: ${await r.text()}`)
  return (await r.json()).results
}

async function brGet(tableId: number, id: number) {
  const r = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/${id}/?user_field_names=true`, { headers: brHeaders() })
  if (!r.ok) throw new Error(`Baserow get ${r.status}`)
  return r.json()
}

async function brCreate(tableId: number, body: unknown) {
  const r = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/?user_field_names=true`,
    { method: 'POST', headers: brHeaders(), body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`Baserow create ${r.status}: ${await r.text()}`)
  return r.json()
}

async function brUpdate(tableId: number, id: number, body: unknown) {
  const r = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/${id}/?user_field_names=true`,
    { method: 'PATCH', headers: brHeaders(), body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`Baserow update ${r.status}`)
  return r.json()
}

async function brDelete(tableId: number, id: number) {
  const r = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/${id}/`,
    { method: 'DELETE', headers: brHeaders() })
  if (!r.ok) throw new Error(`Baserow delete ${r.status}`)
}

// ─── Response helpers ─────────────────────────────────────────────────────────
const ok  = (res: VercelResponse, data: unknown, status = 200) => res.status(status).json({ success: true, data })
const err = (res: VercelResponse, msg: string, status = 400)   => res.status(status).json({ success: false, error: msg, message: msg })

async function requireAuth(req: VercelRequest, res: VercelResponse) {
  const user = await getAuthUser(req)
  if (!user) { err(res, 'Unauthorized', 401); return null }
  return user
}

// ─── Mappers ──────────────────────────────────────────────────────────────────
const mapVendor    = (r: any) => ({ id: r.id, name: r.name, created_at: r.created_on })
const mapOrder     = (r: any) => ({ id: r.id, vendor_id: r.vendor_id, vendor_name: r.vendor_name ?? '', item: r.item, quantity: Number(r.quantity), rate: Number(r.rate), amount: Number(r.amount), status: r.status?.value ?? r.status, order_date: r.order_date })
const mapTransport = (r: any, vendorName?: string) => ({ id: r.id, vendor_id: r.vendor_id, vendor_name: vendorName ?? r.vendor_name ?? '', lr_number: r.lr_number, transport_name: r.transport_name, city: r.city, item: r.item, quantity: Number(r.quantity), dispatched_quantity: Number(r.dispatched_quantity), remaining_quantity: Number(r.remaining_quantity), rate: Number(r.rate), amount: Number(r.amount), payment_status: r.payment_status?.value ?? r.payment_status, transport_date: r.transport_date })

// ─── Route handlers ───────────────────────────────────────────────────────────

async function handleAuth(req: VercelRequest, res: VercelResponse, action: string) {
  if (action === 'login') {
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405)
    const { username, password } = req.body ?? {}
    if (!username || !password) return err(res, 'Username and password required', 400)
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      await new Promise(r => setTimeout(r, 500))
      return err(res, 'Invalid credentials', 401)
    }
    const token  = await signJWT({ sub: username, name: ADMIN_NAME })
    const cookie = `vtms_token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}`
    res.setHeader('Set-Cookie', cookie)
    return res.status(200).json({ success: true, user: { username, name: ADMIN_NAME } })
  }
  if (action === 'logout') {
    res.setHeader('Set-Cookie', 'vtms_token=; HttpOnly; Path=/; Max-Age=0')
    return res.status(200).json({ success: true })
  }
  if (action === 'me') {
    if (req.method !== 'GET') return err(res, 'Method not allowed', 405)
    const user = await getAuthUser(req)
    if (!user) return err(res, 'Unauthorized', 401)
    return res.status(200).json({ success: true, user: { username: user.sub, name: user.name } })
  }
  return err(res, 'Not found', 404)
}

async function handleDashboard(req: VercelRequest, res: VercelResponse) {
  if (!await requireAuth(req, res)) return
  const [vendors, orders, transport] = await Promise.all([
    brList(TABLE_IDS.vendors), brList(TABLE_IDS.orders), brList(TABLE_IDS.transport)
  ])
  return ok(res, {
    total_vendors:   vendors.length,
    total_orders:    orders.length,
    pending_orders:  orders.filter((o: any) => (o.status?.value ?? o.status) === 'Pending').length,
    total_transport: transport.length,
    pending_payments: transport.filter((t: any) => (t.payment_status?.value ?? t.payment_status) === 'Pending').length,
    total_dispatched_quantity: transport.reduce((s: number, t: any) => s + Number(t.dispatched_quantity), 0),
    total_hissab_amount: Math.round(transport.reduce((s: number, t: any) => s + Number(t.dispatched_quantity) * Number(t.rate), 0) * 100) / 100,
  })
}

async function handleVendors(req: VercelRequest, res: VercelResponse, id?: string) {
  if (!await requireAuth(req, res)) return
  if (!id) {
    if (req.method === 'GET') {
      const { search } = req.query as Record<string, string>
      const params: Record<string, string> = {}
      if (search) params['filter__name__contains'] = search
      return ok(res, (await brList(TABLE_IDS.vendors, params)).map(mapVendor))
    }
    if (req.method === 'POST') {
      const { name } = req.body ?? {}
      if (!name || typeof name !== 'string' || name.trim().length < 2) return err(res, 'Vendor name must be at least 2 characters', 400)
      return ok(res, mapVendor(await brCreate(TABLE_IDS.vendors, { name: name.trim() })), 201)
    }
  } else {
    const rid = Number(id)
    if (!rid) return err(res, 'Invalid vendor ID', 400)
    if (req.method === 'GET')    return ok(res, mapVendor(await brGet(TABLE_IDS.vendors, rid)))
    if (req.method === 'PUT') {
      const { name } = req.body ?? {}
      if (!name || name.trim().length < 2) return err(res, 'Vendor name must be at least 2 characters', 400)
      return ok(res, mapVendor(await brUpdate(TABLE_IDS.vendors, rid, { name: name.trim() })))
    }
    if (req.method === 'DELETE') { await brDelete(TABLE_IDS.vendors, rid); return ok(res, { deleted: true }) }
  }
  return err(res, 'Method not allowed', 405)
}

async function handleOrders(req: VercelRequest, res: VercelResponse, id?: string) {
  if (!await requireAuth(req, res)) return
  if (!id) {
    if (req.method === 'GET') {
      const { search, vendor_id, status } = req.query as Record<string, string>
      const params: Record<string, string> = {}
      if (search)    params['filter__item__contains']   = search
      if (vendor_id) params['filter__vendor_id__equal'] = vendor_id
      if (status)    params['filter__status__equal']    = status
      const [rows, vend] = await Promise.all([brList(TABLE_IDS.orders, params), brList(TABLE_IDS.vendors)])
      const vmap = Object.fromEntries(vend.map((v: any) => [v.id, v.name]))
      return ok(res, rows.map((o: any) => ({ ...mapOrder(o), vendor_name: (vmap as any)[o.vendor_id] ?? '' })))
    }
    if (req.method === 'POST') {
      const { vendor_id, item, quantity, rate, status = 'Pending', order_date } = req.body ?? {}
      if (!vendor_id || !item || !quantity || !rate || !order_date) return err(res, 'Missing required fields', 400)
      if (Number(quantity) <= 0) return err(res, 'Quantity must be positive', 400)
      if (Number(rate) <= 0)     return err(res, 'Rate must be positive', 400)
      if (!['Pending', 'Received'].includes(status)) return err(res, 'Invalid status', 400)
      const amount = Math.round(Number(quantity) * Number(rate) * 100) / 100
      return ok(res, mapOrder(await brCreate(TABLE_IDS.orders, { vendor_id: Number(vendor_id), item: String(item).trim(), quantity: Number(quantity), rate: Number(rate), amount, status, order_date })), 201)
    }
  } else {
    const rid = Number(id)
    if (!rid) return err(res, 'Invalid order ID', 400)
    if (req.method === 'GET')    return ok(res, mapOrder(await brGet(TABLE_IDS.orders, rid)))
    if (req.method === 'PUT') {
      const body = req.body ?? {}
      const { vendor_id, item, quantity, rate, status, order_date } = body
      if (quantity !== undefined && Number(quantity) <= 0) return err(res, 'Quantity must be positive', 400)
      if (rate     !== undefined && Number(rate)     <= 0) return err(res, 'Rate must be positive', 400)
      if (status && !['Pending', 'Received'].includes(status)) return err(res, 'Invalid status', 400)
      const updates: Record<string, unknown> = {}
      if (vendor_id  !== undefined) updates.vendor_id  = Number(vendor_id)
      if (item       !== undefined) updates.item        = String(item).trim()
      if (quantity   !== undefined) updates.quantity    = Number(quantity)
      if (rate       !== undefined) updates.rate        = Number(rate)
      if (quantity !== undefined || rate !== undefined) {
        const ex = await brGet(TABLE_IDS.orders, rid)
        const q  = quantity !== undefined ? Number(quantity) : Number(ex.quantity)
        const r  = rate     !== undefined ? Number(rate)     : Number(ex.rate)
        updates.amount = Math.round(q * r * 100) / 100
      }
      if (status     !== undefined) updates.status     = status
      if (order_date !== undefined) updates.order_date = order_date
      return ok(res, mapOrder(await brUpdate(TABLE_IDS.orders, rid, updates)))
    }
    if (req.method === 'DELETE') { await brDelete(TABLE_IDS.orders, rid); return ok(res, { deleted: true }) }
  }
  return err(res, 'Method not allowed', 405)
}

async function handleTransport(req: VercelRequest, res: VercelResponse, id?: string) {
  if (!await requireAuth(req, res)) return
  if (!id) {
    if (req.method === 'GET') {
      const { search, vendor_id, payment_status, city } = req.query as Record<string, string>
      const params: Record<string, string> = {}
      if (search)         params['filter__lr_number__contains']   = search
      if (vendor_id)      params['filter__vendor_id__equal']      = vendor_id
      if (payment_status) params['filter__payment_status__equal'] = payment_status
      if (city)           params['filter__city__equal']           = city
      const [rows, vend] = await Promise.all([brList(TABLE_IDS.transport, params), brList(TABLE_IDS.vendors)])
      const vmap = Object.fromEntries(vend.map((v: any) => [v.id, v.name]))
      return ok(res, rows.map((t: any) => mapTransport(t, (vmap as any)[t.vendor_id])))
    }
    if (req.method === 'POST') {
      const { vendor_id, lr_number, transport_name, city, item, quantity, dispatched_quantity = 0, rate, payment_status = 'Pending', transport_date } = req.body ?? {}
      if (!vendor_id || !lr_number || !transport_name || !city || !item || !quantity || !rate || !transport_date) return err(res, 'Missing required fields', 400)
      const qty = Number(quantity), disp = Number(dispatched_quantity), r = Number(rate)
      if (qty <= 0)       return err(res, 'Quantity must be positive', 400)
      if (r <= 0)         return err(res, 'Rate must be positive', 400)
      if (disp < 0)       return err(res, 'Dispatched cannot be negative', 400)
      if (disp > qty)     return err(res, 'Dispatched cannot exceed quantity', 400)
      if (!['Pending', 'Paid', 'Partial'].includes(payment_status)) return err(res, 'Invalid payment_status', 400)
      return ok(res, mapTransport(await brCreate(TABLE_IDS.transport, { vendor_id: Number(vendor_id), lr_number: String(lr_number).trim(), transport_name: String(transport_name).trim(), city: String(city).trim(), item: String(item).trim(), quantity: qty, dispatched_quantity: disp, remaining_quantity: Math.max(0, qty - disp), rate: r, amount: Math.round(qty * r * 100) / 100, payment_status, transport_date })), 201)
    }
  } else {
    const rid = Number(id)
    if (!rid) return err(res, 'Invalid transport ID', 400)
    if (req.method === 'GET')    return ok(res, mapTransport(await brGet(TABLE_IDS.transport, rid)))
    if (req.method === 'PUT') {
      const body = req.body ?? {}
      const ex   = await brGet(TABLE_IDS.transport, rid)
      const qty  = body.quantity            !== undefined ? Number(body.quantity)            : Number(ex.quantity)
      const disp = body.dispatched_quantity !== undefined ? Number(body.dispatched_quantity) : Number(ex.dispatched_quantity)
      const r    = body.rate                !== undefined ? Number(body.rate)                : Number(ex.rate)
      if (qty <= 0)   return err(res, 'Quantity must be positive', 400)
      if (r <= 0)     return err(res, 'Rate must be positive', 400)
      if (disp < 0)   return err(res, 'Dispatched cannot be negative', 400)
      if (disp > qty) return err(res, 'Dispatched cannot exceed quantity', 400)
      const updates: Record<string, unknown> = { quantity: qty, dispatched_quantity: disp, remaining_quantity: Math.max(0, qty - disp), rate: r, amount: Math.round(qty * r * 100) / 100 }
      if (body.vendor_id       !== undefined) updates.vendor_id       = Number(body.vendor_id)
      if (body.lr_number       !== undefined) updates.lr_number       = String(body.lr_number).trim()
      if (body.transport_name  !== undefined) updates.transport_name  = String(body.transport_name).trim()
      if (body.city            !== undefined) updates.city            = String(body.city).trim()
      if (body.item            !== undefined) updates.item            = String(body.item).trim()
      if (body.transport_date  !== undefined) updates.transport_date  = body.transport_date
      if (body.payment_status  !== undefined) {
        if (!['Pending', 'Paid', 'Partial'].includes(body.payment_status)) return err(res, 'Invalid payment_status', 400)
        updates.payment_status = body.payment_status
      }
      return ok(res, mapTransport(await brUpdate(TABLE_IDS.transport, rid, updates)))
    }
    if (req.method === 'DELETE') { await brDelete(TABLE_IDS.transport, rid); return ok(res, { deleted: true }) }
  }
  return err(res, 'Method not allowed', 405)
}

async function handleHissab(req: VercelRequest, res: VercelResponse) {
  if (!await requireAuth(req, res)) return
  const { vendor_id, city } = req.query as Record<string, string>
  const params: Record<string, string> = {}
  if (vendor_id) params['filter__vendor_id__equal'] = vendor_id
  if (city)      params['filter__city__equal']      = city
  const [rows, vend] = await Promise.all([brList(TABLE_IDS.transport, params), brList(TABLE_IDS.vendors)])
  const vmap = Object.fromEntries(vend.map((v: any) => [v.id, v.name]))
  const entries = rows.map((t: any) => {
    const dq = Number(t.dispatched_quantity), r = Number(t.rate)
    return { transport_id: t.id, vendor_id: t.vendor_id, vendor_name: (vmap as any)[t.vendor_id] ?? '', city: t.city, item: t.item, lr_number: t.lr_number, dispatched_quantity: dq, rate: r, hissab_amount: Math.round(dq * r * 100) / 100, transport_date: t.transport_date, payment_status: t.payment_status?.value ?? t.payment_status }
  })
  return ok(res, { entries, total_hissab_amount: Math.round(entries.reduce((s: number, e: any) => s + e.hissab_amount, 0) * 100) / 100, total_dispatched_quantity: entries.reduce((s: number, e: any) => s + e.dispatched_quantity, 0) })
}

// ─── Main router ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Parse the path — Vercel strips /api prefix, so path starts after that
  const raw  = (req.url ?? '/').split('?')[0].replace(/\/$/, '') || '/'
  // Normalize: handle both /api/... (local dev) and /... (Vercel, already stripped)
  const path = raw.startsWith('/api') ? raw.slice(4) : raw

  try {
    // Auth
    if (path === '/auth/login')  return await handleAuth(req, res, 'login')
    if (path === '/auth/logout') return await handleAuth(req, res, 'logout')
    if (path === '/auth/me')     return await handleAuth(req, res, 'me')

    // Dashboard
    if (path === '/dashboard/stats') return await handleDashboard(req, res)

    // Hissab
    if (path === '/hissab') return await handleHissab(req, res)

    // Vendors
    const vm = path.match(/^\/vendors(?:\/(\d+))?$/)
    if (vm) return await handleVendors(req, res, vm[1])

    // Orders
    const om = path.match(/^\/orders(?:\/(\d+))?$/)
    if (om) return await handleOrders(req, res, om[1])

    // Transport
    const tm = path.match(/^\/transport(?:\/(\d+))?$/)
    if (tm) return await handleTransport(req, res, tm[1])

    return err(res, 'Not found', 404)
  } catch (e: any) {
    console.error('[API Error]', e)
    return err(res, e?.message || 'Internal server error', 500)
  }
}
