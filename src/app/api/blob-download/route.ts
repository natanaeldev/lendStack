import { NextRequest, NextResponse } from 'next/server'
import { getDownloadUrl } from '@vercel/blob'

// ─── GET /api/blob-download?url=<blob-url> ────────────────────────────────────
// Generates a short-lived signed download URL for a private Vercel Blob and
// redirects the browser to it.  The canonical blob URL (stored in MongoDB) is
// never exposed directly to clients.
export async function GET(req: NextRequest) {
  const blobUrl = req.nextUrl.searchParams.get('url')
  if (!blobUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Only proxy Vercel Blob URLs (safety check)
  if (!blobUrl.startsWith('https://') || !blobUrl.includes('blob.vercel-storage.com')) {
    return NextResponse.json({ error: 'Invalid blob URL' }, { status: 400 })
  }

  try {
    const downloadUrl = await getDownloadUrl(blobUrl)
    return NextResponse.redirect(downloadUrl)
  } catch (err: any) {
    console.error('[GET /api/blob-download]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
