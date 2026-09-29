#!/usr/bin/env node
/**
 * Self-host WalletConnect ESM bundles — Safari blocks or stalls cross-origin
 * dynamic import() from jsdelivr/esm.sh; first-party bundles fix «Preparing…» hangs.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, '.wc-bundle-tmp');
const OUT = join(ROOT, 'frontend/public/wc');

const ETH_VER = '2.23.10';
const SC_VER = '2.23.10';

mkdirSync(join(TMP, 'wc'), { recursive: true });
mkdirSync(OUT, { recursive: true });

writeFileSync(join(TMP, 'wc/eth-entry.mjs'), "export { EthereumProvider, default } from '@walletconnect/ethereum-provider';\n");
writeFileSync(join(TMP, 'wc/sc-entry.mjs'), "export { default, default as SignClient } from '@walletconnect/sign-client';\n");

if (!existsSync(join(TMP, 'node_modules/@walletconnect/ethereum-provider'))) {
  console.log('[bundle-wc] installing @walletconnect/* …');
  execSync(`npm install @walletconnect/ethereum-provider@${ETH_VER} @walletconnect/sign-client@${SC_VER}`, {
    cwd: TMP,
    stdio: 'inherit',
  });
}

const esbuild = 'npx --yes esbuild@0.25.0';
const common = '--bundle --format=esm --platform=browser --target=es2020 --minify';

const ethOut = join(OUT, 'ethereum-provider.bundle.js');
const scOut = join(OUT, 'sign-client.bundle.js');

console.log('[bundle-wc] ethereum-provider …');
execSync(`${esbuild} wc/eth-entry.mjs ${common} --outfile="${ethOut}"`, { cwd: TMP, stdio: 'inherit' });

console.log('[bundle-wc] sign-client …');
execSync(`${esbuild} wc/sc-entry.mjs ${common} --outfile="${scOut}"`, { cwd: TMP, stdio: 'inherit' });

console.log('[bundle-wc] done → frontend/public/wc/*.bundle.js');
