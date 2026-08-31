import { notFound } from "next/navigation";
import { LeagueDashboard } from "@/components/LeagueDashboard";
import { loadLeague } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const league = await loadLeague(code);
  return { title: league ? `${league.name} — FantaLive` : "Lega — FantaLive" };
}

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { code } = await params;
  const { team } = await searchParams;

  const league = await loadLeague(code);
  if (!league) notFound();

  return <LeagueDashboard code={league.code} initialTeamId={team ?? null} />;
}
