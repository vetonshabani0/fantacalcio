import { MatchView } from "@/components/MatchView";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ alias: string; n: string; teamA: string; teamB: string }>;
}) {
  const { alias, n, teamA, teamB } = await params;
  return (
    <MatchView alias={alias} matchweek={n} teamA={teamA} teamB={teamB} />
  );
}
