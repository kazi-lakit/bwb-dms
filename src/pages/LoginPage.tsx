import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/components/providers/auth-provider";
import { startLogin } from "@/lib/blocks/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const messages: Record<string, string> = { callback_failed: "We couldn't complete sign-in. Please try again." };

export default function LoginPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  useEffect(() => { if (status === "authenticated") navigate("/drive", { replace: true }); }, [status, navigate]);
  const error = params.get("error");
  const returnTo = (location.state as { from?: string } | null)?.from || "/drive";
  return <div className="flex min-h-screen flex-col"><div className="bg-hero-sky relative flex flex-1 items-center justify-center px-6 py-24">
    <div className="absolute right-6 top-6"><ThemeToggle /></div>
    <Card className="w-full max-w-sm bg-canvas/95 shadow-xl backdrop-blur">
      <div className="mb-6 flex flex-col items-center gap-2 text-center"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary">▱</div><h1 className="text-2xl font-semibold tracking-tight text-ink">Vault</h1><p className="text-sm text-steel">Sign in to access your files</p></div>
      {params.get("activated") && <p className="mb-4 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink">Account activated — you can sign in now.</p>}
      {error && <p className="mb-4 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-brand-error">{messages[error] || "Something went wrong. Please try again."}</p>}
      {status === "loading" ? <div className="flex items-center justify-center py-2.5"><Spinner /></div> : <Button className="w-full" onClick={() => void startLogin(returnTo)}>Sign in with SSO</Button>}
      <p className="mt-6 text-center text-xs text-muted">Have an invite link instead? Use the activation link from your email.</p>
    </Card>
  </div></div>;
}
