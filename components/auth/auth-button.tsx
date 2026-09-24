"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { User } from "@/lib/types";

interface AuthButtonProps {
  /** Server-side resolved user passed as initial state to avoid flash */
  initialUser: User | null;
}

export function AuthButton({ initialUser }: AuthButtonProps) {
  const [user, setUser] = useState<User | null>(initialUser);

  useEffect(() => {
    const supabase = createClient();

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        // Fetch the user profile from our users table
        const { data: userProfile } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();

        setUser(userProfile ? JSON.parse(JSON.stringify(userProfile)) : null);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    // Also check current session on mount in case the server-side value is stale
    // (e.g. layout was cached and didn't re-render after OAuth redirect)
    const checkSession = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser && !initialUser) {
        // User is signed in but server didn't know — fetch profile
        const { data: userProfile } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        setUser(userProfile ? JSON.parse(JSON.stringify(userProfile)) : null);
      } else if (!authUser && initialUser) {
        // Server thought user was signed in but they're not
        setUser(null);
      }
    };

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [initialUser]);

  if (user) {
    return <UserMenu user={user} />;
  }

  return (
    <Button asChild>
      <Link href="/auth/login">Sign In</Link>
    </Button>
  );
}
