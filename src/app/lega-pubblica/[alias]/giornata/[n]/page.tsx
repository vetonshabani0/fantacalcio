import { MatchweekView } from "@/components/MatchweekView";

export const dynamic = "force-dynamic";

export default async function MatchweekPage({
  params,
}: {
  params: Promise<{ alias: string; n: string }>;
}) {
  const { alias, n } = await params;
  return <MatchweekView alias={alias} matchweek={n} />;
}
