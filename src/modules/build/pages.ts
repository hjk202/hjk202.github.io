import type { ModulePage } from '../../core/module/types';
import Index from './Index.astro';
import Project from './Project.astro';
import { projects } from './data';
export default [
  { path: '', component: Index, props: {} },
  ...projects.map((project) => ({ path: project.slug, component: Project, props: { project } })),
] satisfies ModulePage[];
