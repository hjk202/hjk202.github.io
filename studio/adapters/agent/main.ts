import { MAX_REQUEST_BYTES } from '../../contracts/http.ts';
import { agentFailure, connectThinkAgent } from './client.ts';
import type { AgentReply } from './client.ts';

// Custom JSON-lines transport, deliberately not MCP/JSON-RPC. stdout is protocol data only.
const args = process.argv.slice(2);
let origin = 'http://127.0.0.1:4322';
let allowWrite = false;
let valid = true;
const seen = new Set<string>();
for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  if (seen.has(arg)) { valid = false; break; }
  seen.add(arg);
  if (arg === '--origin' && args[i + 1]) origin = args[++i]!;
  else if (arg === '--allow-write') allowWrite = true;
  else { valid = false; break; }
}
const emit = (reply: AgentReply): Promise<void> => new Promise((resolve, reject) => {
  process.stdout.write(JSON.stringify(reply) + '\n', error => error ? reject(error) : resolve());
});
let closeTransport: () => void = () => { process.stdin.destroy(); };
process.stdout.on('error', () => { process.exitCode = 1; closeTransport(); });
if (!valid) {
  process.stderr.write('Usage: node --experimental-strip-types studio/adapters/agent/main.ts [--origin http://127.0.0.1:PORT] [--allow-write]\n');
  process.exitCode = 2;
} else {
  const connected = await connectThinkAgent({ origin, allowWrite });
  if (!connected.ok) {
    process.exitCode = 1;
    try { await emit({ id: null, ...connected }); }
    catch { process.stderr.write('Agent output unavailable.\n'); }
  }
  else {
    const agent = connected.value;
    const stop = () => { agent.close(); process.stdin.destroy(); };
    closeTransport = stop;
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    let chunks: Buffer[] = [];
    let size = 0;
    let discarding = false;
    const frame = async (bytes: Buffer) => {
      let input: unknown;
      try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
      catch { await emit({ id: null, ...agentFailure('INVALID_REQUEST') }); return; }
      await emit(await agent.execute(input));
    };
    try {
      for await (const chunk of process.stdin) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        let offset = 0;
        while (offset < bytes.length) {
          const newline = bytes.indexOf(10, offset);
          const end = newline < 0 ? bytes.length : newline;
          if (!discarding) {
            if (size + end - offset > MAX_REQUEST_BYTES) {
              chunks = []; size = 0; discarding = true;
              await emit({ id: null, ...agentFailure('PAYLOAD_TOO_LARGE') });
            } else { chunks.push(bytes.subarray(offset, end)); size += end - offset; }
          }
          if (newline >= 0) {
            if (!discarding) await frame(Buffer.concat(chunks, size));
            chunks = []; size = 0; discarding = false;
          }
          offset = newline < 0 ? bytes.length : newline + 1;
        }
      }
      if (size && !discarding) await frame(Buffer.concat(chunks, size));
    } catch {
      // Never print raw input, token, HTTP errors or article text as diagnostics.
      process.stderr.write('Agent transport closed. Re-read source before retrying a write.\n');
      process.exitCode = 1;
    } finally {
      agent.close();
      process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    }
  }
}
