import { buildImportTemplateCsv } from '@/lib/loanImport'

export async function GET() {
  return new Response(buildImportTemplateCsv(), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="loan-import-template.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
