import type { ModulePage } from '../../core/module/types';
import Index from './Index.astro';
import Project from './Project.astro';
import { projects } from './data';
export default [
  { path: '', component: Index, props: {}, head: { description: '真正做过的项目，以及构建过程留下的理解。' } },
  ...projects.map((project) => ({ path: project.slug, component: Project, props: { project }, head: { title: `${project.title} — Build`, description: project.summary } })),
] satisfies ModulePage[];
