import { PublicLeagueView } from "@/components/PublicLeagueView";

export const dynamic = "force-dynamic";

export default async function PublicLeaguePage({
  params,
}: {
  params: Promise<{ alias: string }>;
}) {
  const { alias } = await params;
  return <PublicLeagueView alias={alias} />;
}
