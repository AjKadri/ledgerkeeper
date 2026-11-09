import { sampleCsv } from "@/lib/sample-csv";
// Static: generated once at build time from the fixture.
export const dynamic = "force-static";
export async function GET() {
  return new Response(await sampleCsv(), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="ledgerkeeper-sample.csv"' },
  });
}
