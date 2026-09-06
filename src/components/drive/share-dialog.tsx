"use client";

import { FormEvent, useState } from "react";
import { Trash2, Users } from "lucide-react";
import clsx from "clsx";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { AccessPolicy, ContentPermission, ContentPrincipalType } from "@/lib/blocks/access";
import type { DirectoryChild } from "@/lib/blocks/files";
import type { BlocksRole } from "@/lib/blocks/roles";
import type { BlocksUser } from "@/lib/blocks/users";
import type { BlocksOrganization } from "@/lib/blocks/organizations";
import { useDrive } from "@/components/providers/drive-provider";
import {
  useAccessPolicies,
  useMyOrganizations,
  useRevokeAccess,
  useRoles,
  useShareEntry,
  useUpdateAccess,
  useUsers,
} from "@/lib/blocks/drive-hooks";

const PERMISSIONS: ContentPermission[] = ["View", "Download", "Edit", "Delete", "Manage"];

function PermissionSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: ContentPermission;
  onChange: (p: ContentPermission) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ContentPermission)}
      className={className}
    >
      {PERMISSIONS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </Select>
  );
}

/** Resolves a policy's principalId back to a human-readable name — the API only returns the id. */
function describePrincipal(
  policy: AccessPolicy,
  users: BlocksUser[] | undefined,
  roles: BlocksRole[] | undefined,
  organizations: BlocksOrganization[] | undefined
) {
  if (policy.principalType === "User") {
    const user = users?.find((u) => u.itemId === policy.principalId);
    if (user) return { primary: `${user.firstName} ${user.lastName}`.trim() || user.email, secondary: user.email };
  }
  if (policy.principalType === "Role") {
    const role = roles?.find((r) => r.slug === policy.principalId);
    const organization = organizations?.find((item) => item.itemId === policy.organizationId);
    if (role) return { primary: role.name, secondary: organization ? `Role in ${organization.name}` : "Role" };
  }
  if (policy.principalType === "Organization") {
    return { primary: policy.principalName || "Organization", secondary: "Organization" };
  }
  return { primary: policy.principalName || policy.principalId, secondary: policy.principalType };
}

