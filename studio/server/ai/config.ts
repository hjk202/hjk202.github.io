import process from 'node:process';
import { GEMINI_BASE, GEMINI_MODEL } from '../../contracts/ai.ts';

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

export function readAiConfig(environment: NodeJS.ProcessEnv = process.env) {
  if (environment.STUDIO_AI_PROVIDER !== 'gemini') return readBailianConfig(environment);
  const apiKey = environment.GEMINI_API_KEY;
  if (!apiKey) return { state: 'missing' as const };
  if (!/^[A-Za-z0-9._-]{1,512}$/.test(apiKey)) return { state: 'invalid' as const };
  return { state: 'ready' as const, apiKey, endpoint: GEMINI_BASE + '/models/' + GEMINI_MODEL + ':generateContent' };
}
