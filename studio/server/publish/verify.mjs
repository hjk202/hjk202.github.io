import fs from 'node:fs';import path from 'node:path';import{spawn,execFileSync}from'node:child_process';import{createServer}from'node:net';
import process from'node:process';import{log}from'node:console';
// Fixed publication gate, run only in the isolated exact commit with a key-free environment.
const browserCache=process.argv[2];if(process.argv.length!==3||!browserCache||!path.isAbsolute(browserCache))throw new Error('INVALID_CHECK_START');
const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
if(fs.readFileSync('.node-version','utf8').trim()!==process.versions.node)throw new Error('PUBLISH_NODE_VERSION_MISMATCH');
const baseEnv={...process.env,PLAYWRIGHT_BROWSERS_PATH:browserCache,ASTRO_TELEMETRY_DISABLED:'1'};for(const name of Object.keys(baseEnv))if(/^(DASHSCOPE|STUDIO_AI|OPENAI|ANTHROPIC)_|TOKEN|PASSWORD|SECRET|CREDENTIAL|^E2E_|^NODE_OPTIONS$/.test(name))delete baseEnv[name];
if('npm@'+execFileSync(process.execPath,[npm,'--version'],{env:baseEnv,windowsHide:true,encoding:'utf8'}).trim()!==JSON.parse(fs.readFileSync('package.json','utf8')).packageManager)throw new Error('PUBLISH_NPM_VERSION_MISMATCH');
async function step(name,args,extra={}){log(JSON.stringify({step:name,status:'running'}));const exit=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:process.cwd(),env:{...baseEnv,...extra},stdio:'ignore',windowsHide:true});child.once('error',()=>resolve(null));child.once('exit',resolve);});if(exit!==0){log(JSON.stringify({step:name,status:'failed',exit}));throw new Error('PUBLISH_CHECK_FAILED:'+name);}log(JSON.stringify({step:name,status:'passed'}));}
const npmRun=(name,...args)=>[npm,'run',name,...args],pw=(...args)=>['node_modules/@playwright/test/cli.js','test',...args];
async function port(){const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();await new Promise(resolve=>server.close(resolve));return String(address.port);}
async function browser(name,env={}){await step(name,pw(),{E2E_PORT:await port(),...env});}
await step('locked dependencies',[npm,'ci','--prefer-offline']);
await step('locked browsers',['node_modules/@playwright/test/cli.js','install','chromium','webkit']);
for(const name of ['lint','typecheck','test','build'])await step(name,npmRun(name));
await browser('root Chromium');await browser('WebKit mobile',{E2E_BROWSER:'webkit',E2E_MOBILE:'1'});
await step('WebKit private',pw('--grep','Vault|private|Unlock|opening and reopening'),{E2E_PORT:await port(),E2E_BROWSER:'webkit'});
await step('isolated private session',['tests/verify-vault-session.mjs']);await browser('real private adapter',{E2E_DIST:fs.readFileSync('.cache/vault-session-output.txt','utf8').trim(),E2E_SESSION_PROBE:'1'});
await step('extension',npmRun('test:extension'));for(const name of ['content','design','mobile'])await step(name,['tests/verify-'+name+'.mjs']);
await step('base build',npmRun('build','--','--base','/personal-space/','--outDir','.cache/base-dist'));await browser('base Chromium',{E2E_BASE_PATH:'/personal-space/',E2E_DIST:'.cache/base-dist'});
await step('release boundary',['tests/verify-release.mjs']);await step('vault boundary',['--experimental-strip-types','tests/verify-vault-release.mjs']);
await step('release identity',['scripts/release/record.mjs']);await step('recorded release boundary',['tests/verify-release.mjs']);await step('recorded vault boundary',['--experimental-strip-types','tests/verify-vault-release.mjs']);
