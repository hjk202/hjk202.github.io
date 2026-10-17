import process from 'node:process';

export type BailianConfig = { state: 'ready'; endpoint: string; apiKey: string } | { state: 'missing' | 'invalid' };

/** Process-only configuration. Never persist, return via HTTP, log, or accept from a client. */
export function readBailianConfig(environment: NodeJS.ProcessEnv = process.env): BailianConfig {
  const apiKey = environment.DASHSCOPE_API_KEY, base = environment.DASHSCOPE_BASE_URL;
  if (!apiKey || !base) return { state: 'missing' };
  try {
    if (apiKey.length > 512 || [...apiKey].some(char => char.charCodeAt(0) < 33 || char.charCodeAt(0) > 126)) return { state: 'invalid' };
    const url = new URL(base);
    if (base !== base.trim() || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port
      || !/^[a-z0-9][a-z0-9-]{0,62}\.(cn-beijing|us-east-1|ap-southeast-1|eu-central-1|ap-northeast-1)\.maas\.aliyuncs\.com$/.test(url.hostname)
      || !/^\/compatible-mode\/v1\/?$/.test(url.pathname)) return { state: 'invalid' };
    return { state: 'ready', apiKey, endpoint: url.origin + '/compatible-mode/v1/chat/completions' };
  } catch { return { state: 'invalid' }; }
}
