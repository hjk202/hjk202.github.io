import type { Bookmark, KeepCollection, KeepWrite } from '../contracts/keep.ts';
import type { ExitEditor } from './desktop.ts';
import { ApiError } from './api.ts';
import { authoringRequest } from './authoring-request.ts';

export function installKeepEditor(token: string): ExitEditor & { root: HTMLElement; save(): Promise<void> } {
  const root = document.createElement('section'); root.id = 'keep-editor'; root.hidden = true;
  root.innerHTML = `<h2>收藏</h2>
  <div class="toolbar"><button id="keep-new" type="button">新建收藏</button><details id="keep-list-options" class="control-menu"><summary>列表</summary><div class="control-menu-content"><button id="keep-refresh" type="button">刷新收藏</button></div></details></div>
  <ul id="keep-list"></ul><form id="keep-form" hidden><fieldset id="keep-fields">
  <label>标题<input id="keep-title"></label><label>来源链接<input id="keep-sourceUrl" type="url"></label><label>说明<textarea id="keep-description"></textarea></label><label>slug<input id="keep-slug"></label>
  <details id="keep-properties"><summary>分类与公开状态</summary><label>分类 ID<input id="keep-category-id"></label><label>分类名称<input id="keep-category-label"></label>
  <label>类型<input id="keep-kind"></label><label>公开状态<select id="keep-published"><option value="">省略（draft）</option><option value="false">draft</option><option value="true">published</option></select></label>
  </details><details id="keep-extra-notes"><summary>补充笔记</summary><div id="keep-notes"></div><button id="keep-add-note" type="button">添加说明段落</button></details></fieldset>
  <div class="toolbar"><button id="keep-save" type="button">保存收藏</button><button id="keep-validate" type="button">校验收藏</button><button id="keep-preview" type="button">预览收藏</button><button id="keep-cancel-preview" type="button" hidden>取消收藏预览</button><button id="keep-reload" type="button">重新读取收藏</button><button id="keep-delete" type="button">删除收藏</button></div></form>
  <p id="keep-message" role="status"></p><div id="keep-preview-frame"></div>`;
  document.body.append(root);
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>('#keep-' + id)!;
  let candidate: Bookmark | undefined, key: string | undefined, baseline = '', revision = '';
  let busy = false, previewing = false, composing = false, blocked = false, closing = false, epoch = 0;
  let controller: AbortController | undefined;
  let entries: Bookmark[] = [];
  const dirty = () => candidate !== undefined && JSON.stringify(candidate) !== baseline;
  const say = (text: string) => { get('message').textContent = text; };
  const show = () => { root.hidden = false; (document.querySelector('.workspace') as HTMLElement).hidden = true; };
  function render() {
    get<HTMLFormElement>('form').hidden = !candidate;
    get<HTMLFieldSetElement>('fields').disabled = busy || closing;
    for (const name of ['new', 'refresh', 'save', 'validate', 'preview', 'reload', 'delete', 'add-note']) get<HTMLButtonElement>(name).disabled = busy || closing || previewing || composing || (['save', 'delete'].includes(name) && blocked);
    get<HTMLButtonElement>('delete').disabled ||= !key;
    get<HTMLInputElement>('slug').readOnly = key !== undefined;
    get<HTMLButtonElement>('cancel-preview').hidden = !previewing;
  }
  function invalidate() { epoch++; controller?.abort(); get('preview-frame').replaceChildren(); }
  function fill() {
    if (!candidate) return render();
    for (const name of ['slug', 'title', 'description', 'sourceUrl', 'kind'] as const) get<HTMLInputElement>(name).value = candidate[name] ?? '';
    get<HTMLInputElement>('category-id').value = candidate.category?.id ?? '';
    get<HTMLInputElement>('category-label').value = candidate.category?.label ?? '';
    get<HTMLSelectElement>('published').value = candidate.published === undefined ? '' : String(candidate.published);
    const notes = get('notes'); notes.replaceChildren();
    candidate.note.forEach((text, index) => {
      const label = document.createElement('label'), input = document.createElement('textarea'), remove = document.createElement('button');
      label.textContent = `说明段落 ${index + 1}`; input.value = text;
      input.addEventListener('input', () => { candidate!.note[index] = input.value; invalidate(); });
      remove.type = 'button'; remove.textContent = `删除段落 ${index + 1}`;
      remove.addEventListener('click', () => { candidate!.note.splice(index, 1); invalidate(); fill(); });
      label.append(input, remove); notes.append(label);
    }); render();
  }
  const request = authoringRequest(token, 'keep');
  function report(error: unknown, mutation = false) {
    const code = error instanceof ApiError ? error.code : 'INVALID_RESPONSE';
    if (['REVISION_CONFLICT', 'UNAUTHORIZED', 'NOT_FOUND'].includes(code) || mutation && ['CONNECTION_LOST', 'INVALID_RESPONSE'].includes(code)) blocked = true;
    say(`操作未完成（${code}）。缓冲保留；冲突或写入结果不明时请重新读取、人工核对，不自动重试。`);
  }
  async function load() {
    const data = await request<KeepCollection>('GET', 'documents');
    entries = data.entries;
    const list = get('list'); list.replaceChildren();
    for (const entry of entries) {
      const li = document.createElement('li'), button = document.createElement('button'); button.type = 'button';
      button.textContent = `${entry.title} · ${entry.published === true ? 'published' : 'draft'}`;
      button.addEventListener('click', () => { if (busy || closing || previewing || dirty() && !confirm('放弃当前收藏的未保存修改？')) return; select(entry, data.revision); });
      li.append(button); list.append(li);
    }
    return data;
  }
  function select(entry: Bookmark, currentRevision: string) { invalidate(); candidate = structuredClone(entry); key = entry.slug; revision = currentRevision; baseline = JSON.stringify(candidate); blocked = false; fill(); say('已读取收藏；尚未修改。'); }
  async function save() {
    if (!candidate || busy || blocked || composing) return;
    invalidate(); while (previewing) await new Promise(resolve => setTimeout(resolve, 20));
    busy = true; render();
    try {
      const result = await request<KeepWrite>(key ? 'PUT' : 'POST', 'documents' + (key ? '/' + key : ''), { bookmark: structuredClone(candidate), expectedRevision: revision });
      key = candidate.slug; revision = result.revision; baseline = JSON.stringify(candidate); blocked = !!result.cleanupPending;
      await load(); say(result.cleanupPending ? '已保存，临时文件清理待处理。请核对后重新读取。' : '已保存到本地源码；未提交或发布。');
    } catch (error) { report(error, true); show(); } finally { busy = false; render(); }
  }
  root.addEventListener('compositionstart', () => { composing = true; render(); });
  root.addEventListener('compositionend', () => { composing = false; render(); });
  get('form').addEventListener('submit', event => event.preventDefault());
  for (const name of ['slug', 'title', 'description', 'sourceUrl', 'kind', 'published', 'category-id', 'category-label']) get(name).addEventListener('input', () => {
    if (!candidate) return;
    const value = get<HTMLInputElement>(name).value;
    if (name === 'published') { if (value === '') delete candidate.published; else candidate.published = value === 'true'; }
    else if (name.startsWith('category-')) {
      const id = get<HTMLInputElement>('category-id').value, label = get<HTMLInputElement>('category-label').value;
      if (!id && !label) delete candidate.category; else candidate.category = { id, label };
    } else if (name === 'kind') { if (value === '') delete candidate.kind; else candidate.kind = value; }
    else candidate[name as 'slug' | 'title' | 'description' | 'sourceUrl'] = value;
    invalidate();
  });
  get('add-note').addEventListener('click', () => { candidate?.note.push(''); invalidate(); fill(); });
  get('new').addEventListener('click', () => { void (async () => {
    if (busy || dirty() && !confirm('放弃当前收藏的未保存修改？')) return;
    busy = true; render();
    try { const data = await load(); revision = data.revision; candidate = { slug: '', title: '', description: '', sourceUrl: '', note: [''], published: false }; key = undefined; baseline = ''; blocked = false; invalidate(); fill(); say('新建 draft，尚未保存。'); }
    catch (error) { report(error); } finally { busy = false; render(); }
  })(); });
  get('refresh').addEventListener('click', () => { void (async () => { if (busy) return; busy = true; render(); try { await load(); say('列表已刷新，编辑版本与缓冲未覆盖。'); } catch (error) { report(error); } finally { busy = false; render(); } })(); });
  get('save').addEventListener('click', () => { void save(); });
  get('reload').addEventListener('click', () => { void (async () => {
    if (!key || busy || dirty() && !confirm('放弃修改并重新读取收藏？')) return;
    busy = true; render(); try { const data = await load(), entry = data.entries.find(item => item.slug === key); if (!entry) throw new ApiError('NOT_FOUND'); select(entry, data.revision); } catch (error) { report(error); } finally { busy = false; render(); }
  })(); });
  get('delete').addEventListener('click', () => { void (async () => {
    if (!key || blocked || busy || !confirm('确认删除当前收藏？此操作将修改本地源码。')) return;
    busy = true; render(); try { await request('DELETE', 'documents/' + key, { expectedRevision: revision }); candidate = undefined; key = undefined; baseline = ''; invalidate(); await load(); say('收藏已从源码删除，未提交或发布。'); } catch (error) { report(error, true); } finally { busy = false; render(); }
  })(); });
  for (const action of ['validate', 'preview']) get(action).addEventListener('click', () => { void (async () => {
    if (!candidate || busy || previewing) return;
    invalidate(); const version = epoch, abort = new AbortController(); controller = abort;
    if (action === 'preview') previewing = true; else busy = true; render(); say(action === 'preview' ? '正在隔离构建收藏预览…' : '正在校验…');
    try {
      const result = await request<{ html?: string }>('POST', action, { bookmark: structuredClone(candidate), ...(key ? { key } : {}) }, abort.signal);
      if (version !== epoch || abort.signal.aborted) return;
      if (action === 'preview') { const frame = document.createElement('iframe'); frame.title = 'Keep 隔离预览'; frame.setAttribute('sandbox', ''); frame.referrerPolicy = 'no-referrer'; frame.srcdoc = result.html!; get('preview-frame').replaceChildren(frame); }
      say(action === 'preview' ? '预览完成，未保存源文件。' : '收藏校验通过。');
    } catch (error) { if (!abort.signal.aborted) report(error); } finally { controller = undefined; busy = false; previewing = false; render(); }
  })(); });
  get('cancel-preview').addEventListener('click', invalidate);
  render();
  return { root, dirty, unsettled: () => busy || composing, uncertain: () => blocked,
    canSave: () => !dirty() || !!candidate && !busy && !blocked && !composing,
    save, closing: value => { closing = value; render(); }, finish: invalidate, resume: () => {},
  };
}
