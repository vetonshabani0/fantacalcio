"use client";

import { useEffect, useState } from "react";
import { LeaguePicker } from "./LeaguePicker";
import { SignIn, type LeagueRef } from "./SignIn";
import { Loading } from "./ui";

/**
 * The real entry point: sign in, then pick one of the account's actual leagues.
 * Renders the sign-in form only once the session state is known, so a signed-in
 * user never sees a login screen flash.
 */
export function RealEntry() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "out" }
    | { kind: "in"; leagues: LeagueRef[]; username: string }
  >({ kind: "loading" });

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then(
        (body: {
          signedIn: boolean;
          leagues?: LeagueRef[];
          username?: string;
        }) =>
          setState(
            body.signedIn
              ? {
                  kind: "in",
                  leagues: body.leagues ?? [],
                  username: body.username ?? "",
                }
              : { kind: "out" },
          ),
      )
      .catch(() => setState({ kind: "out" }));
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setState({ kind: "out" });
  }

  if (state.kind === "loading") return <Loading />;

  if (state.kind === "in") {
    return (
      <LeaguePicker
        leagues={state.leagues}
        username={state.username}
        onSignOut={signOut}
      />
    );
  }

  return (
    <SignIn
      onSignedIn={(leagues, username) =>
        setState({ kind: "in", leagues, username })
      }
    />
  );
}
