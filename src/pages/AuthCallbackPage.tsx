import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { completeLogin } from "@/lib/blocks/auth";
import { useAuth } from "@/components/providers/auth-provider";
import { Spinner } from "@/components/ui/spinner";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const ranOnce = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Strict Mode runs effects twice in development. IAM state is single-use, so the
    // second callback would otherwise fail after the first one has succeeded.
    if (ranOnce.current) return;
    ranOnce.current = true;

    void (async () => {
      try {
        const result = await completeLogin(window.location.href);
        if (!result.ok) {
          setError(result.message || "callback_failed");
          return;
        }
        await refresh();
        navigate(result.returnTo, { replace: true });
      } catch {
        setError("callback_failed");
      }
    })();
  }, [navigate, refresh]);

  if (error) {
    return <Navigate to={`/login?error=${encodeURIComponent(error)}`} replace />;
  }
  return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
}
