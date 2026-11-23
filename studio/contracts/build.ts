import type { Project } from '../../src/modules/build/projects.ts';
export type { Project } from '../../src/modules/build/projects.ts';
export interface ProjectCollection { entries: Project[]; revision: string }
export interface ProjectRecord { project: Project; revision: string }
export interface ProjectWrite { revision: string; cleanupPending: boolean }
