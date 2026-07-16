import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUser } from '../lib/jwt'

export function apiResponse<T>(res: VercelResponse, data: T, status = 200) {
  return res.status(status).json({ success: true, data })
}

export function apiError(res: VercelResponse, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message, message })
}

export async function requireAuth(req: VercelRequest, res: VercelResponse): Promise<{ sub: string; name: string } | null> {
  const user = await getAuthUser(req as any)
  if (!user) {
    apiError(res, 'Unauthorized', 401)
    return null
  }
  return user
}

export function allowMethods(req: VercelRequest, res: VercelResponse, methods: string[]): boolean {
  if (!methods.includes(req.method || '')) {
    res.setHeader('Allow', methods.join(', '))
    apiError(res, `Method ${req.method} not allowed`, 405)
    return false
  }
  return true
}
