import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import LoadingTruck from "../LoadingTruck";

interface Props {
  children: JSX.Element;
}

export default function ProtectedRoute({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      mounted = false;
      const l = listener as unknown as
        | { subscription?: { unsubscribe?: () => void } }
        | undefined;
      l?.subscription?.unsubscribe?.();
    };
  }, []);

  if (loading)
    return (
      <div className="page-loader" role="status" aria-live="polite">
        <LoadingTruck />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
