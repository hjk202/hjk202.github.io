// Manual, explicit, non-sensitive real-model verification. No repository article is read or written.
import { mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { createThinkTextSuggestions } from '../../studio/server/ai/suggest.ts';
import { AI_MODEL, AI_OPERATIONS } from '../../studio/contracts/ai.ts';

const ai = createThinkTextSuggestions();
const evidence = { date: new Date().toISOString(), service: '阿里云百炼', model: AI_MODEL, simulated: false, operations: [], complete: false };
try {
  if (!ai.status().available) throw new Error(ai.status().issue);
  for (const operation of AI_OPERATIONS) {
    const result = await ai.suggestThinkText({ operation, input: '这是一段非敏感作者工具测试文本：清楚的表达能帮助读者理解观点。此文本不描述任何真实个人经历。' });
    if (!result.ok) throw new Error(result.error.code);
    evidence.operations.push({ operation, ok: true, outputBytes: Buffer.byteLength(result.value.text) });
  }
  evidence.complete = true;
  process.stdout.write('百炼实际调用五项通过；未读取或保存文章，未记录密钥/端点/模型原始响应。\n');
} catch (error) {
  evidence.error = error instanceof Error && /^(AI_|INVALID_REQUEST|AUTHORING_BUSY)/.test(error.message) ? error.message : 'AI_FAILED';
  process.stderr.write(`实际调用未完成：${evidence.error}\n`); process.exitCode = 1;
} finally {
  await ai.close(); mkdirSync('.cache/studio-m5', { recursive: true }); writeFileSync('.cache/studio-m5/live.json', JSON.stringify(evidence, null, 2));
}
