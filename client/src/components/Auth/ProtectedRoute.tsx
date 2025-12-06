import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import LoadingTruck from "../LoadingTruck";
import { apiGet } from "@/lib/api";

interface Props {
  children: JSX.Element;
}

export default function ProtectedRoute({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const profile = await apiGet("/auth/me");
        if (!mounted) return;
        if (profile?.id) setUser({ id: String(profile.id) });
        else setUser(null);
      } catch (err) {
        
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
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
