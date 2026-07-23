/**
 * dev-server.mjs — Local API server for development
 * Mirrors all Vercel serverless functions exactly.
 * No extra dependencies needed — uses only Node.js built-ins.
 *
 * Usage:
 *   Terminal 1: node dev-server.mjs
 *   Terminal 2: npm run dev
 *   Open:       http://localhost:5173
 */

import http from 'node:http'
import { readFileSync } from 'node:fs'

// ─── Load .env ────────────────────────────────────────────────────────────────
try {
  const env = readFileSync('.env', 'utf8')
  for (const line of env.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    const v = t.slice(i + 1).trim()
    if (!(k in process.env)) process.env[k] = v
  }
} catch { /* .env not found, use process.env as-is */ }

const PORT = 3000
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const ADMIN_NAME    = process.env.ADMIN_NAME     || 'Administrator'
const JWT_SECRET    = process.env.JWT_SECRET     || 'dev-secret-change-in-production'
const BASEROW_API_URL = process.env.BASEROW_API_URL || 'https://api.baserow.io'
const BASEROW_TOKEN   = process.env.BASEROW_TOKEN   || ''
const TABLE_IDS = {
  vendors:   Number(process.env.BASEROW_VENDORS_TABLE_ID),
  orders:    Number(process.env.BASEROW_ORDERS_TABLE_ID),
  transport: Number(process.env.BASEROW_TRANSPORT_TABLE_ID),
}

// ─── JWT ──────────────────────────────────────────────────────────────────────
const enc = s => Buffer.from(s).toString('base64url')
const dec = s => Buffer.from(s, 'base64url').toString('utf8')

async function importKey(usage) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, [usage]
  )
}

async function signJWT(payload) {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 60 * 60 * 24 * 7
  const header = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body   = enc(JSON.stringify({ ...payload, iat, exp }))
  const data   = `${header}.${body}`
  const key    = await importKey('sign')
  const sig    = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))).toString('base64url')
  return `${data}.${sig}`
}

async function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split('.')
    if (!header || !body || !sig) return null
    const data  = `${header}.${body}`
    const key   = await importKey('verify')
    const valid = await crypto.subtle.verify('HMAC', key, Buffer.from(sig, 'base64url'), new TextEncoder().encode(data))
    if (!valid) return null
    const payload = JSON.parse(dec(body))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map(c => { const [k, ...v] = c.trim().split('='); return [k?.trim(), v.join('=').trim()] }).filter(([k]) => k)
  )
}

async function getAuthUser(req) {
  const token = parseCookies(req.headers.cookie || '')['vtms_token']
  return token ? verifyJWT(token) : null
}

// ─── Baserow helpers ──────────────────────────────────────────────────────────
const brHeaders = () => ({ Authorization: `Token ${BASEROW_TOKEN}`, 'Content-Type': 'application/json' })

async function brList(tableId, params = {}) {
  const url = new URL(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/`)
  url.searchParams.set('user_field_names', 'true')
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), { headers: brHeaders() })
  if (!res.ok) throw new Error(`Baserow list error: ${res.status} ${await res.text()}`)
  return (await res.json()).results
}

async function brGet(tableId, id) {
  const res = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/${id}/?user_field_names=true`, { headers: brHeaders() })
  if (!res.ok) throw new Error(`Baserow get error: ${res.status}`)
  return res.json()
}

async function brCreate(tableId, body) {
  const res = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/?user_field_names=true`, {
    method: 'POST', headers: brHeaders(), body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Baserow create error: ${res.status} ${await res.text()}`)
  return res.json()
}

async function brUpdate(tableId, id, body) {
  const res = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/${id}/?user_field_names=true`, {
    method: 'PATCH', headers: brHeaders(), body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Baserow update error: ${res.status}`)
  return res.json()
}

