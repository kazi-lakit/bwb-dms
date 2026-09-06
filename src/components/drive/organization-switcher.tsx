"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useDrive } from "@/components/providers/drive-provider";
import { useMyOrganizations } from "@/lib/blocks/drive-hooks";
import { Spinner } from "@/components/ui/spinner";
import { switchOrganizationSession } from "@/lib/blocks/auth";

/**
 * Lists the user's available organizations and changes the IAM session when one is selected.
 */
export function OrganizationSwitcher() {
  const { organizationId } = useDrive();
  const { data: organizations, isPending } = useMyOrganizations();
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const activeOrganization = organizations?.find((organization) => organization.itemId === organizationId);
  const label = activeOrganization?.name || "Organization";

  useEffect(() => {
    function onClickAway(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  async function selectOrganization(nextOrganizationId: string) {
    if (nextOrganizationId === organizationId || switchingId) {
      setOpen(false);
      return;
    }

    setSwitchingId(nextOrganizationId);
    setError(null);
    try {
      await switchOrganizationSession(nextOrganizationId);

      queryClient.clear();
      await refresh();
      setOpen(false);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "Couldn't switch organization.");
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 max-w-56 items-center gap-2 rounded-md border border-hairline bg-canvas px-3 text-left text-sm text-ink hover:bg-surface"
      >
        <Building2 size={16} className="shrink-0 text-steel" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown size={15} className="shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 w-64 rounded-lg border border-hairline bg-canvas p-1 shadow-lg" role="menu">
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted">Organizations</p>
          {isPending ? (
            <div className="flex justify-center py-5"><Spinner className="h-4 w-4" /></div>
          ) : organizations?.length ? (
            organizations.map((organization) => {
              const active = organization.itemId === organizationId;
              const switching = organization.itemId === switchingId;
              return (
                <button
                  key={organization.itemId}
                  type="button"
                  role="menuitem"
                  disabled={Boolean(switchingId)}
                  onClick={() => selectOrganization(organization.itemId)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-surface disabled:opacity-60"
                >
                  <Building2 size={16} className="shrink-0 text-steel" />
                  <span className="min-w-0 flex-1 truncate">{organization.name || "Unnamed organization"}</span>
                  {switching ? <Spinner className="h-4 w-4" /> : active ? <Check size={16} className="text-brand-green" /> : null}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-3 text-sm text-muted">No organizations are available.</p>
          )}
          {error && <p className="px-3 py-2 text-xs text-brand-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
