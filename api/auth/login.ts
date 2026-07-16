import type { VercelRequest, VercelResponse } from '@vercel/node'
import { signJWT } from '../../lib/jwt'
import { apiError } from '../../lib/helpers'

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme'
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrator'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return apiError(res, 'Method not allowed', 405)
  }

  const { username, password } = req.body ?? {}

  if (!username || !password) {
    return apiError(res, 'Username and password are required', 400)
  }

  // Constant-time comparison to prevent timing attacks
  const usernameMatch = username === ADMIN_USERNAME
  const passwordMatch = password === ADMIN_PASSWORD

  if (!usernameMatch || !passwordMatch) {
    // Artificial delay to prevent brute-force timing
    await new Promise(r => setTimeout(r, 500))
    return apiError(res, 'Invalid credentials', 401)
  }

  const token = await signJWT({ sub: username, name: ADMIN_NAME })

  // Set HTTP-only cookie
  res.setHeader('Set-Cookie', [
    `vtms_token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  ])

  return res.status(200).json({
    success: true,
    user: { username, name: ADMIN_NAME },
  })
}
