import { RealLeagueView } from "@/components/RealLeagueView";

export const dynamic = "force-dynamic";

export default async function RealLeaguePage({
  params,
}: {
  params: Promise<{ alias: string }>;
}) {
  const { alias } = await params;
  return <RealLeagueView alias={alias} />;
}
