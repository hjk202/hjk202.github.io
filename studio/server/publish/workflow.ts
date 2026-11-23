import {parse}from'yaml';
export const CHECK_SHA_GUARD=`set -euo pipefail
if [[ "$GITHUB_EVENT_NAME" == "workflow_dispatch" ]]; then
  [[ "$GITHUB_REF" == "refs/heads/main" ]]
  [[ "$EXPECTED_SHA" =~ ^[a-f0-9]{40}$ ]]
  [[ "$EXPECTED_SHA" == "$GITHUB_SHA" ]]
  [[ "$STUDIO_REQUEST" == "manual" || "$STUDIO_REQUEST" =~ ^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$ ]]
fi
echo "sha=$GITHUB_SHA" >> "$GITHUB_OUTPUT"`;
export const DEPLOY_SHA_GUARD=`set -euo pipefail
[[ "$APPROVED_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$APPROVED_SHA" == "$GITHUB_SHA" && "$CHECKED_SHA" == "$APPROVED_SHA" ]]
remote_sha="$(git ls-remote --refs "https://github.com/$GITHUB_REPOSITORY.git" refs/heads/main | cut -f1)"
[[ "$remote_sha" == "$APPROVED_SHA" ]]`;
export function guardedWorkflow(source:string){
  try{const w=parse(source),check=w.jobs?.check,deploy=w.jobs?.deploy,guard=check?.steps?.find((s:{id?:string})=>s.id==='identity'),last=deploy?.steps?.[0],upload=check?.steps?.find((s:{uses?:string})=>s.uses?.startsWith('actions/upload-pages-artifact@'));
    return w.on?.workflow_dispatch?.inputs?.expected_sha?.required===true&&guard?.run?.trim()===CHECK_SHA_GUARD&&guard?.env?.EXPECTED_SHA==='${{ inputs.expected_sha }}'&&guard?.env?.STUDIO_REQUEST==='${{ inputs.studio_request }}'&&check?.outputs?.checked_sha==='${{ steps.identity.outputs.sha }}'&&last?.run?.trim()===DEPLOY_SHA_GUARD&&last?.env?.APPROVED_SHA==='${{ inputs.expected_sha }}'&&last?.env?.CHECKED_SHA==='${{ needs.check.outputs.checked_sha }}'&&deploy?.needs==='check'&&deploy.if?.includes("github.event_name == 'workflow_dispatch'")&&deploy.if.includes("github.ref == 'refs/heads/main'")&&upload?.with?.path==='dist'&&upload.if?.includes("github.event_name == 'workflow_dispatch'")&&check.steps.some((s:{run?:string})=>s.run?.includes('node scripts/release/record.mjs'));
  }catch{return false;}
}

/** Only the reviewed workflow's declared content protocol can enable delegated verification. */
export function supportsThinkFast(source:string){
  if(!guardedWorkflow(source))return false;
  try{
    const steps=parse(source).jobs.check.steps as {id?:string;run?:string;if?:string;env?:Record<string,string>}[];
    return steps.some(s=>s.id==='think_scope'&&s.run?.includes('STUDIO_THINK_FAST_V1')&&s.run.includes('git diff-tree'))&&
      steps.some(s=>s.run==='node --experimental-strip-types scripts/release/check-think.mjs "$APPROVED_ARTICLE"'&&
        s.if==="steps.think_scope.outputs.article != ''"&&s.env?.APPROVED_ARTICLE==='${{ steps.think_scope.outputs.article }}');
  }catch{return false;}
}
