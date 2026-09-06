import { createBlocksClient } from "@seliseblocks/client";
import { blocksConfig } from "./config";

/** One cookie-backed Blocks SDK instance. Tokens are never copied into browser storage. */
export const blocksClient = createBlocksClient({
  apiUrl: blocksConfig.apiUrl,
  appDomain: blocksConfig.appDomain,
  xBlocksKey: blocksConfig.projectKey,
  oidc: blocksConfig.oidc,
});
