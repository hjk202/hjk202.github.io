import type { Project } from '../contracts/build.ts';
import { stringArray, linkArray, recordArray, textField, selectField } from './form-fields.ts';

type ProjectBody=Partial<Pick<Project,'keywords'|'links'|'sections'|'milestones'|'updates'|'issues'>>;
export function projectFields(root: HTMLElement, project: ProjectBody, changed: () => void, prefix='build') {
  const get = (name: string) => root.querySelector<HTMLElement>('#'+prefix+'-' + name);
  const host = (parent: HTMLElement) => { const div = document.createElement('div'); parent.append(div); return div; };
  for (const name of ['keywords', 'links', 'sections', 'milestones', 'updates', 'issues']) get(name)?.replaceChildren();
  const keywords = project.keywords ?? [], links = project.links ?? [];
  const keywordHost=get('keywords'),linkHost=get('links'),sectionHost=get('sections'),milestoneHost=get('milestones'),updateHost=get('updates'),issueHost=get('issues');
  if(keywordHost)stringArray(keywordHost, keywords, '关键词', () => { project.keywords = keywords; changed(); });
  if(linkHost)linkArray(linkHost, links, () => { project.links = links; changed(); });
  const sections=project.sections??[];
  if(sectionHost)recordArray<Project['sections'][number]>(sectionHost, sections, '内容章节', () => ({ paragraphs: [''] }), (parent, section) => {
    textField(parent, '章节标题（可选）', section.title ?? '', value => { if (value === '') delete section.title; else section.title = value; changed(); });
    const paragraphs = section.paragraphs ?? [], items = section.items ?? [];
    stringArray(host(parent), paragraphs, '内容段落', () => { section.paragraphs = paragraphs; changed(); });
    stringArray(host(parent), items, '列表项', () => { section.items = items; changed(); });
    textField(parent, '代码（可选，保留换行）', section.code ?? '', value => { if (value === '') delete section.code; else section.code = value; changed(); }, true);
  }, () => { project.sections=sections;changed(); });
  const milestones = project.milestones ?? [];
  if(milestoneHost)recordArray<NonNullable<Project['milestones']>[number]>(milestoneHost, milestones, '阶段目标', () => ({ title: '', status: 'planned' }), (parent, stage) => {
    textField(parent, '阶段标题', stage.title, value => { stage.title = value; changed(); });
    selectField(parent, '阶段状态', stage.status, [['planned', '待开始'], ['in-progress', '进行中'], ['done', '完成']], value => { stage.status = value as typeof stage.status; changed(); });
    textField(parent, '阶段说明（可选）', stage.description ?? '', value => { if (value === '') delete stage.description; else stage.description = value; changed(); }, true);
  }, () => { project.milestones = milestones; changed(); });
  const updates = project.updates ?? [];
  if(updateHost)recordArray<NonNullable<Project['updates']>[number]>(updateHost, updates, '进展记录', () => {
    const today = new Date(); return { title: '', date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`, accomplishments: [''] };
  }, (parent, update) => {
    textField(parent, '记录标题', update.title, value => { update.title = value; changed(); });
    textField(parent, '记录日期 YYYY-MM-DD', update.date, value => { update.date = value; changed(); });
    for (const [key, label] of [['accomplishments', '完成了什么'], ['challenges', '遇到的问题'], ['nextSteps', '下一步']] as const) {
      const values = update[key] ?? []; stringArray(host(parent), values, label, () => { update[key] = values; changed(); });
    }
  }, () => { project.updates = updates; changed(); });
  const issues = project.issues ?? [];
  if(issueHost)recordArray<NonNullable<Project['issues']>[number]>(issueHost, issues, '问题与复盘', () => ({ title: '', description: '', status: 'open' }), (parent, issue) => {
    textField(parent, '问题标题', issue.title, value => { issue.title = value; changed(); });
    textField(parent, '问题说明', issue.description, value => { issue.description = value; changed(); }, true);
    selectField(parent, '问题状态', issue.status, [['open', '待解决'], ['resolved', '已解决']], value => { issue.status = value as typeof issue.status; changed(); });
    textField(parent, '解决方式（可选）', issue.resolution ?? '', value => { if (value === '') delete issue.resolution; else issue.resolution = value; changed(); }, true);
  }, () => { project.issues = issues; changed(); });
}
