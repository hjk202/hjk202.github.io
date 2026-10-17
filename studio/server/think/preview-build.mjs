// Runs only in the derived build directory, before importing Astro or any project configuration.
import fs from 'node:fs';
import net from 'node:net';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath, URL } from 'node:url';

const denied = () => {
  fs.writeFileSync(new URL('./network-blocked', import.meta.url), '1');
  throw new Error('PREVIEW_NETWORK_BLOCKED');
};
net.Socket.prototype.connect = denied;
net.connect = denied;
net.createConnection = denied;
dgram.createSocket = denied;
globalThis.fetch = async () => denied();
syncBuiltinESMExports();

const { build } = await import('astro');
const { base } = JSON.parse(fs.readFileSync(new URL('./options.json', import.meta.url), 'utf8'));
await build({
  root: fileURLToPath(new URL('./project/', import.meta.url)),
  base, outDir: './out/', cacheDir: './cache/', logLevel: 'silent',
  build: { inlineStylesheets: 'always' },
});
