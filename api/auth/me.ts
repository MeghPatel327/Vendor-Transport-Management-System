import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUser } from '../../lib/jwt'
import { apiError } from '../../lib/helpers'

const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrator'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return apiError(res, 'Method not allowed', 405)

  const user = await getAuthUser(req as any)
  if (!user) return apiError(res, 'Unauthorized', 401)

  return res.status(200).json({
    success: true,
    user: { username: user.sub, name: user.name || ADMIN_NAME },
  })
}
