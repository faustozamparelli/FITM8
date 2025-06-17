import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export default function Index() {
  // `undefined` = still determining, `null` = unauthenticated, otherwise session
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Initial session fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for future auth state changes so the redirect always reflects reality
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Still figuring out whether the user is logged in — render nothing.
  if (session === undefined) {
    return null;
  }

  // Bounce the user to the correct part of the app.
  return <Redirect href={session ? "/(tabs)/home" : "/login"} />;
}
