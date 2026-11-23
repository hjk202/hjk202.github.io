import type { VaultPayload } from '../../src/core/vault/crypto.ts';
import type { validateBuild } from '../../src/modules/build/vault.schema.ts';
type Schema=ReturnType<typeof validateBuild>;
type Project=Schema['projects'][number];type Supplement=Schema['supplements'][number];
type OptionalRecords='milestones'|'updates'|'issues';
type Update=Project['updates'][number];type Groups='accomplishments'|'challenges'|'nextSteps';
interface Records {milestones?:Project['milestones'];updates?:(Omit<Update,Groups>&Partial<Pick<Update,Groups>>)[];issues?:Project['issues']}
export type PrivateProject=Omit<Project,OptionalRecords|'keywords'|'links'>&Partial<Pick<Project,'keywords'|'links'>>&Records;
export type PrivateSupplement=Omit<Supplement,OptionalRecords|'sections'>&Partial<Pick<Supplement,'sections'>>&Records;
export interface PrivateBuild {projects:PrivateProject[];supplements:PrivateSupplement[]}
export function privateBuild(payload:VaultPayload):PrivateBuild {return (payload.modules.build as PrivateBuild|undefined)??{projects:[],supplements:[]};}
export function newPrivateProject():PrivateProject{return {id:crypto.randomUUID().replaceAll('-',''),title:'',summary:'',sections:[{paragraphs:['']}]};}
export function newPrivateSupplement():PrivateSupplement{return {id:crypto.randomUUID().replaceAll('-',''),publicSlug:'',title:'',sections:[{paragraphs:['']}]};}
