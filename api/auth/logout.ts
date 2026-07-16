import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Clear the cookie
  res.setHeader('Set-Cookie', [
    'vtms_token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0',
  ])
  return res.status(200).json({ success: true, message: 'Logged out' })
}
