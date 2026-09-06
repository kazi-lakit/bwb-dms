"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { directoryApi, extractCreatedDirectoryId } from "@/lib/blocks/files";
import { drivesApi } from "@/lib/blocks/drives";
import { useAuth } from "./auth-provider";

type DriveStatus = "checking" | "needs-setup" | "ready" | "error";

interface DriveContextValue {
  status: DriveStatus;
  driveId: string | null;
  /** The tenant that owns this drive, used when sharing content with the whole organization. */
  organizationId: string | null;
  error: string | null;
  /** Called once the user agrees to set up their drive — creates the root directory, then records it. */
  setupDrive: () => Promise<void>;
}

const DriveContext = createContext<DriveContextValue | null>(null);

/**
 * Resolves which DMS directory is "my files" for the signed-in user, via the BlxDrive
 * schema on the Data Gateway (see src/lib/blocks/drives.ts): look it up by UserId; if
 * none exists yet, `setupDrive` creates the root directory and records it. Mounted only
 * once `AuthProvider` reports an authenticated user — see `(app)/layout.tsx`.
 */
export function DriveProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<DriveStatus>("checking");
  const [driveId, setDriveId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!user) return;
    setStatus("checking");
    setError(null);
    try {
      const existing = await drivesApi.findByUserId(user.itemId);
      if (existing) {
        setDriveId(existing.DriveId);
        setOrganizationId(user.organizationId ?? existing.OrganizationId ?? null);
        setStatus("ready");
      } else {
        setOrganizationId(null);
        setStatus("needs-setup");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check your drive.");
      setStatus("error");
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check();
  }, [check]);

  const setupDrive = useCallback(async () => {
    if (!user) return;
    setStatus("checking");
    setError(null);
    try {
      const displayName = `${user.firstName} ${user.lastName}`.trim() || user.email;
      const directoryName = `${displayName.toLowerCase().replace(/\s+/g, "")}_${user.itemId}`;

      const created = await directoryApi.createDriveRoot(directoryName);
      const newDriveId = extractCreatedDirectoryId(created);
      if (!newDriveId) throw new Error("Directory creation didn't return an id");

      await drivesApi.insert(user.itemId, displayName, newDriveId);

      setDriveId(newDriveId);
      // The gateway assigns OrganizationId while creating the drive record. Re-read it
      // so organization sharing is available immediately after first-time setup.
      const savedDrive = await drivesApi.findByUserId(user.itemId).catch(() => null);
      setOrganizationId(user.organizationId ?? savedDrive?.OrganizationId ?? null);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set up your drive.");
      setStatus("error");
    }
  }, [user]);

  return (
    <DriveContext.Provider value={{ status, driveId, organizationId, error, setupDrive }}>
      {children}
    </DriveContext.Provider>
  );
}

export function useDrive() {
  const ctx = useContext(DriveContext);
  if (!ctx) throw new Error("useDrive must be used within a DriveProvider");
  return ctx;
}
