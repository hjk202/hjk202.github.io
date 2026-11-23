import { ApiError, createThinkApi } from './api.ts';
import type { ThinkDocument, ThinkReadResult, ThinkSummary, ValidationIssue } from '../contracts/think.ts';
import type { AiOperation, ThinkAiStatus, ThinkTextSuggestion } from '../contracts/ai.ts';
import { installDesktopExit } from './desktop.ts';
import { installKeepEditor } from './keep.ts';
import { installMeEditor } from './me.ts';
import { installBuildEditor } from './build.ts';
import { installPrivateEditor } from './private.ts';
import { lazyEditor } from './lazy-editor.ts';
import {installIntake} from './intake.ts';
import{installPublish}from'./publish.ts';

export function startMaintenance() {
  const get = <T extends HTMLElement>(id: string): T => {
    const element = document.getElementById(id);
    if (!element) throw new Error('Studio 页面缺少必要控件。');
    return element as T;
  };
  const editor = get<HTMLFormElement>('editor');
  const fields = get<HTMLFieldSetElement>('fields');
  const list = get<HTMLUListElement>('documents');
  const filter = get<HTMLSelectElement>('filter');
  const message = get<HTMLParagraphElement>('message');
  const properties = get<HTMLDetailsElement>('think-properties');
  const aiTools = get<HTMLDetailsElement>('think-ai');
  const fieldIds = ['slug', 'title', 'summary', 'date', 'kind', 'published', 'body'] as const;
  type Field = typeof fieldIds[number];
  const inputs = Object.fromEntries(fieldIds.map(id => [id, get<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(id)])) as Record<Field, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
  const buttons = Object.fromEntries(['new', 'refresh', 'save', 'validate', 'reload', 'delete', 'preview', 'cancel-preview'].map(id => [id, get<HTMLButtonElement>(id)]));
  let candidate: ThinkDocument | null = null;
  let source: ThinkReadResult | null = null;
  let baseline = '';
  let rows: ThinkSummary[] = [];
  let busy: 'read' | 'save' | 'delete' | 'validate' | 'preview' | 'suggest' | null = null;
  let viewEpoch = 0, listEpoch = 0, editVersion = 0;
  let blocked = false, composing = false;
  let closing = false, closeApproved = false;
  let activePreview: AbortController | undefined, previewEpoch = 0;
  let activeAi: AbortController | undefined, aiEpoch = 0;
  let aiStatus: ThinkAiStatus | undefined, suggestion: ThinkTextSuggestion | null = null;
  const aiOperation = get<HTMLSelectElement>('ai-operation');
  const aiTarget = () => aiOperation.value === 'generateTitle' ? 'title' : aiOperation.value === 'generateSummary' ? 'summary' : 'body';
  function renderAi() {
    get<HTMLTextAreaElement>('ai-input').value = candidate?.body ?? '';
    get<HTMLButtonElement>('ai-request').disabled = closing || !candidate?.body.trim() || source?.editable === false || !aiStatus?.available || busy !== null || composing;
    get<HTMLButtonElement>('ai-cancel').hidden = activeAi === undefined;
    get<HTMLButtonElement>('ai-apply').disabled = closing || !suggestion || busy !== null || !candidate || source?.editable === false || composing;
    get<HTMLButtonElement>('ai-discard').disabled = closing || !suggestion || busy !== null;
    aiOperation.disabled = closing;
    get('ai-apply').textContent = `采纳到${aiTarget() === 'title' ? '标题' : aiTarget() === 'summary' ? '摘要' : '正文'}（替换）`;
  }
  function invalidateAi(text = '内容已变化，旧建议已失效；原文未被 AI 自动修改。') {
    ++aiEpoch; activeAi?.abort(); suggestion = null;
    get<HTMLTextAreaElement>('ai-output').value = ''; get('ai-state').textContent = text; renderAi();
  }
  function invalidatePreview(text = '内容已变化，旧预览已失效，请重新预览。', hide = false) {
    ++previewEpoch; activePreview?.abort();
    get('preview-frame').replaceChildren();
    get('preview-state').textContent = text;
    if (hide) get('preview-panel').hidden = true;
  }
  const fingerprint = (value: ThinkDocument) => JSON.stringify([value.body, ...['slug', 'title', 'summary', 'date', 'kind', 'published'].map(key => [Object.hasOwn(value.metadata, key), value.metadata[key as keyof ThinkDocument['metadata']]])]);
  const dirty = () => candidate !== null && (source === null || fingerprint(candidate) !== baseline);
  const writing = () => closing || (busy !== null && busy !== 'read');
  const discard = () => !dirty() || window.confirm('当前有未保存修改。放弃这些修改并继续？');
  const say = (text: string, error = false) => { message.textContent = text; message.dataset.error = String(error); };

  const pairing = get<HTMLScriptElement>('studio-session');
  const session = JSON.parse(pairing.textContent ?? '') as { origin: string; token: string };
  pairing.remove();
  if (session.origin !== window.location.origin || !/^[a-f0-9]{64}$/.test(session.token)) throw new Error('本机配对失败，请重新打开 Studio。');
  const api = createThinkApi(session.token);
  let firstListLoaded!:()=>void;
  const firstListReady=new Promise<void>(resolve=>{firstListLoaded=resolve;});
  const editorToken=session.token;
  const keepEditor = lazyEditor(()=>installKeepEditor(editorToken));
  const meEditor = lazyEditor(()=>installMeEditor(editorToken));
  const buildEditor = lazyEditor(()=>installBuildEditor(editorToken));
  const privateEditor = lazyEditor(()=>installPrivateEditor(editorToken));
  const intakeEditor=lazyEditor(()=>installIntake(editorToken));
  const publishEditor=lazyEditor(()=>installPublish(editorToken));
  const extraEditors = [keepEditor, meEditor, buildEditor, privateEditor,intakeEditor,publishEditor];
  let activeExtra: typeof extraEditors[number] | undefined;
  let lastPublicModule = 'Think';
  const switcher = get<HTMLDetailsElement>('workspace-switcher');
  const switcherLabel = switcher.querySelector('summary')!;
  document.addEventListener('click', event => {
    for (const menu of document.querySelectorAll<HTMLDetailsElement>('.control-menu[open]')) {
      if (!menu.contains(event.target as Node)) menu.open = false;
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || !(event.target instanceof Element)) return;
    const menu = event.target.closest<HTMLDetailsElement>('.control-menu[open]');
    if (menu) { menu.open = false; menu.querySelector('summary')?.focus(); }
  });
  get('space-public').addEventListener('click', () => get('module-' + lastPublicModule.toLowerCase()).click());
  const taskLabels: Record<string, string> = { 录入: '录入与待审', 发布: '发布管理', 私人: '私人资料库' };
  for (const name of ['Think', 'Build', 'Keep', 'Me', '录入', '发布', '私人']) {
    const label = taskLabels[name] ?? name;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.id = 'module-' + name.toLowerCase();
    button.setAttribute('aria-current', String(name === 'Think'));
    button.addEventListener('click', () => {
      if (closing) return;
      if (name === 'Think' && ['#maintenance-build', '#maintenance-keep', '#maintenance-me'].includes(location.hash)) {
        location.hash = ''; location.reload(); return;
      }
      if (activeExtra === privateEditor && name !== '私人' && !privateEditor.leave()) return;
      activeExtra = name === '发布'?publishEditor:name === '录入'?intakeEditor:name === '私人' ? privateEditor : name === 'Keep' ? keepEditor : name === 'Me' ? meEditor : name === 'Build' ? buildEditor : undefined;
      activeExtra?.initialize();
      for (const editor of extraEditors) editor.root.hidden = editor !== activeExtra;
      (document.querySelector('.workspace') as HTMLElement).hidden = !!activeExtra;
      get('current-workspace').textContent = label;
      switcherLabel.setAttribute('aria-label', `切换工作区，当前 ${label}`);
      get('space-public').hidden = name !== '私人';
      if (name !== '私人') lastPublicModule = name;
      for (const item of switcher.querySelectorAll('button[id^="module-"]')) item.setAttribute('aria-current', String(item === button));
      if (switcher.open) { switcher.open = false; switcherLabel.focus(); }
      if (name === 'Keep') document.getElementById('keep-refresh')!.click();
      if (name === 'Build') document.getElementById('build-refresh')!.click();
      if (name === 'Me') void meEditor.open();
      if (name === '私人') privateEditor.open();
      if (name === 'Think')void refresh();
      if (name === '录入')void intakeEditor.open();
      if(name==='发布')void publishEditor.open();
    }); get(taskLabels[name] ? 'workspace-tasks' : 'workspace-content').append(button);
  }
  window.addEventListener('studio:publish-proposal',event=>{const reference=(event as CustomEvent<{proposalId:string;expectedProposalRevision:string}>).detail;if(!reference||!/^[a-f0-9-]{36}$/.test(reference.proposalId)||!/^[a-f0-9]{64}$/.test(reference.expectedProposalRevision))return;get('module-发布').click();void publishEditor.initialize().prepareProposal(reference);});
  window.addEventListener('studio:publish-source',event=>{const reference=(event as CustomEvent<{module:string;key:string;expectedSourceRevision:string}>).detail;if(!reference||!['think','build'].includes(reference.module)||typeof reference.key!=='string'||!/^[a-f0-9]{64}$/.test(reference.expectedSourceRevision))return;get('module-发布').click();void publishEditor.initialize().prepareSource(reference);});
  session.token = '';

  function issues(value: ValidationIssue[]) {
    const container = get('issues');
    container.replaceChildren();
    for (const id of fieldIds) inputs[id].removeAttribute('aria-invalid');
    for (const issue of value) {
      const item = document.createElement('li');
      item.textContent = `${issue.severity === 'error' ? '错误' : '提示'} · ${issue.field} · ${issue.code}：${issue.message}`;
      item.dataset.severity = issue.severity;
      container.append(item);
      const id = issue.field.replace(/^metadata\./, '') as Field;
      if (issue.severity === 'error' && fieldIds.includes(id)) inputs[id].setAttribute('aria-invalid', 'true');
      if (issue.severity === 'error' && fieldIds.includes(id) && properties.contains(inputs[id])) properties.open = true;
    }
  }
  function fill() {
    for (const id of fieldIds) {
      const value = id === 'body' ? candidate?.body : candidate?.metadata[id];
      inputs[id].value = value === undefined ? '' : String(value);
    }
  }
  function renderList() {
    list.replaceChildren();
    for (const row of rows) {
      const item = document.createElement('li'), button = document.createElement('button'), detail = document.createElement('small');
      button.type = 'button';
      button.textContent = row.title || row.slug || row.fileName;
      button.dataset.key = row.key;
      button.setAttribute('aria-current', String(source?.key === row.key));
      button.disabled = writing();
      detail.textContent = row.editable ? row.published === true ? '' : '草稿' : '只读 · 待修复';
      if (detail.textContent) button.append(detail);
      button.addEventListener('click', () => { void open(row.key); });
      item.append(button); list.append(item);
    }
  }
  function render() {
    editor.hidden = source === null && candidate === null;
    get('empty').hidden = !editor.hidden;
    get('save-state').textContent = busy === 'save' ? '正在保存…' : blocked ? '待核对' : dirty() ? '未保存修改' : source?.editable ? '已保存（本地源码）' : '';
    get('save-state').dataset.dirty = String(dirty());
    get('source-state').textContent = `源文件：${source ? source.published === true ? 'published' : 'draft' : '尚未创建'}；候选：${candidate?.metadata.published === true ? 'published' : 'draft'}`;
    get('filename').textContent = source ? source.fileName || '已保存，重新读取确认文件名' : '保存后由后端确定';
    get('revision').textContent = source?.revision ?? '尚无源文件版本';
    fields.disabled = closing || !candidate || source?.editable === false || busy === 'read' || busy === 'delete';
    (inputs.slug as HTMLInputElement).readOnly = source !== null || busy === 'save';
    buttons.new!.disabled = writing();
    buttons.save!.disabled = !candidate || source?.editable === false || busy !== null || blocked || composing;
    buttons.validate!.disabled = !candidate || source?.editable === false || busy !== null || composing;
    buttons.preview!.disabled = !candidate || source?.editable === false || busy !== null || composing;
    buttons['cancel-preview']!.hidden = activePreview === undefined;
    buttons.reload!.disabled = !source || writing();
    buttons.delete!.disabled = !source?.deletable || !source.revision || busy !== null || blocked;
    get('editor-heading').hidden = source?.editable !== false;
    renderAi();
    renderList();
    filter.disabled = closing;
    if (closing) for (const button of Object.values(buttons)) button.disabled = true;
  }
  async function refresh() {
    const epoch = ++listEpoch;
    get('list-message').textContent = '正在读取列表…';
    try {
      const result = await api.list(filter.value);
      if (epoch !== listEpoch) return;
      rows = result;
      renderList();
      get('list-message').textContent = rows.length ? `${rows.length} 项` : '当前列表为空。';
      firstListLoaded();
    } catch (error) {
      if (epoch === listEpoch) {
        get('list-message').textContent = `列表读取失败（${error instanceof ApiError ? error.code : 'UNKNOWN_ERROR'}）。编辑缓冲保留，请检查本地服务。`;
        if (error instanceof ApiError && error.code === 'UNAUTHORIZED') { report(error); render(); }
      }
    }
  }
  async function open(key: string) {
    if (writing() || !discard()) return;
    const epoch = ++viewEpoch, version = editVersion;
    busy = 'read'; say('正在读取源文件…'); render();
    try {
      const result = await api.read(key);
      if (epoch !== viewEpoch || version !== editVersion) return;
      invalidatePreview('', true);
      invalidateAi('请求建议才会发送当前正文；未发送内容。');
      source = result; candidate = result.document ? structuredClone(result.document) : null;
      baseline = candidate ? fingerprint(candidate) : ''; blocked = false;
      properties.open = false; aiTools.open = false;
      fill(); issues(result.editable ? result.issues.filter(issue => issue.severity === 'error') : result.issues);
      get('validation-state').textContent = '';
      say(result.editable ? '' : '源格式不受支持或存在目录冲突，请按诊断修复源码。');
    } catch (error) { if (epoch === viewEpoch) report(error); }
    finally { if (epoch === viewEpoch) { busy = null; render(); } }
  }
  function report(error: unknown, mutation = false, showIssues = true) {
    const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
    issues(showIssues && error instanceof ApiError ? error.issues : []);
    if (code === 'REVISION_CONFLICT' || code === 'NOT_FOUND') {
      blocked = true;
      say(`源文件已变化（${code}）。缓冲已保留，不会自动覆盖或重试。请先复制需要保留的内容，再重新读取源文件并人工合并。`, true);
    } else if (code === 'UNAUTHORIZED') {
      blocked = true; say('会话已失效（UNAUTHORIZED）。缓冲已保留；请先复制需要保留的内容，再刷新页面重新配对。', true);
    } else if (code === 'CONNECTION_LOST' || code === 'INVALID_RESPONSE') {
      if (mutation) blocked = true;
      say(`连接中断或响应无效（${code}），缓冲已保留。${mutation ? '无法确认操作是否落盘，请先刷新列表并重新读取源核对，不要重复新建或强制重试。' : '请检查本地服务后重试。'}`, true);
    } else say(`操作未完成（${code}），缓冲已保留。请查看校验问题或稍后重试。`, true);
  }
  async function save() {
    if (!candidate || busy || blocked || composing || source?.editable === false) return;
    const snapshot = structuredClone(candidate), version = editVersion;
    const previous = source;
    invalidatePreview('保存后请重新预览。');
    invalidateAi('保存后旧建议已失效；请求新建议才会发送正文。');
    busy = 'save'; say(''); render();
    try {
      const saved = previous ? await api.save(previous.key, previous.revision!, snapshot) : await api.create(snapshot);
      source = { key: saved.key, revision: saved.revision, fileName: previous?.fileName ?? '', editable: true, deletable: true, issues: [], ...snapshot.metadata, document: snapshot };
      baseline = fingerprint(snapshot);
      // Read only server-owned filename/diagnostics. Never replace the current buffer with a later source.
      let readFailed = false;
      try {
        const read = await api.read(saved.key);
        if (read.revision === saved.revision) source = read;
        else readFailed = true;
      } catch { readFailed = true; }
      issues([]); get('validation-state').textContent = '';
      say(`${editVersion === version ? '' : '已保存请求发出时的版本；当前缓冲仍有未保存修改。'}${saved.cleanupPending ? ' 自有临时文件清理未完成，请查看维护手册。' : ''}${readFailed ? ' 保存后读取未确认，请手动重新读取核对。' : ''}`.trim());
      void refresh();
    } catch (error) { report(error, true, editVersion === version); }
    finally { busy = null; render(); }
  }
  async function validate() {
    if (!candidate || busy || composing || source?.editable === false) return;
    const version = editVersion;
    busy = 'validate'; say('正在校验…'); render();
    try {
      const result = await api.validate(structuredClone(candidate), source?.key);
      if (version !== editVersion) { say('校验期间内容已变化，请重新校验；旧报告未应用。'); return; }
      issues(result.issues);
      get('validation-state').textContent = `${result.canSave ? '可保存' : '不可保存'} · ${result.publishReady ? '公开就绪' : '尚未公开就绪'}`;
      say('');
    } catch (error) { if (version === editVersion) report(error); }
    finally { busy = null; render(); }
  }
  async function remove() {
    if (!source?.deletable || !source.revision || busy || blocked) return;
    if (!window.confirm(`删除文章“${source.fileName}”？仅删除这一份 Markdown，不删除共享资源。${dirty() ? '当前未保存修改也将丢弃。' : ''}`)) return;
    busy = 'delete'; say('正在删除…'); render();
    try {
      await api.remove(source.key, source.revision);
      invalidatePreview('', true);
      invalidateAi('文章已删除，建议已清除。');
      source = null; candidate = null; baseline = ''; blocked = false; ++viewEpoch;
      fill(); issues([]); say('文章已删除。'); await refresh();
    } catch (error) { report(error, true); }
    finally { busy = null; render(); }
  }
  for (const id of fieldIds) inputs[id].addEventListener('input', () => {
    if (!candidate || fields.disabled || (id === 'slug' && (inputs.slug as HTMLInputElement).readOnly)) return;
    const value = inputs[id].value;
    if (id === 'body') candidate.body = value;
    else if (id === 'published') { if (value === '') delete candidate.metadata.published; else candidate.metadata.published = value === 'true'; }
    else if (id === 'kind') { if (value === '') delete candidate.metadata.kind; else candidate.metadata.kind = value as 'article' | 'note'; }
    else if (id === 'slug') candidate.metadata.slug = value;
    else { if (value === '') delete candidate.metadata[id]; else candidate.metadata[id] = value; }
    ++editVersion; issues([]); get('validation-state').textContent = ''; render();
    invalidatePreview();
    invalidateAi();
  });
  editor.addEventListener('compositionstart', () => { composing = true; render(); });
  editor.addEventListener('compositionend', () => { composing = false; render(); });
  editor.addEventListener('submit', event => event.preventDefault());
  buttons.new!.addEventListener('click', () => {
    if (writing() || !discard()) return;
    ++viewEpoch; ++editVersion; busy = null; source = null; blocked = false; baseline = '';
    invalidatePreview('', true);
    invalidateAi('新草稿尚未发送 AI。');
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    candidate = { metadata: { slug: '', published: false, kind: 'article', date }, body: '' };
    properties.open = true; aiTools.open = false;
    fill(); issues([]); get('validation-state').textContent = ''; say(''); render(); inputs.title.focus();
  });
  buttons.refresh!.addEventListener('click', () => { void refresh(); });
  filter.addEventListener('change', () => { void refresh(); });
  buttons.reload!.addEventListener('click', () => { if (source) void open(source.key); });
  buttons.save!.addEventListener('click', () => { void save(); });
  buttons.validate!.addEventListener('click', () => { void validate(); });
  buttons.delete!.addEventListener('click', () => { void remove(); });
  buttons.preview!.addEventListener('click', () => { void preview(); });
  buttons['cancel-preview']!.addEventListener('click', () => invalidatePreview('已取消预览；源文件未保存。'));
  async function preview() {
    if (!candidate || busy || composing || source?.editable === false) return;
    const controller = new AbortController(), epoch = ++previewEpoch, version = editVersion;
    activePreview = controller; busy = 'preview';
    issues([]); get('validation-state').textContent = '';
    get('preview-panel').hidden = false; get('preview-frame').replaceChildren();
    get('preview-state').textContent = '正在隔离构建 Astro 预览…可以继续编辑或取消。'; render();
    try {
      const result = await api.preview(structuredClone(candidate), source?.key, controller.signal);
      if (epoch !== previewEpoch || version !== editVersion || controller.signal.aborted) return;
      const frame = document.createElement('iframe');
      frame.title = 'Think 隔离预览'; frame.setAttribute('sandbox', ''); frame.referrerPolicy = 'no-referrer';
      frame.srcdoc = result.html;
      get('preview-frame').replaceChildren(frame);
      get('preview-state').textContent = `仅为当前候选的隔离预览，未保存、未改变源 published。指纹 ${result.fingerprint.slice(0, 12)}${result.blockedResources ? `；${result.blockedResources} 项图片资源已阻断。` : ''}${result.cleanupPending ? ' 临时目录未能安全清理，请查看维护手册。' : ''}`;
      say('预览完成；保存和全站验证仍须分别执行。');
    } catch (error) {
      if (epoch === previewEpoch && !controller.signal.aborted) { report(error); get('preview-state').textContent = '预览失败，源与编辑缓冲未保存；请处理诊断后重试。'; }
    } finally { if (activePreview === controller) { activePreview = undefined; busy = null; render(); } }
  }
  window.addEventListener('beforeunload', event => { if (!closeApproved && (dirty() || extraEditors.some(editor => editor.dirty() || editor.unsettled()) || busy === 'save' || busy === 'delete')) event.preventDefault(); });
  window.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (!closing && !event.isComposing && !composing) void (activeExtra ? activeExtra.save() : save()); }
  });
  get('ai-request').addEventListener('click', () => { void suggest(); });
  get('ai-cancel').addEventListener('click', () => invalidateAi('已取消；原文未改。已经送达模型的调用仍可能计费。'));
  get('ai-discard').addEventListener('click', () => invalidateAi('已丢弃建议；原文未改。'));
  aiOperation.addEventListener('change', () => invalidateAi('操作已变化，请重新请求建议；原文未改。'));
  get('ai-apply').addEventListener('click', () => {
    if (!suggestion || !candidate || busy || composing || source?.editable === false) return;
    const target = aiTarget(), text = suggestion.text;
    inputs[target].value = text; inputs[target].dispatchEvent(new Event('input', { bubbles: true }));
    get('ai-state').textContent = '建议已采纳到编辑缓冲，尚未保存。请人工核对并校验后显式保存。';
    say('已采纳 AI 建议；源文件、published 与 revision 未变。');
  });
  async function suggest() {
    if (!candidate?.body.trim() || !aiStatus?.available || busy || composing || source?.editable === false) return;
    invalidateAi('正在请求建议；可以继续编辑或取消。原文尚未修改。');
    const controller = new AbortController(), epoch = aiEpoch, version = editVersion;
    const original = candidate.body;
    activeAi = controller; busy = 'suggest'; render();
    try {
      const result = await api.suggest({ operation: aiOperation.value as AiOperation, input: candidate.body }, controller.signal);
      if (epoch !== aiEpoch || version !== editVersion || controller.signal.aborted) return;
      get<HTMLTextAreaElement>('ai-output').value = result.text;
      if (result.operation === 'polish' && result.text === original) {
        suggestion = null;
        get('ai-state').textContent = '本次未产生修改';
      } else {
        suggestion = result;
        get('ai-state').textContent = '建议已返回，尚未采纳；原文与源文件未变。核对后可采纳或丢弃。';
      }
    } catch (error) {
      if (epoch === aiEpoch && !controller.signal.aborted) {
        const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
        get('ai-state').textContent = `AI 建议未完成（${code}）；原文保留，不自动重试。`;
        if (code === 'UNAUTHORIZED') report(error);
      }
    } finally { if (activeAi === controller) { activeAi = undefined; busy = null; render(); } }
  }
  let aiStatusTimer: ReturnType<typeof setTimeout>|undefined;
  window.addEventListener('pagehide',()=>clearTimeout(aiStatusTimer));
  async function loadAiStatus() {
    try {
      aiStatus = await api.aiStatus();
      get('ai-service').textContent = `${aiStatus.service} · ${aiStatus.model} · ${aiStatus.available ? '后端已配置。打开文章并输入正文后可请求建议。' : aiStatus.issue==='AI_INITIALIZING'?'正在读取本机加密配置，文章编辑可继续。':aiStatus.issue==='AI_CONFIG_UNAVAILABLE'?'本机配置读取失败（AI_CONFIG_UNAVAILABLE）；原配置保留，文章编辑可继续。请正常重开后核对启动诊断，不要重复配置 Key。':aiStatus.issue === 'AI_NOT_CONFIGURED'
        ? '不可用（AI_NOT_CONFIGURED）：当前后台未加载 AI 配置。若已保存 Key，请先保存文章、正常退出并重开；仍不可用时保留配置文件排查，不要重复配置。首次使用才需运行 npm.cmd run studio:configure。'
        : '不可用（AI_CONFIG_INVALID）。后端配置格式无效，请核对配置后退出并重开；不要把 Key 发到聊天中。'}`;
      if(aiStatus.issue==='AI_INITIALIZING'&&!closeApproved)aiStatusTimer=setTimeout(()=>{void loadAiStatus();},500);
    } catch (error) {
      get('ai-service').textContent = 'AI 状态读取失败；原文保留，请检查本机服务后刷新。';
      if (error instanceof ApiError && error.code === 'UNAUTHORIZED') report(error);
    }
    renderAi();
  }
  render();
  installDesktopExit({
    dirty: () => dirty() || extraEditors.some(editor => editor.dirty()),
    unsettled: () => busy === 'save' || busy === 'delete' || busy === 'validate' || busy === 'read' || composing || extraEditors.some(editor => editor.unsettled()),
    uncertain: () => blocked || extraEditors.some(editor => editor.uncertain()),
    canSave: () => (!dirty() || candidate !== null && !blocked && source?.editable !== false && (busy === null || busy === 'preview' || busy === 'suggest') && !composing) && extraEditors.every(editor => editor.canSave()),
    save: async () => {
      invalidatePreview('退出前已取消预览。', true); invalidateAi('退出前已取消建议；已经送达模型的调用仍可能计费。');
      while (activePreview || activeAi) await new Promise(resolve => setTimeout(resolve, 20));
      if (dirty()) await save();
      if (!dirty()) for (const editor of extraEditors) { if (editor.dirty()) { await editor.save(); if (editor.dirty() || editor.uncertain()) break; } }
    },
    closing: value => { closing = value; for (const editor of extraEditors) editor.closing(value); render(); },
    finish: () => { closeApproved = true; for (const editor of extraEditors) editor.finish(); invalidatePreview('', true); invalidateAi('Studio 正在退出；未采纳建议已清除。'); },
    resume: () => { closeApproved = false; say('未能确认服务安全关闭，窗口与缓冲保留。请核对本机服务状态，不会强制结束或自动重试保存。', true); },
  }, firstListReady);
  void refresh();
  void loadAiStatus();
  const requested = location.hash.slice('#maintenance-'.length);
  if (['build', 'keep', 'me'].includes(requested)) get('module-' + requested).click();
}
