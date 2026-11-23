import type { ThinkDocument } from './think.ts';
import type {Project} from './build.ts';

export const INTAKE_MAX_MATERIAL = 64 * 1024;
export const PROPOSAL_MAX_RECORD = 384 * 1024;
export const PROPOSAL_MAX_COUNT = 64;
export const PROPOSAL_MAX_TOTAL = 16 * 1024 * 1024;
export type ProposalTarget = { mode:'create'; expectedSourceRevision?:string } | { mode:'update'; key:string; expectedSourceRevision:string };
export type ThinkCandidate = { metadata:Partial<ThinkDocument['metadata']>; body?:string };
export type ThinkSuggestedEdit = { before:string; after:string };
export type Evidence = { field:string; kind:'material'|'author'|'source'|'unconfirmed'; quote?:string };
export type ThinkProposal = {
  version:1; id:string; module:'think'; state:'pending'|'applying'; material:string;
  materialHash:string; candidate:ThinkCandidate; target:ProposalTarget; evidence:Evidence[];
  notes?:string[];
  writing?:true;
  intent?:{candidateHash:string;documentHash:string;key:string};
};
export type BuildCandidate=Omit<Partial<Project>,'links'|'milestones'|'updates'|'issues'>&{
  links?:Partial<NonNullable<Project['links']>[number]>[];
  milestones?:Partial<NonNullable<Project['milestones']>[number]>[];
  updates?:Partial<NonNullable<Project['updates']>[number]>[];
  issues?:Partial<NonNullable<Project['issues']>[number]>[];
};
export type BuildProposal=Omit<ThinkProposal,'module'|'candidate'|'writing'>&{module:'build';candidate:BuildCandidate};
export type PendingProposal=ThinkProposal|BuildProposal;
export type ProposalReceipt = {version:1;id:string;module:'think'|'build';state:'applied';candidateHash:string;key:string;sourceRevision:string};
export type Proposal = PendingProposal | ProposalReceipt;
export type ProposalView = Proposal & {revision:string;candidateHash:string;diagnostics:string[];canApply:boolean};
export type ProposalApproval = {expectedProposalRevision:string;candidateHash:string;target:ProposalTarget;factsConfirmed:true};
