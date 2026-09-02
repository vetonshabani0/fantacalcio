import { redirect } from "next/navigation";

/**
 * The signed-in league view used to live here, reading the legacy standings
 * endpoint through a guessed field mapping. It duplicated the public league
 * page, which reads the same figures correctly and offers more besides, so this
 * now sends people there rather than maintaining two views of one thing.
 */
export default async function RealLeagueRedirect({
  params,
}: {
  params: Promise<{ alias: string }>;
}) {
  const { alias } = await params;
  redirect(`/lega-pubblica/${alias}`);
}
