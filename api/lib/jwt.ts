// JWT utilities for serverless functions
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

// Simple JWT implementation using Web Crypto API (available in Node 20+)
function base64urlEncode(str: string): string {
  return Buffer.from(str).toString('base64url')
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8')
}

export interface JWTPayload {
  sub: string
  name: string
  iat: number
  exp: number
}

export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 60 * 60 * 24 * 7 // 7 days

  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64urlEncode(JSON.stringify({ ...payload, iat, exp }))
  const data = `${header}.${body}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sig = Buffer.from(signature).toString('base64url')

  return `${data}.${sig}`
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [header, body, sig] = parts
    const data = `${header}.${body}`

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const validSig = await crypto.subtle.verify(
      'HMAC',
      key,
      Buffer.from(sig, 'base64url'),
      new TextEncoder().encode(data)
    )

    if (!validSig) return null

    const payload: JWTPayload = JSON.parse(base64urlDecode(body))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=')
    cookies[name.trim()] = rest.join('=').trim()
  })
  return cookies
}

export function getTokenFromRequest(req: { headers: { cookie?: string } }): string | null {
  const cookieHeader = req.headers.cookie || ''
  const cookies = parseCookies(cookieHeader)
  return cookies['vtms_token'] || null
}

export async function getAuthUser(req: { headers: { cookie?: string } }): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return verifyJWT(token)
}
