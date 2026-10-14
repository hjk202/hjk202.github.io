import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { readEnvelope, MAX_ENVELOPE } from '../../src/core/vault/crypto.ts';
const directory='public/vault';
if(existsSync(directory)) {
  if(lstatSync(directory).isSymbolicLink()) throw new Error('Vault output must not be a symlink');
  for(const file of readdirSync(directory)) {
    if(file!=='bundle.json'||!lstatSync(`${directory}/${file}`).isFile()||lstatSync(`${directory}/${file}`).isSymbolicLink()||lstatSync(`${directory}/${file}`).size>MAX_ENVELOPE) throw new Error('Only the encrypted Vault bundle may be published');
    readEnvelope(readFileSync(`${directory}/${file}`,'utf8'));
  }
}
