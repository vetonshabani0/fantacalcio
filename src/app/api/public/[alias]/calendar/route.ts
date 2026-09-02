import { NextResponse } from "next/server";
import { parseCalendarWorkbook } from "@/lib/fanta/calendar-import";
import { fetchPublicLeague } from "@/lib/fanta/public-league";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Parses an uploaded calendar export and returns the fixtures.
 *
 * Deliberately stateless: nothing is written server-side, because serverless
 * instances do not share a filesystem and an uploaded file would silently
 * vanish for the next request. The caller keeps the result.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ alias: string }> },
) {
  const { alias } = await context.params;

  const league = await fetchPublicLeague(alias).catch(() => null);
  if (!league) {
    return NextResponse.json({ error: "Lega non trovata" }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nessun file ricevuto." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File troppo grande." }, { status: 413 });
  }

  try {
    const result = parseCalendarWorkbook(
      await file.arrayBuffer(),
      league.teams.map((t) => ({ id: t.id, name: t.name })),
    );

    if (result.fixtures.length === 0) {
      return NextResponse.json(
        { error: result.warnings[0] ?? "Nessun incontro riconosciuto.", ...result },
        { status: 422 },
      );
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Non riesco a leggere questo file." },
      { status: 400 },
    );
  }
}
