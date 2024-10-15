import { NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwt'

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.split(' ')[1]

  if (!token) {
    return NextResponse.json({ error: "No token provided" }, { status: 401 })
  }

  const payload = verifyJWT(token)

  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  return NextResponse.json({ user: payload }, { status: 200 })
}