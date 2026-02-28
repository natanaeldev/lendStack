import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

/**
 * Email sending API route.
 *
 * To enable real email delivery:
 * 1. Install Resend:  npm install resend
 * 2. Get an API key from https://resend.com
 * 3. Add to .env.local:  RESEND_API_KEY=re_xxxxx
 * 4. Uncomment the Resend code below
 */

export async function POST(req: NextRequest) {
  const { to, subject, html } = await req.json();

  if (!to || !to.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // ── OPTION 1: Resend (recommended) ─────────────────────────────────────────

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: "JVF Inversiones <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true, id: data?.id });

  // ── OPTION 2: SendGrid ──────────────────────────────────────────────────────
  // import sgMail from '@sendgrid/mail'
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY!)
  // await sgMail.send({ to, from: 'noreply@yourdomain.com', subject, html })

  // ── SIMULATION (remove when using a real provider) ──────────────────────────
  // console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
  // return NextResponse.json({ success: true, simulated: true });
}