async function brDelete(tableId, id) {
  const res = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/${id}/`, { method: 'DELETE', headers: brHeaders() })
  if (!res.ok) throw new Error(`Baserow delete error: ${res.status}`)
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function send(res, status, data, extra = {}) {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS, ...extra })
  res.end(body)
}

function ok(res, data, status = 200)    { send(res, status, { success: true, data }) }
function err(res, msg, status = 400)    { send(res, status, { success: false, error: msg, message: msg }) }

function getBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', c => (raw += c))
    req.on('end',  () => { try { resolve(raw ? JSON.parse(raw) : {}) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

function getQuery(req) {
  return Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
}

async function requireAuth(req, res) {
  const user = await getAuthUser(req)
  if (!user) { err(res, 'Unauthorized', 401); return null }
  return user
}

// ─── Mappers (match production handlers exactly) ──────────────────────────────
const mapVendor   = r => ({ id: r.id, name: r.name, created_at: r.created_on })
const mapOrder    = r => ({
  id: r.id, customer_id: r.customer_id ?? r.vendor_id, customer_name: r.customer_name ?? r.vendor_name ?? '',
  item: r.item, quantity: Number(r.quantity ?? 1), rate: Number(r.rate ?? 0),
  amount: Number(r.amount ?? 0), status: r.status?.value ?? r.status ?? 'Received', order_date: r.order_date,
  is_history: Boolean(r.is_history),
})
const mapTransport = (r, vendorName) => ({
  id: r.id, transport_master_id: r.vendor_id,
  transport_name: r.transport_name || vendorName || r.vendor_name || 'Transport',
  lr_number: r.lr_number, city: r.city || '', item: r.item,
  quantity: Number(r.quantity), dispatched_quantity: Number(r.dispatched_quantity ?? r.quantity),
  remaining_quantity: Number(r.remaining_quantity ?? 0), rate: Number(r.rate),
  amount: Number(r.amount ?? (Number(r.quantity) * Number(r.rate))),
  payment_status: (r.payment_status?.value ?? r.payment_status) === 'Paid' ? 'Paid' : 'Pending',
  transport_date: r.transport_date || r.booking_date,
  booking_date: r.booking_date || r.transport_date,
})

// ─── Route handlers ───────────────────────────────────────────────────────────

// Auth
async function authLogin(req, res) {
  const { username, password } = await getBody(req)
  if (!username || !password) return err(res, 'Username and password are required', 400)
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    await new Promise(r => setTimeout(r, 500))
    return err(res, 'Invalid credentials', 401)
  }
  const token  = await signJWT({ sub: username, name: ADMIN_NAME })
  const cookie = `vtms_token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}`
  send(res, 200, { success: true, user: { username, name: ADMIN_NAME } }, { 'Set-Cookie': cookie })
}

async function authMe(req, res) {
  const user = await getAuthUser(req)
  if (!user) return err(res, 'Unauthorized', 401)
  send(res, 200, { success: true, user: { username: user.sub, name: user.name } })
}

function authLogout(req, res) {
  send(res, 200, { success: true }, { 'Set-Cookie': 'vtms_token=; HttpOnly; Path=/; Max-Age=0' })
}

// Dashboard stats
async function dashboardStats(req, res) {
  if (!await requireAuth(req, res)) return
  try {
    const [vendors, orders, transport] = await Promise.all([
      brList(TABLE_IDS.vendors), brList(TABLE_IDS.orders), brList(TABLE_IDS.transport)
    ])
    ok(res, {
      total_customers: vendors.length,
      total_transports_master: vendors.length,
      total_orders: orders.length,
      total_transport: transport.length,
      pending_payments: transport.filter(t => (t.payment_status?.value ?? t.payment_status) !== 'Paid').length,
      total_hissab_amount: Math.round(transport.reduce((s, t) => s + Number(t.quantity ?? t.dispatched_quantity ?? 0) * Number(t.rate ?? 0), 0) * 100) / 100,
    })
  } catch (e) { err(res, e.message, 500) }
}

// Vendors / Master Data
async function vendors(req, res, id) {
  if (!await requireAuth(req, res)) return
  try {
    if (!id) {
      if (req.method === 'GET') {
        const { search } = getQuery(req)
        const params = {}
        if (search) params['filter__name__contains'] = search
        return ok(res, (await brList(TABLE_IDS.vendors, params)).map(mapVendor))
      }
      if (req.method === 'POST') {
        const { name } = await getBody(req)
        if (!name || typeof name !== 'string' || name.trim().length < 2)
          return err(res, 'Name must be at least 2 characters', 400)
        return ok(res, mapVendor(await brCreate(TABLE_IDS.vendors, { name: name.trim() })), 201)
      }
    } else {
      const rid = Number(id)
      if (!rid) return err(res, 'Invalid ID', 400)
      if (req.method === 'GET')    return ok(res, mapVendor(await brGet(TABLE_IDS.vendors, rid)))
      if (req.method === 'PUT') {
        const { name } = await getBody(req)
        if (!name || name.trim().length < 2) return err(res, 'Name must be at least 2 characters', 400)
        return ok(res, mapVendor(await brUpdate(TABLE_IDS.vendors, rid, { name: name.trim() })))
      }
      if (req.method === 'DELETE') { await brDelete(TABLE_IDS.vendors, rid); return ok(res, { deleted: true }) }
    }
    err(res, 'Method not allowed', 405)
  } catch (e) { err(res, e.message, 500) }
}

// Orders
async function orders(req, res, id) {
  if (!await requireAuth(req, res)) return
  try {
    if (!id) {
      if (req.method === 'GET') {
        const { search, customer_id, vendor_id, is_history } = getQuery(req)
        const params = {}
        if (search) params['filter__item__contains'] = search
        const cid = customer_id || vendor_id
        if (cid) params['filter__vendor_id__equal'] = cid
        const [rows, vend] = await Promise.all([brList(TABLE_IDS.orders, params), brList(TABLE_IDS.vendors)])
        const vmap = Object.fromEntries(vend.map(v => [v.id, v.name]))
        let mapped = rows.map(o => ({ ...mapOrder(o), customer_name: vmap[o.vendor_id] ?? o.customer_name ?? '' }))
        if (is_history !== undefined) {
          const histBool = is_history === 'true'
          mapped = mapped.filter(o => Boolean(o.is_history) === histBool)
        }
        return ok(res, mapped)
      }
      if (req.method === 'POST') {
        const { customer_id, vendor_id, item, order_date, is_history = false } = await getBody(req)
        const cid = customer_id || vendor_id
        if (!cid || !item || !order_date)
          return err(res, 'Missing required fields: customer_id, item, order_date', 400)
        const row = await brCreate(TABLE_IDS.orders, {
          vendor_id: Number(cid), item: String(item).trim(), quantity: 1, rate: 1, amount: 1, status: 'Received', order_date, is_history: Boolean(is_history)
        })
        return ok(res, mapOrder(row), 201)
      }
    } else {
      const rid = Number(id)
      if (!rid) return err(res, 'Invalid order ID', 400)
      if (req.method === 'GET') return ok(res, mapOrder(await brGet(TABLE_IDS.orders, rid)))
      if (req.method === 'PUT') {
        const body = await getBody(req)
        const updates = {}
        if (body.customer_id !== undefined || body.vendor_id !== undefined) updates.vendor_id = Number(body.customer_id || body.vendor_id)
        if (body.item !== undefined) updates.item = String(body.item).trim()
        if (body.order_date !== undefined) updates.order_date = body.order_date
        if (body.is_history !== undefined) updates.is_history = Boolean(body.is_history)
        return ok(res, mapOrder(await brUpdate(TABLE_IDS.orders, rid, updates)))
      }
      if (req.method === 'DELETE') { await brDelete(TABLE_IDS.orders, rid); return ok(res, { deleted: true }) }
    }
    err(res, 'Method not allowed', 405)
  } catch (e) { err(res, e.message, 500) }
}

// Transport
async function transport(req, res, id) {
  if (!await requireAuth(req, res)) return
  try {
    if (!id) {
      if (req.method === 'GET') {
        const { search, transport_name, payment_status } = getQuery(req)
        const [rows, vend] = await Promise.all([brList(TABLE_IDS.transport), brList(TABLE_IDS.vendors)])
        const vmap = Object.fromEntries(vend.map(v => [v.id, v.name]))
        let mapped = rows.map(t => mapTransport(t, vmap[t.vendor_id]))
        if (transport_name) mapped = mapped.filter(t => (t.transport_name || '').toLowerCase().includes(transport_name.toLowerCase()))
        if (payment_status) mapped = mapped.filter(t => t.payment_status === payment_status)
        if (search) {
          const q = search.toLowerCase()
          mapped = mapped.filter(t =>
            (t.lr_number || '').toLowerCase().includes(q) ||
            (t.transport_name || '').toLowerCase().includes(q)
          )
        }
        return ok(res, mapped)
      }
      if (req.method === 'POST') {
        const { transport_name, lr_number, item, quantity, rate, payment_status = 'Pending', booking_date, transport_date, vendor_id } = await getBody(req)
        const dt = booking_date || transport_date
        const tName = transport_name || 'Transport'
        if (!lr_number || !tName || !item || !quantity || !rate || !dt)
          return err(res, 'Missing required fields', 400)
        const qty = Number(quantity), r = Number(rate)
        if (qty <= 0) return err(res, 'Quantity must be positive', 400)
        if (r <= 0)   return err(res, 'Rate must be positive', 400)
        const status = payment_status === 'Paid' ? 'Paid' : 'Pending'
        const amount = Math.round(qty * r * 100) / 100
        const row = await brCreate(TABLE_IDS.transport, {
          vendor_id: Number(vendor_id || 1), lr_number: String(lr_number).trim(), transport_name: String(tName).trim(), city: '', item: String(item).trim(), quantity: qty, dispatched_quantity: qty, remaining_quantity: 0, rate: r, amount, payment_status: status, transport_date: dt
        })
        return ok(res, mapTransport(row), 201)
      }
    } else {
      const rid = Number(id)
      if (!rid) return err(res, 'Invalid transport ID', 400)
      if (req.method === 'GET') return ok(res, mapTransport(await brGet(TABLE_IDS.transport, rid)))
      if (req.method === 'PUT') {
        const body = await getBody(req)
        const ex   = await brGet(TABLE_IDS.transport, rid)
        const qty  = body.quantity !== undefined ? Number(body.quantity) : Number(ex.quantity)
        const rate = body.rate !== undefined ? Number(body.rate) : Number(ex.rate)
        const updates = { quantity: qty, dispatched_quantity: qty, remaining_quantity: 0, rate, amount: Math.round(qty * rate * 100) / 100 }
        if (body.lr_number !== undefined) updates.lr_number = String(body.lr_number).trim()
        if (body.transport_name !== undefined) updates.transport_name = String(body.transport_name).trim()
        if (body.item !== undefined) updates.item = String(body.item).trim()
        if (body.booking_date !== undefined || body.transport_date !== undefined) updates.transport_date = body.booking_date || body.transport_date
        if (body.payment_status !== undefined) updates.payment_status = body.payment_status === 'Paid' ? 'Paid' : 'Pending'
        return ok(res, mapTransport(await brUpdate(TABLE_IDS.transport, rid, updates)))
      }
      if (req.method === 'DELETE') { await brDelete(TABLE_IDS.transport, rid); return ok(res, { deleted: true }) }
    }
    err(res, 'Method not allowed', 405)
  } catch (e) { err(res, e.message, 500) }
}

// Hissab
async function hissab(req, res) {
  if (!await requireAuth(req, res)) return
  try {
    const { search, payment_status, transport_name } = getQuery(req)
    const [rows, vend] = await Promise.all([brList(TABLE_IDS.transport), brList(TABLE_IDS.vendors)])
    const vmap = Object.fromEntries(vend.map(v => [v.id, v.name]))
    let entries = rows.map(t => {
      const qty  = Number(t.quantity ?? t.dispatched_quantity ?? 0)
      const rate = Number(t.rate ?? 0)
      return {
        transport_id: t.id,
        transport_name: t.transport_name || vmap[t.vendor_id] || 'Transport',
        item: t.item,
        lr_number: t.lr_number,
        quantity: qty,
        rate,
        amount: Math.round(qty * rate * 100) / 100,
        booking_date: t.transport_date || t.booking_date,
        payment_status: (t.payment_status?.value ?? t.payment_status) === 'Paid' ? 'Paid' : 'Pending',
      }
    })
    if (payment_status) entries = entries.filter(e => e.payment_status === payment_status)
    if (transport_name) entries = entries.filter(e => e.transport_name.toLowerCase().includes(transport_name.toLowerCase()))
    if (search) {
      const q = search.toLowerCase()
      entries = entries.filter(e =>
        (e.transport_name || '').toLowerCase().includes(q) ||
        (e.lr_number || '').toLowerCase().includes(q)
      )
    }
    ok(res, {
      entries,
      total_hissab_amount: Math.round(entries.reduce((s, e) => s + e.amount, 0) * 100) / 100,
      total_quantity: entries.reduce((s, e) => s + e.quantity, 0),
    })
  } catch (e) { err(res, e.message, 500) }
}


// ─── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, `http://localhost:${PORT}`).pathname

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }

  try {
    if (path === '/api/auth/login')  return await authLogin(req, res)
    if (path === '/api/auth/me')     return await authMe(req, res)
    if (path === '/api/auth/logout') return authLogout(req, res)
    if (path === '/api/dashboard/stats') return await dashboardStats(req, res)
    if (path === '/api/hissab')      return await hissab(req, res)

    const vm = path.match(/^\/api\/vendors\/?(\d+)?$/)
    if (vm) return await vendors(req, res, vm[1])

    const om = path.match(/^\/api\/orders\/?(\d+)?$/)
    if (om) return await orders(req, res, om[1])

    const tm = path.match(/^\/api\/transport\/?(\d+)?$/)
    if (tm) return await transport(req, res, tm[1])

    err(res, 'Not found', 404)
  } catch (e) {
    console.error('Unhandled error:', e)
    err(res, 'Internal server error', 500)
  }
})

server.listen(PORT, () => {
  console.log('\n  🚀 Local API server ready!')
  console.log(`  ➜  API:      http://localhost:${PORT}/api`)
  console.log(`  ➜  Frontend: http://localhost:5173  (run npm run dev in another terminal)\n`)
  console.log(`  Admin login: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`)
  console.log(`  Baserow token: ${BASEROW_TOKEN ? '✓ set' : '✗ missing!'}`)
  console.log(`  Table IDs: vendors=${TABLE_IDS.vendors}, orders=${TABLE_IDS.orders}, transport=${TABLE_IDS.transport}\n`)
})
