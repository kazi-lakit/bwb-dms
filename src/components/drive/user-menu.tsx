"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/providers/auth-provider";

function initials(firstName?: string, lastName?: string, email?: string) {
  if (firstName || lastName) return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return email?.[0]?.toUpperCase() ?? "?";
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-sm font-medium text-ink"
      >
        {initials(user.firstName, user.lastName, user.email)}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 w-56 rounded-lg border border-hairline bg-canvas p-1 shadow-lg">
          <div className="border-b border-hairline-soft px-3 py-2.5">
            <p className="truncate text-sm font-medium text-ink">
              {user.firstName || user.lastName ? `${user.firstName} ${user.lastName}`.trim() : "Signed in"}
            </p>
            <p className="truncate text-xs text-steel">{user.email}</p>
          </div>
          <button
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate("/login", { replace: true });
            }}
            className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-surface"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
