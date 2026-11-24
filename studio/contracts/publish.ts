import type {ThinkDocument} from './think.ts';
import type {Project} from './build.ts';

export type ProposalBinding={id:string;revision:string;candidateHash:string};
/** Backend snapshot only. HTTP prepare accepts a saved proposal or a real source reference. */
export type PublicationSelection=
  |{module:'think';document:ThinkDocument;key?:string;expectedSourceRevision:string|null;proposal?:ProposalBinding}
  |{module:'build';project:Project;key?:string;expectedSourceRevision:string;proposal?:ProposalBinding};
export type PublicationPhase='prepared'|'committing'|'checking'|'saving'|'pushing'|'dispatching'|'waiting'|'deploying'|'verifying'|'complete'|'failed'|'unknown'|'closed';
export const awaitingPages = (phase: PublicationPhase) => phase === 'waiting' || phase === 'deploying' || phase === 'verifying';
export type PublicationBoundary='not-started'|'in-flight'|'confirmed'|'unknown';
export interface PublicationStatus{
  version:1;id:string;bindingHash:string;module:'think'|'build';slug:string;
  repository:string;branch:'main';phase:PublicationPhase;message:string;
  sourceState:PublicationBoundary;commitState:PublicationBoundary;pushState:PublicationBoundary;dispatchState:PublicationBoundary;
  sourceKey:string;sourceAfterRevision:string;remoteBaseSha:string;localHeadSha:string;
  commitSha?:string;runId?:number;artifactId?:number;artifactDigest?:string;
  live:boolean;fileHashes?:Record<string,string>;observations?:string[];
  verification?:'github-think-v1';
  cleanupPending?:boolean;
  /** Computed from receipt bytes, not persisted. */
  revision?:string;
}
export interface PublicationPlan{
  id:string;bindingHash:string;module:'think'|'build';slug:string;repository:string;branch:'main';site:string;
  remoteBaseSha:string;localHeadSha:string;remoteDiff:string;localDiff:string;canExecute:boolean;issues:string[];
  verification?:'github-think-v1';
}
