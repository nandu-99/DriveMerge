import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import LoadingTruck from "../LoadingTruck";

interface Props {
  children: JSX.Element;
}

export default function ProtectedRoute({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    // Simple local auth check: presence of a local user id in storage.
    const uid = localStorage.getItem("dm_user_id");
    setUser(uid ? { id: uid } : null);
    setLoading(false);
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
