import assert from 'node:assert/strict';
import process from 'node:process';
import { checkFastThink, fastThinkPath } from '../../studio/server/publish/think-fast.ts';

const [path] = process.argv.slice(2);
const slug = path && fastThinkPath.exec(path)?.[1];
assert.ok(slug && process.argv.length === 3, 'Expected one approved Think article');
assert.ok(await checkFastThink(process.cwd(), path, slug), 'Think article or its references require full review');
