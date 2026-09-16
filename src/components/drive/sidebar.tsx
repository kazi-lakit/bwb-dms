"use client";

import { Link, useLocation } from "react-router-dom";
import { Database, Folder, Trash2, Users } from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { label: "My files", href: "/drive", icon: Folder },
  { label: "Shared with me", href: "/shared", icon: Users },
  { label: "System files", href: "/system-files", icon: Database },
  { label: "Trash", href: "/trash", icon: Trash2 },
];

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="hidden w-60 flex-none flex-col border-r border-hairline bg-canvas px-3 py-5 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="text-base font-semibold tracking-tight text-ink">Vault</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm",
                active ? "bg-surface font-medium text-ink" : "text-steel hover:bg-surface"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
