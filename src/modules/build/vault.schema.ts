import { array, date, httpUrl, object, opaqueId, strings, text, uniqueIds } from '../../core/vault/validation.ts';
function sections(value: unknown) {
  return array(value).map(value=>{
    const section=object(value,['title','paragraphs','items','code']);
    if(!Object.keys(section).length) throw new Error('Empty Build section');
    return { ...(section.title===undefined?{}:{title:text(section.title)}), ...(section.paragraphs===undefined?{}:{paragraphs:strings(section.paragraphs)}), ...(section.items===undefined?{}:{items:strings(section.items)}), ...(section.code===undefined?{}:{code:text(section.code,30000)}) };
  });
}
function records(entry: Record<string,unknown>) {
  const milestones=entry.milestones===undefined?[]:array(entry.milestones).map(value=>{
    const stage=object(value,['title','status','description']);
    if(!['planned','in-progress','done'].includes(String(stage.status))) throw new Error('Invalid Build stage');
    return {title:text(stage.title),status:stage.status as 'planned'|'in-progress'|'done',...(stage.description===undefined?{}:{description:text(stage.description)})};
  });
  const updates=entry.updates===undefined?[]:array(entry.updates).map(value=>{
    const update=object(value,['date','title','accomplishments','challenges','nextSteps']);
    const accomplishments=update.accomplishments===undefined?[]:strings(update.accomplishments);
    const challenges=update.challenges===undefined?[]:strings(update.challenges);
    const nextSteps=update.nextSteps===undefined?[]:strings(update.nextSteps);
    if(!accomplishments.length&&!challenges.length&&!nextSteps.length) throw new Error('Empty Build update');
    return {date:date(update.date),title:text(update.title),accomplishments,challenges,nextSteps};
  });
  const issues=entry.issues===undefined?[]:array(entry.issues).map(value=>{
    const issue=object(value,['title','description','status','resolution']);
    if(!['open','resolved'].includes(String(issue.status))) throw new Error('Invalid Build issue');
    return {title:text(issue.title),description:text(issue.description),status:issue.status as 'open'|'resolved',...(issue.resolution===undefined?{}:{resolution:text(issue.resolution)})};
  });
  return {milestones,updates,issues};
}
export function validateBuild(value: unknown) {
  const payload=object(value,['projects','supplements']);
  const projects=array(payload.projects).map(value=>{
    const entry=object(value,['id','title','summary','period','sections','keywords','links','status','milestones','updates','issues']);
    if(entry.status!==undefined&&!['in-progress','completed','paused'].includes(String(entry.status))) throw new Error('Invalid Build status');
    const links=entry.links===undefined?[]:array(entry.links,20).map(value=>{const link=object(value,['label','url']);return {label:text(link.label),url:httpUrl(link.url)};});
    const body=sections(entry.sections);
    if(!body.length) throw new Error('Missing Build sections');
    return {id:opaqueId(entry.id),title:text(entry.title),summary:text(entry.summary),sections:body,keywords:entry.keywords===undefined?[]:strings(entry.keywords,30),links,...records(entry),...(entry.period===undefined?{}:{period:text(entry.period)}),...(entry.status===undefined?{}:{status:entry.status as 'in-progress'|'completed'|'paused'})};
  });
  const supplements=array(payload.supplements).map(value=>{
    const entry=object(value,['id','publicSlug','title','sections','milestones','updates','issues']);
    const publicSlug=text(entry.publicSlug,100);
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicSlug)) throw new Error('Invalid public project');
    const body=entry.sections===undefined?[]:sections(entry.sections), record=records(entry);
    if(!body.length&&!record.milestones.length&&!record.updates.length&&!record.issues.length) throw new Error('Empty Build supplement');
    return {id:opaqueId(entry.id),publicSlug,title:text(entry.title),sections:body,...record};
  });
  uniqueIds([...projects,...supplements]);
  return {projects,supplements};
}
export function buildVaultCount(publicCount:number,payload:ReturnType<typeof validateBuild>) { return publicCount+payload.projects.length; }
