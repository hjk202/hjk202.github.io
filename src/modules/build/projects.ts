export interface ProjectSection {
  title?: string;
  paragraphs?: string[];
  items?: string[];
  code?: string;
}
export interface Project {
  slug: string;
  title: string;
  summary: string;
  published?: boolean;
  period?: string;
  sections: ProjectSection[];
  keywords?: string[];
  links?: { label: string; url: string }[];
  status?: 'in-progress' | 'completed' | 'paused';
  milestones?: { title: string; status: 'planned' | 'in-progress' | 'done'; description?: string }[];
  updates?: { date: string; title: string; accomplishments?: string[]; challenges?: string[]; nextSteps?: string[] }[];
  issues?: { title: string; description: string; status: 'open' | 'resolved'; resolution?: string }[];
}

export const projectStatusLabels = { 'in-progress': '进行中', completed: '已完成', paused: '暂停中' };
export const milestoneStatusLabels = { planned: '待开始', 'in-progress': '进行中', done: '已完成' };
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function publicProjects(entries: readonly Project[]): Project[] {
  const slugs = new Set<string>();
  return entries.filter((project) => {
    const context = `Build ${project.slug}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) throw new Error(`${context}: invalid slug`);
    if (slugs.has(project.slug)) throw new Error(`${context}: duplicate slug`);
    slugs.add(project.slug);
    if (project.published !== undefined && typeof project.published !== 'boolean') throw new Error(`${context}: published must be boolean`);
    if (project.published !== true) return false;
    if (![project.title, project.summary].every((text) => typeof text === 'string' && text.trim()) || !project.sections.length) throw new Error(`${context}: title, summary and sections are required`);
    if (project.period !== undefined && !project.period.trim()) throw new Error(`${context}: empty period`);
    for (const section of project.sections) {
      const text = [...section.paragraphs ?? [], ...section.items ?? [], ...section.title ? [section.title] : [], ...section.code ? [section.code] : []];
      if (!text.length || !text.every((value) => typeof value === 'string' && value.trim())) throw new Error(`${context}: invalid section`);
    }
    if (project.keywords?.some((word) => !word.trim())) throw new Error(`${context}: empty keyword`);
    if (project.status !== undefined && !Object.hasOwn(projectStatusLabels, project.status)) throw new Error(`${context}: invalid status`);
    for (const milestone of project.milestones ?? []) {
      if (!text(milestone.title) || !Object.hasOwn(milestoneStatusLabels, milestone.status) || (milestone.description !== undefined && !text(milestone.description))) throw new Error(`${context}: invalid milestone`);
    }
    for (const update of project.updates ?? []) {
      const groups = [update.accomplishments, update.challenges, update.nextSteps];
      if (!text(update.title) || !date(update.date) || !groups.some((group) => group?.length) || groups.some((group) => group !== undefined && (!Array.isArray(group) || !group.every(text)))) throw new Error(`${context}: invalid update`);
    }
    for (const issue of project.issues ?? []) {
      if (!text(issue.title) || !text(issue.description) || !['open', 'resolved'].includes(issue.status) || (issue.resolution !== undefined && !text(issue.resolution))) throw new Error(`${context}: invalid issue`);
    }
    for (const link of project.links ?? []) if (!link.label.trim() || !/^https?:\/\//.test(link.url) || !URL.canParse(link.url)) throw new Error(`${context}: invalid link`);
    return true;
  });
}
