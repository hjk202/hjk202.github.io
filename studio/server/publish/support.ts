import fs from 'node:fs';import {relative,resolve}from'node:path';import{createHash}from'node:crypto';import{spawn}from'node:child_process';
import type{EditorErrorCode}from'../../contracts/result.ts';
export class PublishError extends Error{readonly code:EditorErrorCode;constructor(reason:string,code:EditorErrorCode='PUBLISH_FAILED'){super(reason);this.code=code;}}
export class PublishCommandError extends PublishError {
  readonly exitCode:number|null;readonly output:Buffer;
  constructor(reason:string,exitCode:number|null,output:Buffer){super(reason);this.exitCode=exitCode;this.output=output;}
}
export const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const gitSha=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
export function safeDirectory(path:string,create=false){path=resolve(path);if(!fs.existsSync(path)&&create)fs.mkdirSync(path);const s=fs.lstatSync(path);if(!s.isDirectory()||s.isSymbolicLink()||relative(path,fs.realpathSync.native(path))!=='')throw new PublishError('UNSAFE_DIRECTORY');return s;}
export function fileBytes(path:string,limit=32*1024*1024):Buffer{
  const before=fs.lstatSync(path,{bigint:true});if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||before.size>BigInt(limit)||relative(path,fs.realpathSync.native(path))!=='')throw new PublishError('UNSAFE_FILE');
  const bytes=fs.readFileSync(path),after=fs.lstatSync(path,{bigint:true});if(before.dev!==after.dev||before.ino!==after.ino||after.isSymbolicLink()||after.nlink!==1n||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs||BigInt(bytes.length)!==after.size)throw new PublishError('FILE_CHANGED');return bytes;
}
/** Never inherits AI credentials into any Git, build, compiler or browser helper. */
export function commandEnvironment(build=false):NodeJS.ProcessEnv{
  const env={...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never',GH_PROMPT_DISABLED:'1',GH_PAGER:'',GIT_PAGER:'',ASTRO_TELEMETRY_DISABLED:'1'};
  for(const name of Object.keys(env))if(/^(DASHSCOPE|GEMINI|STUDIO_AI|OPENAI|ANTHROPIC)_/.test(name)||build&&/(?:TOKEN|PASSWORD|SECRET|CREDENTIAL|API_KEY)/i.test(name)||/^E2E_|^NODE_OPTIONS$|^GIT_(?:DIR|WORK_TREE|INDEX_FILE|CONFIG|SSH_COMMAND|ASKPASS)/.test(name))delete env[name as keyof typeof env];return env;
}
/** Fixed command callers only, no shell. Output is private and never returned as an error. */
export function command(executable:string,args:string[],cwd:string,options:{input?:string;timeout?:number;build?:boolean;env?:NodeJS.ProcessEnv;allowedExit?:number[];maxOutputBytes?:number}={}):Promise<Buffer>{
  return new Promise((resolveCommand,reject)=>{
    const child=spawn(executable,args,{cwd,env:{...commandEnvironment(options.build),...options.env},windowsHide:true,stdio:['pipe','pipe','pipe']}),chunks:Buffer[]=[];let size=0,failed=false;
    const stop=()=>{if(failed)return;failed=true;if(process.platform==='win32'&&child.pid){const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',env:commandEnvironment(true)});killer.once('error',()=>child.kill());}else child.kill();};
    const timer=setTimeout(stop,options.timeout??120000);
    const collect=(data:Buffer)=>{size+=data.length;if(size>(options.maxOutputBytes??4*1024*1024))stop();else chunks.push(data);};
    child.stdout.on('data',collect);child.stderr.on('data',()=>{});child.on('error',()=>{clearTimeout(timer);reject(new PublishError('COMMAND_UNAVAILABLE','PUBLISH_NOT_READY'));});
    child.once('close',code=>{clearTimeout(timer);const output=Buffer.concat(chunks);if(failed||!((options.allowedExit??[0]).includes(code??-1)))reject(new PublishCommandError(failed?'COMMAND_TIMEOUT':'COMMAND_FAILED',code,output));else resolveCommand(output);});
    child.stdin.on('error',()=>{});child.stdin.end(options.input??'');
  });
}
export const git=async(root:string,args:string[],options:Parameters<typeof command>[3]={})=>(await command('git',['-c','core.autocrlf=false',...args],root,options)).toString('utf8').trim();
