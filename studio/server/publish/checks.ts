import {existsSync}from'node:fs';import {join}from'node:path';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';import{command,safeDirectory,PublishError,PublishCommandError}from'./support.ts';
import type{PublicationSelection}from'../../contracts/publish.ts';import{openThinkAuthoring}from'../think/service.ts';import{createThinkPreview}from'../think/preview.ts';
import{createBuildAuthoring}from'../build/service.ts';import{createSourcePreview}from'../source-preview.ts';
/** Existing Markdown image/native-addon boundary runs before installing candidate node_modules. */
export async function guardPublicationAssets(root:string,selection:PublicationSelection){
  if(selection.module==='build'){const service=createBuildAuthoring(root),preview=createSourcePreview(service.preparePreview,{repositoryRoot:root});try{const r=await preview.preview({key:selection.project.slug,project:selection.project});if(!r.ok)throw new PublishError('PUBLICATION_RESOURCE_CHECK_FAILED');}finally{await preview.close();service.close();}return;}
  const opened=openThinkAuthoring(root);if(!opened.ok)throw new PublishError('CANDIDATE_SOURCE_UNAVAILABLE');const service=opened.value,preview=createThinkPreview(service,{repositoryRoot:root});try{const rows=service.listThink();if(!rows.ok)throw new PublishError('CANDIDATE_SOURCE_UNAVAILABLE');const found=rows.value.find(row=>row.slug===selection.document.metadata.slug);if(!found)throw new PublishError('CANDIDATE_SOURCE_UNAVAILABLE');const r=await preview.previewThink({key:found.key,document:selection.document});if(!r.ok)throw new PublishError('PUBLICATION_RESOURCE_CHECK_FAILED');}finally{await preview.close();service.close();}
}
export function publicationCheckers(repositoryRoot:string){
  const cache=join(repositoryRoot,'.cache/studio/publish-browsers');
  return{
    verify:async(candidate:string)=>{try{await command(process.execPath,[fileURLToPath(new URL(/* @vite-ignore */ './verify.mjs',import.meta.url)),cache],candidate,{build:true,timeout:30*60*1000});}
      catch(error){
        if(!(error instanceof PublishCommandError))throw error;
      const rows=error.output.toString('utf8').split(/\r?\n/).flatMap(line=>{try{return[JSON.parse(line) as {step?:unknown;exit?:unknown}];}catch{return[];}});
        const last=rows.at(-1), step=typeof last?.step==='string'&&/^[a-zA-Z ]{1,40}$/.test(last.step)?last.step:'startup';
        const exit=typeof last?.exit==='number'&&Number.isInteger(last.exit)?last.exit:error.exitCode??'unknown';
        throw new PublishError(`本机发布检查未通过：${step}（${error.message}，退出码 ${exit}）。浏览器失败可在保留的候选 test-results 中检查。`);
      }},
    smoke:async(candidate:string)=>{safeDirectory(candidate);
      // The full gate installs browsers before upload; the content path uses the
      // same browser cache, provisioning it once only when binaries are absent.
      const probe=await command(process.execPath,['--input-type=module','-e',
        'import {chromium,webkit} from "playwright";console.log(JSON.stringify([chromium.executablePath(),webkit.executablePath()]));'],candidate,{build:true,env:{PLAYWRIGHT_BROWSERS_PATH:cache}});
      const paths=JSON.parse(probe.toString('utf8')) as string[];
      if(paths.some(path=>!existsSync(path))){
        const cli=createRequire(join(candidate,'package.json')).resolve('@playwright/test/cli');
        await command(process.execPath,[cli,'install','chromium','webkit'],candidate,{build:true,timeout:300000,env:{PLAYWRIGHT_BROWSERS_PATH:cache}});
      }
      await command(process.execPath,[fileURLToPath(new URL(/* @vite-ignore */ './live-smoke.mjs',import.meta.url))],candidate,{build:true,timeout:180000,env:{PLAYWRIGHT_BROWSERS_PATH:cache}});},
  };
}
