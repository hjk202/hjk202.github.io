import { fileURLToPath } from 'node:url';
import { prepareStudio } from './prepared.ts';
import { DesktopError } from './local.ts';

try {
  const prepared = await prepareStudio(fileURLToPath(new URL('../../',import.meta.url)));
  process.stdout.write(`Studio 已准备版本 ${prepared.id.slice(0,12)}。正常重开后使用；日常启动不会重新编译。\n`);
} catch(error) {
  const code = error instanceof DesktopError ? error.message : 'PREPARATION_FAILED';
  let help = '请按 MAINTENANCE.md 中的对应错误码检查。';
  if (code === 'DESKTOP_BUSY') help = '请等待正在准备的进程完成，或正常退出已打开的 Studio。';
  if (code === 'NUGET_SOURCE_UNAVAILABLE') help = '无法访问 NuGet 包源或漏洞数据。恢复对 api.nuget.org 的访问后再试。';
  process.stderr.write(`Studio: ${code}。${help}\n`);
  process.exitCode=1;
}
