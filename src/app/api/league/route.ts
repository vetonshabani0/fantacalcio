import { NextResponse } from "next/server";
import { buildCalendar, type League, type Team } from "@/lib/fanta/league";
import { DEFAULT_RULES } from "@/lib/fanta/rules";
import { resolvePointer } from "@/lib/fanta/source";
import { buildDemoLeague } from "@/lib/demo";
import { generateCode, saveLeague } from "@/lib/store";

export const dynamic = "force-dynamic";

interface CreateBody {
  demo?: boolean;
  name?: string;
  startMatchweek?: number;
  teams?: { name: string; manager: string; roster: number[] }[];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CreateBody;

  if (body.demo) {
    const league = await buildDemoLeague(body.teams?.length || 8);
    const saved = await saveLeague(league);
    return NextResponse.json({ code: saved.code, name: saved.name });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Serve un nome lega" }, { status: 400 });
  }

  const incoming = body.teams ?? [];
  if (incoming.length < 2) {
    return NextResponse.json(
      { error: "Servono almeno 2 squadre" },
      { status: 400 },
    );
  }

  const teams: Team[] = incoming.map((team, i) => ({
    id: `t${i + 1}`,
    name: (team.name || `Squadra ${i + 1}`).trim(),
    manager: (team.manager || "").trim(),
    roster: [...new Set(team.roster ?? [])],
  }));

  const empty = teams.find((t) => t.roster.length < 11);
  if (empty) {
    return NextResponse.json(
      { error: `"${empty.name}" ha meno di 11 giocatori in rosa` },
      { status: 400 },
    );
  }

  const pointer = await resolvePointer();
  const now = Date.now();
  const league: League = {
    code: generateCode(),
    name,
    createdAt: now,
    updatedAt: now,
    seasonId: pointer.seasonId,
    startMatchweek: Math.max(1, body.startMatchweek ?? 1),
    rules: DEFAULT_RULES,
    teams,
    fixtures: buildCalendar(teams),
    lineups: {},
  };

  const saved = await saveLeague(league);
  return NextResponse.json({ code: saved.code, name: saved.name });
}
