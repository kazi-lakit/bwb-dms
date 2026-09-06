#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import selfsigned from "selfsigned";

function configuredHost() {
  if (process.argv[2]) return process.argv[2];
  if (process.env.VITE_BLOCKS_DEV_HOST) return process.env.VITE_BLOCKS_DEV_HOST;
  for (const filename of [".env.local", ".env"]) {
    const path = resolve(filename);
    if (!existsSync(path)) continue;
    const match = readFileSync(path, "utf8").match(/^VITE_BLOCKS_DEV_HOST=(.+)$/m);
    if (match) return match[1].trim();
  }
  return null;
}

const host = configuredHost();
if (!host) {
  console.error("Set VITE_BLOCKS_DEV_HOST in .env.local or run: npm run cert -- <hostname>");
  process.exit(1);
}

const notBefore = new Date();
const notAfter = new Date(notBefore);
notAfter.setFullYear(notAfter.getFullYear() + 2);
const pems = await selfsigned.generate([{ name: "commonName", value: host }], {
  keySize: 2048,
  notBeforeDate: notBefore,
  notAfterDate: notAfter,
  extensions: [{ name: "subjectAltName", altNames: [{ type: 2, value: host }, { type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }] }],
});

mkdirSync(".cert", { recursive: true });
writeFileSync(".cert/dev-key.pem", pems.private);
writeFileSync(".cert/dev-cert.pem", pems.cert);
console.log(`Generated .cert/dev-key.pem and .cert/dev-cert.pem for ${host}.`);
