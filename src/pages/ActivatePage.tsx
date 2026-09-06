import { FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { activate } from "@/lib/blocks/account";
import { BlocksApiError } from "@/lib/blocks/http";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function ActivatePage() {
  const navigate = useNavigate(); const [params] = useSearchParams(); const code = params.get("code") || "";
  const [firstName, setFirstName] = useState(""); const [lastName, setLastName] = useState(""); const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [error, setError] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false);
  async function onSubmit(event: FormEvent) { event.preventDefault(); if (password !== confirmPassword) return setError("Passwords do not match."); setError(null); setSubmitting(true); try { await activate({ code, password, firstName, lastName }); navigate("/login?activated=1"); } catch (caught) { setError(caught instanceof BlocksApiError ? "Activation failed. The link may have expired." : "Something went wrong."); } finally { setSubmitting(false); } }
  return <div className="bg-hero-sky relative flex min-h-screen items-center justify-center px-6 py-24"><div className="absolute right-6 top-6"><ThemeToggle /></div><Card className="w-full max-w-sm bg-canvas/95 shadow-xl backdrop-blur"><h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">Activate your account</h1><p className="mb-6 text-sm text-steel">Set a password to finish setting up your account.</p>{!code ? <p className="rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-brand-error">Missing invitation code — open the link from your invite email.</p> : <form className="flex flex-col gap-3" onSubmit={onSubmit}><Input placeholder="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required /><Input placeholder="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} required /><Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required /><Input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />{error && <p className="text-sm text-brand-error">{error}</p>}<Button type="submit" className="mt-2 w-full" disabled={submitting}>{submitting ? "Activating…" : "Activate account"}</Button></form>}</Card></div>;
}
