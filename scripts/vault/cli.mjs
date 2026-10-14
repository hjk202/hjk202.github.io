import process from 'node:process';
import { log, error } from 'node:console';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { pack, verify, rekey, backup, restore } from './operations.mjs';
function secret(label) {
  if(!process.stdin.isTTY||!process.stdout.isTTY) throw new Error('Use an interactive terminal for passphrases');
  process.stdout.write(label);
  return new Promise((resolve,reject)=>{
    const muted=new Writable({write(_chunk,_encoding,callback){callback();}});
    const reader=createInterface({input:process.stdin,output:muted,terminal:true});
    let answered=false;
    reader.once('SIGINT',()=>reader.close());
    reader.once('close',()=>{process.stdout.write('\n');if(!answered)reject(new Error('Cancelled'));});
    reader.question('',value=>{answered=true;reader.close();resolve(value);});
  });
}
async function main() {
  const [command,...args]=process.argv.slice(2), flags={};
  if(!['pack','verify','rekey','backup','restore'].includes(command)) throw new Error('Commands: pack, verify, rekey, backup, restore');
  for(let i=0;i<args.length;i+=2) {
    const name=args[i];
    if(!['--source','--input','--output'].includes(name)||!args[i+1]||Object.hasOwn(flags,name)) throw new Error('Invalid arguments; use only source/input/output paths');
    flags[name]=args[i+1];
  }
  const output=flags['--output']??'public/vault/bundle.json';
  if(command==='pack') {
    if(!flags['--source']||flags['--input']) throw new Error('pack requires --source');
    const password=await secret('新口令（至少16个字符）：');
    if(password!==await secret('再次输入：')) throw new Error('Passphrases differ');
    await pack(flags['--source'],output,password);
  } else {
    const input=flags['--input']??'public/vault/bundle.json';
    if(flags['--source']) throw new Error('Use --input for an encrypted file');
    if(command==='backup') {
      if(!flags['--output']) throw new Error('backup requires an external --output');
      backup(input,output);
    } else {
      const password=await secret('当前口令：');
      if(command==='verify') await verify(input,password);
      if(command==='restore') await restore(input,output,password);
      if(command==='rekey') {
        const next=await secret('新口令（至少16个字符）：');
        if(next!==await secret('再次输入：')) throw new Error('Passphrases differ');
        await rekey(input,output,password,next);
      }
    }
  }
  log('Vault operation completed.');
}
main().catch(()=>{error('Vault操作未完成：请检查输入格式、路径、口令与终端。原有效密文保持不变。');process.exitCode=1;});
