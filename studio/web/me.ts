import type { Profile, ProfileRecord, ProfileWrite } from '../contracts/me.ts';
import type { ExitEditor } from './desktop.ts';
import { ApiError } from './api.ts';
import { authoringRequest } from './authoring-request.ts';
import { stringArray, linkArray } from './form-fields.ts';

export function installMeEditor(token: string): ExitEditor & { root: HTMLElement; open(): Promise<void> } {
  const request = authoringRequest(token, 'me');
  const root = document.createElement('section'); root.id = 'me-editor'; root.hidden = true;
  root.innerHTML = `<h2>个人资料</h2>
  <div class="toolbar"><button id="me-new" type="button">新建资料</button><button id="me-reload" type="button">重新读取资料</button></div><p id="me-empty">尚未读取资料。</p>
  <form id="me-form" hidden><fieldset id="me-fields"><label>姓名<input id="me-name"></label><label>介绍<textarea id="me-description"></textarea></label>
  <div id="me-paragraphs"></div><details id="me-properties"><summary>公开状态与链接</summary><label>资料公开状态<select id="me-published"><option value="">省略（draft）</option><option value="false">draft</option><option value="true">published</option></select></label>
  <div id="me-links"></div></details></fieldset></form>
  <div class="toolbar"><button id="me-save" type="button">保存资料</button><button id="me-clear" type="button">清空资料</button><button id="me-validate" type="button">校验资料</button><button id="me-preview" type="button">预览资料</button><button id="me-cancel-preview" type="button" hidden>取消资料预览</button></div><p id="me-message" role="status"></p><div id="me-preview-frame"></div>`;
  document.body.append(root);
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>('#me-' + id)!;
  let profile: Profile | null = null, baseline = 'null', revision = '', loaded = false;
  let busy = false, blocked = false, closing = false, composing = false, epoch = 0;
  let controller: AbortController | undefined;
  const dirty = () => JSON.stringify(profile) !== baseline;
  const say = (text: string) => { get('message').textContent = text; };
  const invalidate = () => { epoch++; controller?.abort(); get('preview-frame').replaceChildren(); };
  function render() {
    get<HTMLFormElement>('form').hidden = profile === null;
    get('empty').hidden = profile !== null; get('empty').textContent = loaded ? '当前源为 null，没有资料。新建由你显式决定。' : '尚未读取资料。';
    get<HTMLFieldSetElement>('fields').disabled = busy || closing;
    for (const action of ['save', 'clear', 'new', 'reload', 'validate', 'preview']) get<HTMLButtonElement>(action).disabled = busy || closing || !!controller || composing || !loaded && action !== 'reload';
    get<HTMLButtonElement>('save').disabled ||= !profile || blocked;
    get<HTMLButtonElement>('clear').disabled ||= !profile || blocked;
    get<HTMLButtonElement>('new').disabled ||= profile !== null;
    get('new').hidden = profile !== null;
    get<HTMLButtonElement>('cancel-preview').hidden = !controller;
  }
  function fill() {
    invalidate();
    if (profile) {
      get<HTMLInputElement>('name').value = profile.name; get<HTMLTextAreaElement>('description').value = profile.description;
      get<HTMLSelectElement>('published').value = profile.published === undefined ? '' : String(profile.published);
      stringArray(get('paragraphs'), profile.paragraphs, '介绍段落', invalidate);
      const links = profile.links ?? [];
      linkArray(get('links'), links, () => { profile!.links = links; invalidate(); });
    } else { get('paragraphs').replaceChildren(); get('links').replaceChildren(); }
    render();
  }
  function report(error: unknown, mutation = false) {
    const code = error instanceof ApiError ? error.code : 'INVALID_RESPONSE';
    if (['REVISION_CONFLICT', 'UNAUTHORIZED', 'NOT_FOUND'].includes(code) || mutation && ['CONNECTION_LOST', 'INVALID_RESPONSE'].includes(code)) blocked = true;
    say(`资料操作未完成（${code}）。源与缓冲保留；先重新读取、人工核对，不自动重试。`);
  }
  async function open(force = false) {
    if (busy || loaded && !force || dirty() && !confirm('放弃资料修改并重新读取？')) return;
    invalidate(); busy = true; render();
    try { const state = await request<ProfileRecord>('GET', 'profile'); profile = state.profile; revision = state.revision; baseline = JSON.stringify(profile); loaded = true; blocked = false; fill(); say('资料已读取。'); }
    catch (error) { report(error); } finally { busy = false; render(); }
  }
  async function save() {
    if (!profile || busy || blocked || composing) return;
    invalidate(); while (controller) await new Promise(resolve => setTimeout(resolve, 20)); busy = true; render();
    try { const result = await request<ProfileWrite>('PUT', 'profile', { profile: structuredClone(profile), expectedRevision: revision }); revision = result.revision; baseline = JSON.stringify(profile); blocked = result.cleanupPending; say(result.cleanupPending ? '资料已保存，临时文件清理待处理。' : '资料已保存到本地源码，未提交或发布。'); }
    catch (error) { report(error, true); } finally { busy = false; render(); }
  }
  get('form').addEventListener('submit', event => event.preventDefault());
  root.addEventListener('compositionstart', () => { composing = true; render(); }); root.addEventListener('compositionend', () => { composing = false; render(); });
  for (const field of ['name', 'description', 'published']) get(field).addEventListener('input', () => {
    if (!profile) return; const value = get<HTMLInputElement>(field).value;
    if (field === 'published') { if (value === '') delete profile.published; else profile.published = value === 'true'; }
    else profile[field as 'name' | 'description'] = value;
    invalidate();
  });
  get('new').addEventListener('click', () => { if (busy || !loaded || profile) return; profile = { name: '', description: '', paragraphs: [''], published: false }; fill(); say('新资料尚未保存，请填写真实内容。'); });
  get('reload').addEventListener('click', () => { void open(true); }); get('save').addEventListener('click', () => { void save(); });
  get('clear').addEventListener('click', () => { void (async () => {
    if (busy || blocked || !profile || !confirm('确认清空唯一资料为 null？这与取消公开不同，将修改本地源文件。')) return;
    busy = true; render(); try { const result = await request<ProfileWrite>('POST', 'clear', { expectedRevision: revision }); revision = result.revision; profile = null; baseline = 'null'; blocked = result.cleanupPending; fill(); say('资料已清空为 null，未提交或发布。'); }
    catch (error) { report(error, true); } finally { busy = false; render(); }
  })(); });
  for (const action of ['validate', 'preview']) get(action).addEventListener('click', () => { void (async () => {
    if (!loaded || busy || controller || composing) return;
    invalidate(); const version = epoch, abort = new AbortController();
    if (action === 'preview') controller = abort; else busy = true; render(); say(action === 'preview' ? '正在隔离构建资料预览…' : '正在校验资料…');
    try {
      const result = await request<{ html?: string }>('POST', action, { profile: structuredClone(profile) }, abort.signal);
      if (abort.signal.aborted || version !== epoch) return;
      if (action === 'preview') { const frame = document.createElement('iframe'); frame.title = 'Me 隔离预览'; frame.setAttribute('sandbox', ''); frame.referrerPolicy = 'no-referrer'; frame.srcdoc = result.html!; get('preview-frame').replaceChildren(frame); }
      say(action === 'preview' ? '资料预览完成，源文件未保存。' : '资料校验通过。');
    } catch (error) { if (!abort.signal.aborted) report(error); } finally { if (controller === abort) controller = undefined; busy = false; render(); }
  })(); });
  get('cancel-preview').addEventListener('click', invalidate);
  render(); return { root, open: () => open(), dirty, unsettled: () => busy || composing, uncertain: () => blocked, canSave: () => !dirty() || !!profile && !busy && !blocked && !composing,
    save, closing: value => { closing = value; render(); }, finish: invalidate, resume: () => {},
  };
}