export function ShareDialog({ entry, onClose }: { entry: DirectoryChild; onClose: () => void }) {
  const { organizationId } = useDrive();
  const resourceType = entry.isFolder ? "Directory" : "File";
  const { data: policies, isPending } = useAccessPolicies(entry.id);
  const { data: users, isPending: usersPending } = useUsers();
  const { data: roles, isPending: rolesPending } = useRoles();
  const { data: organizations, isPending: organizationsPending } = useMyOrganizations();
  const share = useShareEntry(entry.id);
  const update = useUpdateAccess(entry.id);
  const revoke = useRevokeAccess(entry.id);

  const [principalType, setPrincipalType] = useState<ContentPrincipalType | "OrganizationRole">("User");
  const [principalId, setPrincipalId] = useState(""); // itemId (User) or slug (Role)
  const [roleOrganizationId, setRoleOrganizationId] = useState("");
  const [permission, setPermission] = useState<ContentPermission>("View");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const organizationRole = principalType === "OrganizationRole";
    if (!principalId || (organizationRole && !roleOrganizationId)) return;
    share.mutate(
      {
        resourceType,
        principalType: organizationRole ? "Role" : principalType,
        principalId,
        organizationId: organizationRole ? roleOrganizationId : undefined,
        permission,
      },
      { onSuccess: () => { setPrincipalId(""); setRoleOrganizationId(""); } }
    );
  }

  return (
    <Modal onClose={onClose} className="max-w-md">
      <h2 className="mb-1 text-lg font-semibold text-ink">Share &ldquo;{entry.name}&rdquo;</h2>
      <p className="mb-4 text-sm text-steel">Give a user, role, organization, or organization-scoped role access to this {entry.isFolder ? "folder" : "file"}.</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 border-b border-hairline pb-5">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-md border border-hairline p-1 sm:grid-cols-4">
            {(["User", "Role", "Organization", "OrganizationRole"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setPrincipalType(type);
                  // Default to the active organization, while still allowing any of the
                  // user's organizations to be selected from the dropdown below.
                  setPrincipalId(type === "Organization" ? organizationId ?? "" : "");
                  setRoleOrganizationId(type === "OrganizationRole" ? organizationId ?? "" : "");
                }}
                className={clsx(
                  "h-9 rounded-sm px-2 text-sm font-medium transition-colors",
                  principalType === type ? "bg-primary text-on-primary" : "text-steel hover:bg-surface"
                )}
              >
                {type === "OrganizationRole" ? "Org role" : type}
              </button>
            ))}
          </div>

          {principalType === "User" ? (
            <div className="min-w-0"><Select value={principalId} onChange={(e) => setPrincipalId(e.target.value)} required disabled={usersPending}>
              <option value="" disabled>{usersPending ? "Loading users…" : "Select a user…"}</option>
              {users?.map((user) => <option key={user.itemId} value={user.itemId}>{`${user.firstName} ${user.lastName}`.trim() || user.email} ({user.email})</option>)}
            </Select></div>
          ) : principalType === "Role" ? (
            <div className="min-w-0"><Select value={principalId} onChange={(e) => setPrincipalId(e.target.value)} required disabled={rolesPending}>
              <option value="" disabled>{rolesPending ? "Loading roles…" : "Select a role…"}</option>
              {roles?.map((role) => <option key={role.itemId} value={role.slug}>{role.name}</option>)}
            </Select></div>
          ) : principalType === "Organization" ? (
            <div className="min-w-0"><Select value={principalId} onChange={(e) => setPrincipalId(e.target.value)} required disabled={organizationsPending}>
              <option value="" disabled>{organizationsPending ? "Loading organizations…" : "Select an organization…"}</option>
              {organizations?.map((organization) => <option key={organization.itemId} value={organization.itemId}>{organization.name || "Unnamed organization"}</option>)}
            </Select></div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="min-w-0"><Select
                value={principalId}
                onChange={(e) => setPrincipalId(e.target.value)}
                required
                disabled={rolesPending}
              >
                <option value="" disabled>{rolesPending ? "Loading roles…" : "Select a role…"}</option>
                {roles?.map((role) => <option key={role.itemId} value={role.slug}>{role.name}</option>)}
              </Select></div>
              <div className="min-w-0"><Select
                value={roleOrganizationId}
                onChange={(e) => setRoleOrganizationId(e.target.value)}
                required
                disabled={organizationsPending}
              >
                <option value="" disabled>{organizationsPending ? "Loading organizations…" : "Select an organization…"}</option>
                {organizations?.map((organization) => <option key={organization.itemId} value={organization.itemId}>{organization.name || "Unnamed organization"}</option>)}
              </Select></div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <PermissionSelect value={permission} onChange={setPermission} className="flex-1" />
          <Button type="submit" size="sm" className="shrink-0" disabled={share.isPending || !principalId || (principalType === "OrganizationRole" && !roleOrganizationId)}>
            {share.isPending ? <Spinner className="h-4 w-4" /> : <Users size={15} />}
            Share
          </Button>
        </div>
      </form>

      <div className="mt-4 flex flex-col gap-1">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Who has access</p>
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {isPending ? (
            <div className="flex justify-center py-6">
              <Spinner className="h-5 w-5" />
            </div>
          ) : policies && policies.length > 0 ? (
            policies.map((policy) => {
              const { primary, secondary } = describePrincipal(policy, users, roles, organizations);
              return (
                <div key={policy.policyItemId} className="flex items-center gap-2 rounded-md px-1 py-2 hover:bg-surface">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{primary}</p>
                    <p className="truncate text-xs text-muted">{secondary}</p>
                  </div>
                  <PermissionSelect
                    value={policy.permission}
                    disabled={update.isPending}
                    className="w-32 shrink-0"
                    onChange={(perm) =>
                      update.mutate({
                        policyItemId: policy.policyItemId,
                        resourceType,
                        principalType: policy.principalType,
                        principalId: policy.principalId,
                        organizationId: policy.organizationId,
                        permission: perm,
                      })
                    }
                  />
                  <button
                    onClick={() => revoke.mutate(policy.policyItemId)}
                    disabled={revoke.isPending}
                    className="shrink-0 rounded-sm p-1.5 text-muted hover:bg-hairline-soft hover:text-brand-error disabled:opacity-50"
                    aria-label="Remove access"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          ) : (
            <p className="py-3 text-sm text-muted">Not shared with anyone yet.</p>
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
