import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { BRAND } from '@/config/branding'

export async function POST(req: NextRequest) {
  const { to, subject, html } = await req.json()

  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({
    from: BRAND.emailFrom,
    to,
    subject,
    html,
  })

  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ success: true, id: data?.id })
}
