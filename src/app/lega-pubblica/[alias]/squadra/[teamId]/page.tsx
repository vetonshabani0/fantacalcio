import { PublicTeamView } from "@/components/PublicTeamView";

export const dynamic = "force-dynamic";

export default async function PublicTeamPage({
  params,
}: {
  params: Promise<{ alias: string; teamId: string }>;
}) {
  const { alias, teamId } = await params;
  return <PublicTeamView alias={alias} teamId={teamId} />;
}
