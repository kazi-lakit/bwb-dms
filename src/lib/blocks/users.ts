import { blocksFetch } from "./http";

export interface BlocksUser {
  itemId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  roles: string[];
  permissions: string[];
  active: boolean;
  profileImageUrl?: string;
  /** Active tenant context supplied by IAM for a multi-organization session. */
  organizationId?: string;
}

export const usersApi = {
  me: () => blocksFetch<{ data: BlocksUser }>(`/iam/v4/iam/me`).then((r) => r.data),

  // POST /iam/v4/iam/users — populates the share dialog's "User" dropdown.
  list: () =>
    blocksFetch<{ data: BlocksUser[] }>(`/iam/v4/iam/users`, {
      method: "POST",
      body: JSON.stringify({ page: 0, pageSize: 200, filter: {} }),
    }).then((r) => r.data),
};
