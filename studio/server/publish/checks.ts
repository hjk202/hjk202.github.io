import {join}from'node:path';import{fileURLToPath}from'node:url';import{command,safeDirectory,PublishError}from'./support.ts';
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
    verify:async(candidate:string)=>{await command(process.execPath,[fileURLToPath(new URL(/* @vite-ignore */ './verify.mjs',import.meta.url)),cache],candidate,{build:true,timeout:30*60*1000});},
    smoke:async(candidate:string)=>{safeDirectory(candidate);await command(process.execPath,[fileURLToPath(new URL(/* @vite-ignore */ './live-smoke.mjs',import.meta.url))],candidate,{build:true,timeout:180000,env:{PLAYWRIGHT_BROWSERS_PATH:cache}});},
  };
}
