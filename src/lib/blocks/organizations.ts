import { blocksFetch } from "./http";

export interface BlocksOrganization {
  itemId: string;
  name: string;
}

export const organizationsApi = {
  /** Organizations available to the signed-in user — the source for the workspace switcher. */
  my: () =>
    blocksFetch<{ organizations?: BlocksOrganization[] }>(`/iam/v4/iam/organizations/my`).then(
      (response) => response.organizations ?? []
    ),
};
