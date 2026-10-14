import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,lstatSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import process from 'node:process';
import {log} from 'node:console';
import {readEnvelope} from '../src/core/vault/crypto.ts';
const walk=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(directory,entry.name)):[join(directory,entry.name)]);
const dist=resolve(process.argv[2]??'dist');
for(const file of walk(dist)) {
  assert.ok(!lstatSync(file).isSymbolicLink());
  assert.ok(!/\.(?:map|astro|ts|md|mdx)$|(?:^|[/\\])(?:tests|scripts|\.cache|\.env)(?:[/\\]|$)/.test(relative(dist,file)),`Unexpected release source: ${relative(dist,file)}`);
  const text=readFileSync(file,'utf8');assert.doesNotMatch(text,/CANARY_P4_|phase4-nonsensitive-acceptance|data-fixture-unlock|vault-protocol-test|安全验收样本/);
  if(file.endsWith('.json')&&relative(dist,file).replaceAll('\\','/')==='vault/bundle.json')readEnvelope(text);
}
for(const root of ['src/core/vault','src/shell/vault'])for(const file of walk(root))if(/\.(?:ts|astro)$/.test(file))assert.doesNotMatch(readFileSync(file,'utf8'),/localStorage|sessionStorage|indexedDB|document\.cookie|serviceWorker|sendBeacon|console\.(?:log|debug)|node:fs|\.server/);
for(const file of walk('src/modules').filter(file=>file.endsWith('vault.client.ts')))assert.doesNotMatch(readFileSync(file,'utf8'),/node:|\.server|innerHTML|localStorage|sessionStorage|indexedDB/);
const candidates=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
assert.ok(!candidates.some(file=>/(?:^|\/)(?:\.env|\.cache|node_modules)(?:\/|$)|(?:^|\/)(?:private-source|vault-source)\.(?:json|md)$/.test(file)),'Local or plaintext source in Git candidates');
const bundle=join(dist,'vault/bundle.json');if(existsSync(bundle))assert.deepEqual(Object.keys(readEnvelope(readFileSync(bundle,'utf8'))).sort(),['ciphertext','iterations','iv','salt','version']);
const workflow=readFileSync('.github/workflows/deploy.yml','utf8');assert.doesNotMatch(workflow,/VAULT_(?:PASSWORD|KEY|SOURCE)|vault:pack|vault:rekey/);assert.ok(workflow.includes('verify-vault-release.mjs'));
log(`Vault release boundaries verified; encrypted bundle ${existsSync(bundle)?'configured':'not configured'}, ${candidates.length} Git candidates. Scanning complements crypto, runtime and path-contract tests.`);
