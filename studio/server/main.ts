import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { startStudioHttp, StudioStartError } from './http.ts';

const args = process.argv.slice(2);
const valid = args.length === 0 || (args.length === 2 && args[0] === '--port' && /^[1-9][0-9]{0,4}$/.test(args[1]!));
if (!valid) {
  process.stderr.write('用法：npm.cmd run studio -- [--port 4322]\n');
  process.exitCode = 1;
} else {
  try {
    const session = await startStudioHttp({ ...(args.length ? { port: Number(args[1]) } : {}), webDirectory: fileURLToPath(new URL('../../.cache/studio/web/', import.meta.url)) });
    process.stdout.write(`Studio API: ${session.origin}/\n本机浏览器打开 Think 编辑器与隔离预览。Ctrl+C 停止。\n`);
    process.send?.({ type: 'studio:ready', origin: session.origin });
    const stop = async () => {
      const result = await session.close();
      if (!result.ok) { process.stderr.write(`Studio 停止未完成：${result.error.code}\n`); process.exitCode = 1; }
    };
    process.once('SIGINT', () => { void stop(); });
    process.once('SIGTERM', () => { void stop(); });
    // A trusted parent may request clean shutdown, including Windows where SIGTERM is forceful.
    if (process.send) process.on('message', message => { if (message === 'studio:stop') void stop().then(() => process.disconnect()); });
  } catch (error) {
    process.stderr.write(`${error instanceof StudioStartError ? error.message : 'Studio 启动失败：INTERNAL_ERROR'}\n`);
    process.exitCode = 1;
  }
}
