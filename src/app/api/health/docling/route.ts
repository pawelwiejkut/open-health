import {NextResponse} from 'next/server'

export async function GET() {
  const base = process.env.DOCLING_API_URL || 'http://localhost:5001'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2000)
  try {
    const res = await fetch(`${base}/health`, {signal: controller.signal})
    clearTimeout(timeout)
    if (!res.ok) return NextResponse.json({ok: false, url: base, status: res.status})
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ok: true, url: base, data})
  } catch (e) {
    clearTimeout(timeout)
    const message = e instanceof Error ? e.message : 'request failed'
    return NextResponse.json({ok: false, url: base, error: message})
  }
}
