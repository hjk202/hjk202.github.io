import type { Project, ProjectCollection, ProjectWrite } from '../contracts/build.ts';
import type { ExitEditor } from './desktop.ts';
import { ApiError } from './api.ts';
import { authoringRequest } from './authoring-request.ts';
import { projectFields } from './project-fields.ts';

export function installBuildEditor(token: string): ExitEditor & { root: HTMLElement; save(): Promise<void> } {
  const root = document.createElement('section'); root.id = 'build-editor'; root.hidden = true;
  root.innerHTML = `<h2>项目</h2>
  <div class="toolbar"><button id="build-new" type="button">新建项目</button><details class="control-menu"><summary>列表</summary><div class="control-menu-content"><button id="build-refresh" type="button">刷新项目</button></div></details></div><ul id="build-list"></ul>
  <form id="build-form" hidden><fieldset id="build-fields"><div class="toolbar" id="build-steps"></div>
  <section data-build-step="基本信息"><label>项目标题<input id="build-title"></label><label>项目摘要<textarea id="build-summary"></textarea></label><label>项目 slug<input id="build-slug"></label><label>项目状态<select id="build-status"><option value="">省略</option><option value="in-progress">进行中</option><option value="completed">完成</option><option value="paused">暂停</option></select></label><label>项目公开状态<select id="build-published"><option value="">省略（draft）</option><option value="false">draft</option><option value="true">published</option></select></label><details id="build-properties"><summary>周期、关键词与链接</summary><label>记录周期（可选）<input id="build-period"></label><div id="build-keywords"></div><div id="build-links"></div></details></section>
  <section data-build-step="技术内容" hidden><div id="build-sections"></div></section><section data-build-step="阶段目标" hidden><div id="build-milestones"></div></section><section data-build-step="进展记录" hidden><div id="build-updates"></div></section><section data-build-step="问题与复盘" hidden><div id="build-issues"></div></section>
  </fieldset><div class="toolbar"><button id="build-save" type="button">保存项目</button><button id="build-validate" type="button">校验项目</button><button id="build-preview" type="button">预览项目</button><button id="build-cancel-preview" type="button" hidden>取消项目预览</button><button id="build-reload" type="button">重新读取项目</button><button id="build-delete" type="button">删除项目</button></div></form>
  <p id="build-message" role="status"></p><div id="build-preview-frame"></div>`;
  document.body.append(root);
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>('#build-' + id)!;
  let candidate: Project | undefined, key: string | undefined, baseline = '', revision = '';
  let busy = false, previewing = false, composing = false, blocked = false, closing = false, epoch = 0;
  let controller: AbortController | undefined;
  let entries: Project[] = [];
  const dirty = () => candidate !== undefined && JSON.stringify(candidate) !== baseline;
  const say = (text: string) => { get('message').textContent = text; };
  const show = () => { root.hidden = false; (document.querySelector('.workspace') as HTMLElement).hidden = true; };
  function render() {
    get<HTMLFormElement>('form').hidden = !candidate;
    get<HTMLFieldSetElement>('fields').disabled = busy || closing;
    for (const name of ['new', 'refresh', 'save', 'validate', 'preview', 'reload', 'delete']) get<HTMLButtonElement>(name).disabled = busy || closing || previewing || composing || (['save', 'delete'].includes(name) && blocked);
    get<HTMLButtonElement>('delete').disabled ||= !key;
    get<HTMLInputElement>('slug').readOnly = key !== undefined;
    get<HTMLButtonElement>('cancel-preview').hidden = !previewing;
  }
  function invalidate() { epoch++; controller?.abort(); get('preview-frame').replaceChildren(); }
  function fill() {
    if (!candidate) return render();
    for (const field of ['slug','title','summary','period'] as const) get<HTMLInputElement>(field).value = candidate[field] ?? '';
    get<HTMLSelectElement>('status').value = candidate.status ?? '';
    get<HTMLSelectElement>('published').value = candidate.published === undefined ? '' : String(candidate.published);
    projectFields(root, candidate, invalidate); render();
  }
  const request = authoringRequest(token, 'build');
  function report(error: unknown, mutation = false) {
    const code = error instanceof ApiError ? error.code : 'INVALID_RESPONSE';
    if (['REVISION_CONFLICT', 'UNAUTHORIZED', 'NOT_FOUND'].includes(code) || mutation && ['CONNECTION_LOST', 'INVALID_RESPONSE'].includes(code)) blocked = true;
    say(code === 'PRIVATE_REFERENCES_UNKNOWN' ? '正式 Vault 存在，无法核对私人补充关联。已阻止删除或取消公开；请先在本机核对，不会自动解密或强制覆盖。' : `操作未完成（${code}）。缓冲保留；冲突或写入结果不明时请重新读取、人工核对，不自动重试。`);
  }
  async function load() {
    const data = await request<ProjectCollection>('GET', 'documents');
    entries = data.entries;
    const list = get('list'); list.replaceChildren();
    for (const entry of entries) {
      const li = document.createElement('li'), button = document.createElement('button'); button.type = 'button';
      button.textContent = `${entry.title} · ${entry.published === true ? 'published' : 'draft'}`;
      button.addEventListener('click', () => { if (busy || closing || previewing || dirty() && !confirm('放弃当前项目的未保存修改？')) return; select(entry, data.revision); });
      li.append(button); list.append(li);
    }
    return data;
  }
  function select(entry: Project, currentRevision: string) { invalidate(); candidate = structuredClone(entry); key = entry.slug; revision = currentRevision; baseline = JSON.stringify(candidate); blocked = false; fill(); say('已读取项目；尚未修改。'); }
  async function save() {
    if (!candidate || busy || blocked || composing) return;
    invalidate(); while (previewing) await new Promise(resolve => setTimeout(resolve, 20));
    busy = true; render();
    try {
      const result = await request<ProjectWrite>(key ? 'PUT' : 'POST', 'documents' + (key ? '/' + key : ''), { project: structuredClone(candidate), expectedRevision: revision });
      key = candidate.slug; revision = result.revision; baseline = JSON.stringify(candidate); blocked = !!result.cleanupPending;
      await load(); say(result.cleanupPending ? '已保存，临时文件清理待处理。请核对后重新读取。' : '已保存到本地源码；未提交或发布。');
    } catch (error) { report(error, true); show(); } finally { busy = false; render(); }
  }
  root.addEventListener('compositionstart', () => { composing = true; render(); });
  root.addEventListener('compositionend', () => { composing = false; render(); });
  get('form').addEventListener('submit', event => event.preventDefault());
  for (const name of ['slug','title','summary','period','published','status']) get(name).addEventListener('input', () => {
    if (!candidate) return; const value = get<HTMLInputElement>(name).value;
    if (name === 'published') { if (value === '') delete candidate.published; else candidate.published = value === 'true'; }
    else if (name === 'status') { if (value === '') delete candidate.status; else candidate.status = value as NonNullable<Project['status']>; }
    else if (name === 'period') { if (value === '') delete candidate.period; else candidate.period = value; }
    else candidate[name as 'slug'|'title'|'summary'] = value;
    invalidate();
  });
  for (const panel of root.querySelectorAll<HTMLElement>('[data-build-step]')) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = panel.dataset.buildStep!;
    button.setAttribute('aria-current', String(!panel.hidden));
    button.addEventListener('click', () => {
      for (const sibling of root.querySelectorAll<HTMLElement>('[data-build-step]')) sibling.hidden = sibling !== panel;
      for (const tab of get('steps').querySelectorAll('button')) tab.setAttribute('aria-current', String(tab === button));
    });
    get('steps').append(button);
  }
  get('new').addEventListener('click', () => { void (async () => {
    if (busy || dirty() && !confirm('放弃当前项目的未保存修改？')) return;
    busy = true; render();
    try { const data = await load(); revision = data.revision; candidate = { slug: '', title: '', summary: '', sections: [{ paragraphs: [''] }], published: false }; key = undefined; baseline = ''; blocked = false; invalidate(); fill(); say('新建 draft，尚未保存。'); }
    catch (error) { report(error); } finally { busy = false; render(); }
  })(); });
  get('refresh').addEventListener('click', () => { void (async () => { if (busy) return; busy = true; render(); try { await load(); say('列表已刷新，编辑版本与缓冲未覆盖。'); } catch (error) { report(error); } finally { busy = false; render(); } })(); });
  get('save').addEventListener('click', () => { void save(); });
  get('reload').addEventListener('click', () => { void (async () => {
    if (!key || busy || dirty() && !confirm('放弃修改并重新读取项目？')) return;
    busy = true; render(); try { const data = await load(), entry = data.entries.find(item => item.slug === key); if (!entry) throw new ApiError('NOT_FOUND'); select(entry, data.revision); } catch (error) { report(error); } finally { busy = false; render(); }
  })(); });
  get('delete').addEventListener('click', () => { void (async () => {
    if (!key || blocked || busy || !confirm('确认删除当前项目？此操作将修改本地源码。')) return;
    busy = true; render(); try { await request('DELETE', 'documents/' + key, { expectedRevision: revision }); candidate = undefined; key = undefined; baseline = ''; invalidate(); await load(); say('项目已从源码删除，未提交或发布。'); } catch (error) { report(error, true); } finally { busy = false; render(); }
  })(); });
  for (const action of ['validate', 'preview']) get(action).addEventListener('click', () => { void (async () => {
    if (!candidate || busy || previewing) return;
    invalidate(); const version = epoch, abort = new AbortController(); controller = abort;
    if (action === 'preview') previewing = true; else busy = true; render(); say(action === 'preview' ? '正在隔离构建项目预览…' : '正在校验…');
    try {
      const result = await request<{ html?: string }>('POST', action, { project: structuredClone(candidate), ...(key ? { key } : {}) }, abort.signal);
      if (version !== epoch || abort.signal.aborted) return;
      if (action === 'preview') { const frame = document.createElement('iframe'); frame.title = 'Build 隔离预览'; frame.setAttribute('sandbox', ''); frame.referrerPolicy = 'no-referrer'; frame.srcdoc = result.html!; get('preview-frame').replaceChildren(frame); }
      say(action === 'preview' ? '预览完成，未保存源文件。' : '项目校验通过。');
    } catch (error) { if (!abort.signal.aborted) report(error); } finally { controller = undefined; busy = false; previewing = false; render(); }
  })(); });
  get('cancel-preview').addEventListener('click', invalidate);
  render();
  return { root, dirty, unsettled: () => busy || composing, uncertain: () => blocked,
    canSave: () => !dirty() || !!candidate && !busy && !blocked && !composing,
    save, closing: value => { closing = value; render(); }, finish: invalidate, resume: () => {},
  };
}
