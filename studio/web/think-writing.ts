import { stringify } from 'yaml';
import type { ThinkDocument, ThinkReadResult, ThinkSummary, ValidationIssue } from '../contracts/think.ts';
import type { Evidence, ProposalTarget, ProposalView, ThinkCandidate, ThinkProposal, ThinkSuggestedEdit } from '../contracts/proposal.ts';
import { INTAKE_MAX_MATERIAL } from '../contracts/proposal.ts';
import { AI_MAX_INPUT_BYTES, AI_TIMEOUT_MS } from '../contracts/ai.ts';
import { parseThinkDraftBuffer, parseThinkSource, serializeThinkDocument, serializeThinkDraftBuffer, thinkPreviewBody } from '../server/think/document.ts';
import type { FastThinkPreviewResult } from '../contracts/preview.ts';
import { ApiError, createThinkApi } from './api.ts';
import { installDesktopExit } from './desktop.ts';
import { writingBuffer } from './writing-buffer.ts';
import { writingRequest } from './writing-request.ts';
import { thinkPublication } from './think-publication.ts';
import { writingClock } from './writing-clock.ts';
import { writingComparison } from './writing-comparison.ts';
import { applyReview, fieldLabels, writingReview } from './writing-review.ts';
import type { ReviewChange, ReviewDraft } from './writing-review.ts';

type Draft = ThinkProposal & { revision: string; candidateHash: string };
type DraftRow = { id: string; state: string; label: string };
type Suggestion = { module: 'think'; candidate: ThinkCandidate; evidence: Evidence[]; notes: string[]; edits?: ThinkSuggestedEdit[] };
const frontmatter = /^(?:\uFEFF)?---[ \t]*\r?\n/;
const byteLength = (value: string) => new TextEncoder().encode(value).length;
const today = () => {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(part => String(part).padStart(2, '0')).join('-');
};

function display(document: ThinkCandidate) {
  const metadata = { ...document.metadata };
  delete metadata.published;
  delete metadata.createdAt;
  delete metadata.updatedAt;
  const source = serializeThinkDocument({ metadata, body: document.body ?? '' });
  return source.ok ? source.value : '---\n' + stringify(metadata, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE' }) + '---\n' + (document.body ?? '');
}

function candidate(text: string, source: ThinkReadResult | undefined): ThinkDocument {
  const base = source?.document;
  if (!frontmatter.test(text)) {
    if (base) return { metadata: { ...base.metadata }, body: text };
    throw new ApiError('MISSING_ARTICLE_INFORMATION');
  }
  const parsed = parseThinkSource(text);
  if (!parsed.ok) throw new ApiError(parsed.error.code, parsed.error.issues);
  const value = parsed.value.document;
  const published = source ? base?.metadata.published : false;
  if (value.metadata.published !== undefined && value.metadata.published !== published) throw new ApiError('PUBLICATION_REQUIRES_CONFIRMATION');
  if (published === undefined) delete value.metadata.published;
  else value.metadata.published = published;
  for (const field of ['createdAt','updatedAt'] as const) {
    const stored = base?.metadata[field];
    if (stored === undefined) delete value.metadata[field];
    else value.metadata[field] = stored;
  }
  if (base && base.metadata.slug !== value.metadata.slug) throw new ApiError('SLUG_IMMUTABLE');
  return value;
}

function stampWriting(value: ThinkDocument, previous?: ThinkDocument): ThinkDocument {
  const changed = !previous || previous.body !== value.body ||
    (['title','summary','date','kind'] as const).some(field => previous.metadata[field] !== value.metadata[field]);
  if (!changed) return value;
  const now = new Date().toISOString().slice(0, 19) + 'Z';
  const updatedAt = [now, previous?.metadata.createdAt ?? '', previous?.metadata.updatedAt ?? ''].sort().at(-1)!;
  return { ...value, metadata: { ...value.metadata, ...(!previous ? { createdAt: now, kind: value.metadata.kind ?? 'article' } : {}), updatedAt } };
}

export function startThinkWriting() {
  const root = document.createElement('div');
  root.className = 'writing';
  root.innerHTML = `
    <header class="writing-bar">
      <details id="writing-pick" class="control-menu"><summary id="writing-current">Think · 新文章</summary>
        <div class="control-menu-content"><button id="writing-new" type="button">新建 Think 文章</button>
        <ul id="writing-list" aria-label="Think 文章"></ul>
        <ul id="writing-drafts" aria-label="本机原稿"></ul>
        <div class="writing-other"><a href="/#maintenance-build">Build</a><a href="/#maintenance-keep">Keep</a><a href="/#maintenance-me">Me</a></div>
      </div></details>
      <div class="writing-mode" aria-label="查看方式"><button id="writing-edit" aria-pressed="true" type="button">编辑</button><button id="writing-preview" aria-pressed="false" type="button">预览</button></div>
      <div class="writing-tools"><button id="writing-organize" title="将当前拟公开内容发送至已配置的 AI 服务" type="button">AI 整理</button><button id="writing-refresh" type="button">刷新</button></div>
    </header>
    <main class="writing-surface"><div id="writing-editor"></div><section id="writing-preview-pane" aria-label="Markdown 快速预览" hidden></section></main>
    <section id="writing-issues" class="writing-feedback" hidden><p id="writing-message" role="status"></p><ul id="writing-diagnostics"></ul>
      <button id="writing-add-info" type="button" hidden>添加文章信息</button><button id="writing-cancel-task" type="button" hidden>取消</button>
      <button id="writing-original" type="button" hidden>查看原始材料</button></section>
    <section id="writing-publication" class="writing-feedback" hidden><p id="writing-publication-state" role="status"></p>
      <details><summary>发布记录</summary><pre id="writing-publication-detail"></pre></details>
      <button id="writing-publication-check" type="button" hidden>核对发布</button><button id="writing-publication-verify" type="button" hidden>复核上线</button><button id="writing-publication-end" type="button" hidden>结束记录</button></section>
    <footer class="writing-bar writing-footer"><output id="writing-save-state" role="status"></output><output id="writing-time" aria-live="off"></output>
      <button id="writing-save" type="button">保存</button><button id="writing-publish" type="button" class="primary-action">发布</button></footer>
    <dialog id="writing-ai-review" aria-labelledby="writing-ai-title"><h2 id="writing-ai-title">核对整理结果</h2>
      <div class="writing-ai-scroll" tabindex="0" aria-label="修改与待核对事项">
        <fieldset id="writing-ai-changes"><legend>逐项核对修改</legend><div id="writing-ai-items"></div></fieldset>
        <details id="writing-ai-context"><summary>查看选中修改的正文对比</summary>
          <div class="writing-comparison-labels" aria-hidden="true"><span>当前正文</span><span>选中修改后</span></div><div id="writing-comparison"></div>
        </details>
        <ul id="writing-ai-notes"></ul>
      </div>
      <footer class="writing-ai-footer"><p id="writing-ai-status" role="status"></p>
        <div class="toolbar"><button id="writing-ai-apply" class="primary-action" type="button" aria-describedby="writing-ai-status">应用选中修改</button><button id="writing-ai-cancel" type="button">取消</button></div>
      </footer></dialog>
    <dialog id="writing-publish-review"><h2>发布到网站</h2><p id="writing-publish-target"></p><p id="writing-publish-issues" role="status"></p>
      <details open><summary>网站内容差异</summary><pre id="writing-publish-diff"></pre></details>
      <details><summary>本机源码差异</summary><pre id="writing-publish-local"></pre></details>
      <div class="toolbar"><button id="writing-publish-confirm" class="primary-action" type="button">确认发布</button><button id="writing-publish-cancel" type="button">取消</button></div></dialog>
    <dialog id="writing-original-dialog"><h2>原始材料</h2><pre id="writing-original-text"></pre><button id="writing-original-close" type="button">返回编辑</button></dialog>`;
  document.body.append(root);
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const button = (id: string) => get<HTMLButtonElement>('writing-' + id);
  const picker = get<HTMLDetailsElement>('writing-pick');
  const pairing = document.querySelector<HTMLScriptElement>('#studio-session')!;
  const session = JSON.parse(pairing.textContent ?? '') as { origin: string; token: string };
  pairing.remove();
  if (session.origin !== location.origin || !/^[a-f0-9]{64}$/.test(session.token)) throw new Error('本机配对失败，请重新打开 Studio。');
  const api = createThinkApi(session.token), request = writingRequest(session.token);
  const clock = writingClock(get<HTMLOutputElement>('writing-time'), request);
  let source: ThinkReadResult | undefined, draft: Draft | undefined;
  let target: ProposalTarget = { mode: 'create' };
  let saved = '', original: string | undefined, savedWhere: 'source' | 'draft' | undefined;
  let conflict = false, readOnly = false, writeUnknown = false, closing = false, closeApproved = false;
  let working = false, listVersion = 0, ready = false, version = 0;
  let rows: ThinkSummary[] = [], drafts: DraftRow[] = [];
  let pending: { kind: 'ai' | 'preview'; controller: AbortController } | undefined;
  let returnScroll: number | undefined;
  let previewCache: { body: string; frame: HTMLIFrameElement; notice: string; ready: boolean } | undefined;
  let comparison: ReturnType<typeof writingComparison> | undefined;
  let acceptedPublication: { id: string; text: string; confirmed: boolean } | undefined;
  let suggestion: { original: string; base: ReviewDraft; changes: ReviewChange[]; malformed: boolean } | undefined;
  const aiDialog = get<HTMLDialogElement>('writing-ai-review');
  const originalDialog = get<HTMLDialogElement>('writing-original-dialog');
  const dirty = () => editor.text() !== saved;
  const locked = () => working || publication.busy();
  const editor = writingBuffer(get('writing-editor'), activity => {
    if (activity) clock.edit();
    ++version;
    cancelTask();
    setMode('edit');
    say('');
    render();
  }, files=>{void addImages(files);});
  const publication = thinkPublication(request, get, render, async value => {
    const item = acceptedPublication;
    if (!item || value.id !== item.id || item.confirmed || editor.text() !== item.text) return;
    const read = await api.read(value.sourceKey);
    if (!read.editable || read.revision !== value.sourceAfterRevision) return;
    item.confirmed = true;
    source = read;
    target = { mode: 'update', key: read.key, expectedSourceRevision: read.revision };
    clock.bind({sourceKey:read.key,...(draft?{draftId:draft.id}:{})});
    saved = item.text; savedWhere = 'source'; draft = undefined;
    void refreshList();
  });
  let markReady!: () => void;
  const firstReady = new Promise<void>(resolve => { markReady = resolve; });

  function say(message: string, issues: ValidationIssue[] = [], addInfo = false) {
    get('writing-message').textContent = message;
    get('writing-diagnostics').replaceChildren(...issues.map(issue => {
      const item = document.createElement('li'); item.textContent = issue.message; return item;
    }));
    button('add-info').hidden = !addInfo;
    get('writing-issues').hidden = !message && !pending && original === undefined;
  }
  function errorMessage(error: unknown) {
    const code = error instanceof ApiError ? error.code : 'INVALID_RESPONSE';
    const known: Record<string, string> = {
      MISSING_ARTICLE_INFORMATION: '还缺文章信息。可保存原稿、添加文章信息，或使用 AI 整理。',
      REVISION_CONFLICT: '源码或原稿已变化。保留当前文字，请从内容选择器重新核对。',
      SLUG_IMMUTABLE: '已有文章的 slug 需要保持原值。',
      PUBLICATION_REQUIRES_CONFIRMATION: '请通过「发布」确认公开状态。',
      CONNECTION_LOST: '本机服务连接中断。请保留当前文字并检查服务。',
      AI_NOT_CONFIGURED: 'AI 尚未就绪。可以继续手工编辑和保存。',
      AI_INITIALIZING: '正在读取本机 AI 配置。可稍后重新整理。',
      AI_CONFIG_UNAVAILABLE: '无法读取本机加密 AI 配置。请从正式桌面入口正常退出再重开。',
      AI_CONFIG_INVALID: 'AI 配置格式有误。请核对本机配置。',
      AI_AUTH_FAILED: 'AI 服务拒绝了当前凭据或模型权限。请核对所选服务的 Key。',
      AI_RATE_LIMITED: 'AI 配额已用尽或请求过快。当前文字保留。',
      AI_MODEL_UNAVAILABLE: '当前 Gemini 模型不可用。当前文字保留。',
      AI_UPSTREAM_UNAVAILABLE: 'Gemini 服务暂不可用，可以稍后重试。当前文字保留。',
      AI_TIMEOUT: 'AI 请求超时。当前文字保留。',
      AI_INVALID_RESPONSE: 'AI 建议未通过结构或原文引用校验。当前文字保留。',
      AI_INPUT_TOO_LARGE: '全文超过 AI 整理的 32 KiB 上限。原文保留，可继续手工编辑。',
      PAYLOAD_TOO_LARGE: '原稿超过待审箱的 64 KiB 单篇上限。文字仍在编辑器中，请先复制留存或补齐文章信息后保存源码。',
      PUBLISH_NOT_READY: '发布条件未就绪。请核对本机 Git 身份、gh 登录和远端发布工作流。',
      PREVIEW_NOT_READY: '文章信息不完整，补齐后可预览网站效果。',
      UNSUPPORTED_FORMAT: '文章信息格式不受支持。检查开头的 YAML 字段和分隔线。',
    };
    return { code, message: known[code] ?? ('操作未完成（' + code + '）。当前文字保留。'), issues: error instanceof ApiError ? error.issues : [] };
  }
  function maintenance(hash: string) {
    if (aiDialog.open || originalDialog.open || writeUnknown || publication.uncertain() || !mayOpen()) return;
    closeApproved = true; location.hash = hash; location.reload();
  }
  function report(error: unknown) {
    const issue = errorMessage(error);
    say(issue.message, issue.issues, issue.code === 'MISSING_ARTICLE_INFORMATION');
  }
  function setMode(value: 'edit' | 'preview') {
    get('writing-editor').hidden = value !== 'edit';
    get('writing-preview-pane').hidden = value !== 'preview';
    button('edit').setAttribute('aria-pressed', String(value === 'edit'));
    button('preview').setAttribute('aria-pressed', String(value === 'preview'));
    if(value==='edit'&&returnScroll!==undefined){editor.restoreScroll(returnScroll);returnScroll=undefined;}
  }
  async function addImages(files:File[]) {
    if(locked()||closing||readOnly||editor.composing())return;
    if(files.length>4||files.some(file=>file.size>2*1024*1024||!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))){
      say('每次可插入最多 4 张 PNG、JPEG、WebP 或 GIF，每张不超过 2 MiB。');return;
    }
    working=true;cancelTask();render();
    const links:string[]=[];
    try{
      for(const file of files){
        const bytes=new Uint8Array(await file.arrayBuffer());
        let binary='';
        for(let start=0;start<bytes.length;start+=16384)binary+=String.fromCharCode(...bytes.subarray(start,start+16384));
        const image=await request<{url:string}>('POST','think/images',{mime:file.type,data:btoa(binary)});
        links.push('![图片]('+image.url+')');
      }
    }catch{ /* Insert only the files that were confirmed, even if the next file failed. */ }
    finally{
      working=false;render();
      if(links.length)editor.insert('\n'+links.join('\n')+'\n');
      if(links.length!==files.length)say('部分图片未能保存。请检查格式、尺寸或本机服务。');
      editor.focus();
    }
  }
  function render() {
    const disabled = locked() || closing || !ready;
    editor.readonly(disabled || readOnly);
    const hasText = !!editor.text().trim();
    button('edit').disabled = disabled;
    button('preview').disabled = disabled || readOnly || !hasText || pending?.kind === 'preview';
    button('organize').disabled = disabled || readOnly || conflict || !hasText || !!pending;
    button('save').disabled = disabled || readOnly || writeUnknown || !hasText;
    button('publish').disabled = disabled || readOnly || writeUnknown || conflict || publication.uncertain() || !hasText;
    button('refresh').disabled = locked() || closing;
    button('new').disabled = disabled;
    button('cancel-task').hidden = !pending;
    button('original').hidden = original === undefined;
    get('writing-save-state').textContent = writeUnknown ? '保存结果待核对' : dirty() ? '未保存' :
      savedWhere === 'draft' ? '原稿已保存' : savedWhere === 'source' ? '已保存至网站源码' : readOnly ? '只读' : '';
    get('writing-current').textContent = 'Think · ' + (source?.title || source?.slug || source?.fileName || (draft ? '本机原稿' : '新文章'));
  }
  function cancelTask() {
    pending?.controller.abort();
    pending = undefined;
  }
  function renderPicker() {
    const items = (entries: { text: string; action: () => void }[]) => entries.map(entry => {
      const li = document.createElement('li'), control = document.createElement('button');
      control.type = 'button'; control.textContent = entry.text; control.onclick = entry.action;
      li.append(control); return li;
    });
    get('writing-list').replaceChildren(...items(rows.map(row => ({
      text: row.title || row.slug || row.fileName, action: () => { void openSource(row.key); },
    }))));
    get('writing-drafts').replaceChildren(...items(drafts.map(row => ({
      text: (row.state === 'applying' ? '待核对原稿 · ' : '本机原稿 · ') + row.label, action: () => { void openDraft(row.id); },
    }))));
  }
  async function refreshList() {
    const seq = ++listVersion;
    try {
      const entries = await api.list('all');
      const proposals = await request<DraftRow[]>('GET', 'intake/think/draft').catch(error => {
        if (seq === listVersion && !working) say('本机原稿列表无法读取，请刷新重试。');
        if (error instanceof ApiError && error.code === 'UNAUTHORIZED') throw error;
        return undefined;
      });
      if (seq !== listVersion) return;
      rows = entries;
      if (proposals) drafts = proposals;
      renderPicker(); ready = true; markReady();
    } catch (error) { if (seq === listVersion) report(error); }
    finally { render(); }
  }
  const mayOpen = () => !locked() && !closing && (!dirty() || confirm('当前有未保存的文字。放弃这次修改并继续？'));
  function showBuffer(text: string, location?: typeof savedWhere) {
    editor.open(text, location === 'source');
    saved = text; savedWhere = location; writeUnknown = false;
    cancelTask(); setMode('edit'); picker.open = false;
    clearPreview();
    say(''); render(); editor.focus();
  }
  async function openSource(key: string) {
    if (!mayOpen()) return;
    working = true; clock.pause(); cancelTask(); render();
    try {
      const read = await api.read(key);
      source = read; draft = undefined; original = undefined; readOnly = !read.editable; conflict = false;
      target = read.revision ? { mode: 'update', key, expectedSourceRevision: read.revision } : { mode: 'create' };
      clock.select(read.document ? {sourceKey:key} : undefined);
      showBuffer(read.document ? display(read.document) : '', read.editable ? 'source' : undefined);
      if (!read.editable) say('这篇文章暂时只读，请修复源文件后刷新。', read.issues);
    } catch (error) { report(error); }
    finally { working = false; render(); editor.focus(); }
  }
  async function openDraft(id: string) {
    if (!mayOpen()) return;
    working = true; clock.pause(); cancelTask(); render();
    try {
      const value = await request<ProposalView>('GET', 'proposals/' + id);
      if (value.state === 'applied' || value.module !== 'think') throw new ApiError('REVISION_CONFLICT');
      const base = value.target.mode === 'update' ? await api.read(value.target.key).catch(error => {
        if (error instanceof ApiError && error.code === 'NOT_FOUND') return undefined;
        throw error;
      }) : undefined;
      conflict = value.target.mode === 'update' && (!base?.editable || base.revision !== value.target.expectedSourceRevision);
      source = base; target = value.target; draft = value; readOnly = value.state === 'applying';
      clock.select(base?.document ? {sourceKey:base.key,draftId:value.id} : {draftId:value.id});
      const text = value.writing ? value.material : Object.keys(value.candidate.metadata).length
        ? display({ metadata: value.candidate.metadata, body: value.candidate.body ?? value.material })
        : value.candidate.body ?? value.material;
      original = text !== value.material ? value.material : undefined;
      showBuffer(text, 'draft');
      if (readOnly) say('上次写入结果待核对。原稿可查看或复制，请先核对源码或发布记录。');
      else if (conflict) say('源版本已变化。原稿仍可保存，覆盖源码前请打开最新文章核对。');
    } catch (error) { report(error); }
    finally { working = false; render(); editor.focus(); }
  }
  async function stage(text: string, value?: ThinkDocument) {
    if (byteLength(text) > INTAKE_MAX_MATERIAL) throw new ApiError('PAYLOAD_TOO_LARGE');
    // A legacy proposal can have different source material and candidate text.
    // Preserve that record while saving edits in the new working draft.
    const current = original !== undefined && !draft?.writing ? undefined : draft;
    const route = 'intake/think/draft' + (current ? '/' + current.id : '');
    const body = { material: text, target, ...(current ? { expectedProposalRevision: current.revision } : {}), ...(value ? { candidate: value } : {}) };
    draft = await request<Draft>(current ? 'PUT' : 'POST', route, body);
    clock.bind(source?.document ? {sourceKey:source.key,draftId:draft.id} : {draftId:draft.id});
    saved = text; savedWhere = 'draft';
    return draft;
  }
  function recordWrite(key: string, revision: string, value: ThinkDocument, text: string) {
    clock.bind({sourceKey:key,...(draft?{draftId:draft.id}:{})});
    source = { key, revision, document: value, editable: true, deletable: true, fileName: source?.fileName ?? value.metadata.slug + '.md', issues: [], ...value.metadata };
    target = { mode: 'update', key, expectedSourceRevision: revision };
    saved = text; savedWhere = 'source'; draft = undefined; original = undefined;
  }
  async function save(whileClosing = false) {
    const text = editor.text();
    if (locked() || closing && !whileClosing || editor.composing() || readOnly || writeUnknown || !text.trim()) return;
    if (!dirty() && savedWhere === 'source') return;
    working = true; clock.pause(); cancelTask(); say('正在保存…'); render();
    let mutating = false;
    try {
      let value: ThinkDocument;
      try {
        if (conflict) throw new ApiError('REVISION_CONFLICT');
        value = stampWriting(candidate(text, source), source?.document);
        const validation = await api.validate(value, target.mode === 'update' ? target.key : undefined);
        if (!validation.canSave) throw new ApiError('VALIDATION_FAILED', validation.issues.filter(issue => issue.severity === 'error'));
      } catch (error) {
        const issue = errorMessage(error);
        if (!['REVISION_CONFLICT','MISSING_ARTICLE_INFORMATION','SLUG_IMMUTABLE','PUBLICATION_REQUIRES_CONFIRMATION','UNSUPPORTED_FORMAT','VALIDATION_FAILED'].includes(issue.code)) throw error;
        mutating = true;
        await stage(text);
        say(issue.message, issue.issues, issue.code === 'MISSING_ARTICLE_INFORMATION');
        return;
      }
      mutating = true;
      if (draft && byteLength(text) <= INTAKE_MAX_MATERIAL) {
        const staged = await stage(text, value);
        const receipt = await request<ProposalView>('POST', 'proposals/' + staged.id + '/apply',
          { expectedProposalRevision: staged.revision, candidateHash: staged.candidateHash, target, factsConfirmed: true });
        if (receipt.state !== 'applied') throw new ApiError('INVALID_RESPONSE');
        recordWrite(receipt.key, receipt.sourceRevision, value, text);
      } else {
        const result = target.mode === 'update' ? await api.save(target.key, target.expectedSourceRevision, value) : await api.create(value);
        const previous = original !== undefined && !draft?.writing ? undefined : draft;
        recordWrite(result.key, result.revision, value, text);
        if (previous) {
          try { await request('DELETE', 'proposals/' + previous.id, { expectedProposalRevision: previous.revision }); }
          catch { say('网站源码已保存。本机旧原稿尚未清理，可从内容选择器核对。'); return; }
        }
      }
      say('');
    } catch (error) {
      const { code } = errorMessage(error);
      if (mutating && ['CONNECTION_LOST', 'INVALID_RESPONSE', 'FILE_OPERATION_FAILED'].includes(code)) writeUnknown = true;
      if (code === 'REVISION_CONFLICT') conflict = true;
      report(error);
    } finally { working = false; if (mutating && !closing) void refreshList(); render(); }
  }
  async function refresh() {
    if (locked() || closing || editor.composing()) return;
    cancelTask(); setMode('edit'); clearPreview();
    say('');
    await refreshList();
    const selected = target;
    if (selected.mode === 'update' && rows.find(row => row.key === selected.key)?.revision !== selected.expectedSourceRevision) {
      if (!dirty() && !draft && !writeUnknown && rows.some(row => row.key === selected.key)) await openSource(selected.key);
      else { conflict = true; say('源码有外部变动，当前文字保留。请从内容选择器打开最新版本核对。'); }
    }
    try { await publication.restore(); } catch { /* Writing and preview remain available without receipts. */ }
    render();
  }
  function clearPreview() {
    previewCache = undefined;
    get('writing-preview-pane').replaceChildren();
  }
  function locatePreview(frame: HTMLIFrameElement, line: number) {
    const blocks = frame.contentDocument?.querySelectorAll<HTMLElement>('[data-source-line]');
    let best: HTMLElement | undefined, previous = 0;
    for (const block of blocks ?? []) {
      const position = Number(block.dataset.sourceLine);
      if (position <= line && position >= previous) { previous = position; best = block; }
    }
    if (best) best.scrollIntoView({ block: 'start' });
    else frame.contentWindow?.scrollTo(0, 0);
  }
  async function preview() {
    if (locked() || closing || editor.composing() || readOnly) return;
    clock.pause();
    cancelTask();
    const text = editor.text(), body = thinkPreviewBody(text);
    const line = Math.max(1, editor.line() - (text.slice(0, text.length - body.length).match(/\r\n|\r|\n/g)?.length ?? 0));
    if (returnScroll === undefined) returnScroll = editor.scroll();
    if (previewCache?.ready && previewCache.body === body) {
      setMode('preview'); locatePreview(previewCache.frame, line);
      say(previewCache.notice); render(); return;
    }
    clearPreview();
    const task = { kind: 'preview' as const, controller: new AbortController() };
    pending = task;
    setMode('preview'); say('正在生成预览…'); render();
    try {
      const result = await request<FastThinkPreviewResult>('POST', 'think/preview-fast', { body }, task.controller.signal, 15_000);
      if (pending !== task) return;
      const frame = document.createElement('iframe');
      frame.title = 'Markdown 快速预览'; frame.setAttribute('sandbox', 'allow-same-origin'); frame.referrerPolicy = 'no-referrer';
      const notice = [result.blockedResources && '受限或缺失的图片未加载。', result.restrictedHtml && '预览已隐藏不安全或不支持的 HTML。'].filter(Boolean).join(' ');
      const entry = { body, frame, notice, ready: false };
      previewCache = entry;
      frame.addEventListener('load', () => {
        if (previewCache !== entry) return;
        entry.ready = true;
        if (!get('writing-preview-pane').hidden) locatePreview(frame, line);
      }, { once: true });
      frame.srcdoc = result.html;
      get('writing-preview-pane').append(frame);
      say(notice);
    } catch (error) { if (pending === task) { setMode('edit'); report(error); } }
    finally { if (pending === task) { pending = undefined; if (!get('writing-message').textContent && original === undefined) get('writing-issues').hidden = true; } render(); }
  }
  async function organize() {
    if (locked() || closing || editor.composing() || conflict || readOnly) return;
    clock.pause();
    const text = editor.text(), snapshot = version;
    if (byteLength(text) > AI_MAX_INPUT_BYTES) { report(new ApiError('AI_INPUT_TOO_LARGE')); return; }
    cancelTask();
    const task = { kind: 'ai' as const, controller: new AbortController() };
    pending = task; say('正在整理当前全文…'); render();
    try {
      const organized = await request<Suggestion>('POST', 'intake/think/suggest', { material: text, target }, task.controller.signal, AI_TIMEOUT_MS + 10_000);
      if (pending !== task || snapshot !== version) return;
      let base: ReviewDraft, malformed = false;
      try { base = candidate(text, source); }
      catch {
        if (!source && frontmatter.test(text)) {
          const draftBuffer = parseThinkDraftBuffer(text);
          if (draftBuffer.ok && !draftBuffer.value.metadata.slug && !draftBuffer.value.metadata.published) base = draftBuffer.value;
          else { base = { metadata: {}, body: text }; malformed = true; }
        } else {
          base = { metadata: { ...source?.document?.metadata }, body: text };
          malformed = frontmatter.test(text);
        }
      }
      const review = writingReview(base, organized.candidate, organized.evidence, organized.edits ?? [],
        target.mode === 'create' && organized.candidate.metadata.slug ? today() : undefined, target.mode === 'update');
      suggestion = { original: text, base, changes: review.changes, malformed };
      const notes = [...review.notes, ...organized.notes.filter(note => !note.startsWith('AI 仅整理候选') && !note.startsWith('部分字段没有逐字来源'))];
      get('writing-ai-notes').replaceChildren(...notes.map(note => {
        const item = document.createElement('li'); item.textContent = note; return item;
      }));
      get('writing-ai-changes').hidden = review.changes.length === 0;
      get<HTMLDetailsElement>('writing-ai-context').open = false;
      get('writing-ai-context').hidden = !review.changes.some(change => !('field' in change));
      get('writing-ai-items').replaceChildren(...review.changes.map((change, index) => {
        const label = document.createElement('label'), selection = document.createElement('input');
        selection.type = 'checkbox'; selection.dataset.index = String(index);
        selection.disabled = malformed;
        const labelText = document.createElement('strong');
        labelText.textContent = ('field' in change ? fieldLabels[change.field] : '正文修改 ' + (index + 1))
          + (change.unconfirmed ? '（待确认）' : '');
        const values = document.createElement('span');
        values.className = 'writing-ai-values';
        for (const [tag, value, placeholder] of [['del', change.before, '未填写或新增'], ['ins', change.after, '删除']] as const) {
          const element = document.createElement(tag);
          element.textContent = value?.trim() ? value : value ? '（仅空白）' : '（' + placeholder + '）';
          values.append(element);
        }
        label.append(selection, labelText, values);
        return label;
      }));
      showAiCandidate();
      aiDialog.showModal();
      say('');
    } catch (error) { if (pending === task) report(error); }
    finally { if (pending === task) { pending = undefined; if (!get('writing-message').textContent && original === undefined) get('writing-issues').hidden = true; } render(); }
  }
  function selectedChanges() {
    return Array.from(get('writing-ai-items').querySelectorAll<HTMLInputElement>('input:checked'), input => suggestion!.changes[Number(input.dataset.index)]!);
  }
  function showAiCandidate() {
    if (!suggestion) return;
    const selected = selectedChanges();
    const missingSlug = !suggestion.base.metadata.slug && !selected.some(change => 'field' in change && change.field === 'slug');
    const stale = editor.text() !== suggestion.original;
    button('ai-apply').disabled = stale || suggestion.malformed || !selected.length;
    get('writing-ai-status').textContent = stale ? '编辑区内容已变动。请取消并重新整理，原稿保留。'
      : suggestion.malformed ? '文章信息格式无效。请取消并修复开头的 YAML 后重试，原稿保留。'
      : !suggestion.changes.length ? '没有可安全应用的修改。待核对事项仅供参考。'
      : !selected.length ? '请先勾选要应用的修改。'
      : '已选 ' + selected.length + ' 项，仅修改编辑区。' + (missingSlug ? '无 slug 可保存为本机原稿。' : '');
    const show = aiDialog.open && get<HTMLDetailsElement>('writing-ai-context').open;
    const scroll = comparison?.dom.scrollTop ?? 0;
    comparison?.destroy(); comparison = undefined;
    if (show) {
      const { base } = suggestion;
      comparison = writingComparison(get('writing-comparison'), base.body, applyReview(base, selected).body);
      comparison.dom.scrollTop = scroll;
    }
  }
  async function applyAi() {
    if (!suggestion || locked() || closing || button('ai-apply').disabled) return;
    const review = suggestion, selected = selectedChanges();
    const value = applyReview(review.base, selected);
    const prior = frontmatter.test(review.original);
    const visible = { ...value.metadata };
    const originalMetadata = prior ? parseThinkDraftBuffer(review.original) : undefined;
    for (const field of ['published', 'createdAt', 'updatedAt'] as const) {
      if (!originalMetadata?.ok || !Object.hasOwn(originalMetadata.value.metadata, field)) delete visible[field];
    }
    const after = prior || selected.some(change => 'field' in change)
      ? serializeThinkDraftBuffer({ ...value, metadata: visible }, prior ? review.original : undefined)
      : { ok: true as const, value: value.body };
    if (!after.ok) {
      get('writing-ai-status').textContent = after.error.issues.map(issue => issue.message).join(' ') || '选中的修改无法生成有效文章，请取消部分选择后重试。';
      return;
    }
    working = true; render();
    get<HTMLFieldSetElement>('writing-ai-changes').disabled = true;
    button('ai-apply').disabled = true;
    get('writing-ai-status').textContent = '正在检查选中的修改…';
    try {
      const slug = value.metadata.slug;
      if (slug) {
        const check = await api.validate({ ...value, metadata: { ...value.metadata, slug } }, target.mode === 'update' ? target.key : undefined);
        if (!check.canSave) throw new ApiError('VALIDATION_FAILED', check.issues.filter(issue => issue.severity === 'error'));
      }
      if (!aiDialog.open || suggestion !== review) return;
      if (editor.text() !== review.original) {
        get('writing-ai-status').textContent = '编辑区内容已变动。请取消并重新整理，原稿保留。';
        return;
      }
      aiDialog.close(); suggestion = undefined; setMode('edit'); editor.replace(after.value);
    } catch (error) {
      if (aiDialog.open && suggestion === review) {
        const issue = errorMessage(error);
        get('writing-ai-status').textContent = [issue.message, ...issue.issues.map(item => item.message)].join(' ');
      }
    } finally {
      working = false;
      get<HTMLFieldSetElement>('writing-ai-changes').disabled = false;
      if (aiDialog.open && suggestion === review) button('ai-apply').disabled = editor.text() !== review.original;
      render(); if (!aiDialog.open) editor.focus();
    }
  }
  async function publish() {
    if (locked() || closing || editor.composing() || conflict || writeUnknown || readOnly || publication.uncertain()) return;
    const text = editor.text();
    working = true; clock.pause(); cancelTask(); say('正在准备发布差异…'); render();
    try {
      const value = stampWriting(candidate(text, source), source?.document);
      const validation = await api.validate({ ...value, metadata: { ...value.metadata, published: true } }, target.mode === 'update' ? target.key : undefined);
      if (!validation.publishReady) throw new ApiError('VALIDATION_FAILED', validation.issues);
      const reference = savedWhere === 'source' && !dirty() && target.mode === 'update'
        ? { module: 'think' as const, key: target.key, expectedSourceRevision: target.expectedSourceRevision }
        : await stage(text, value).then(staged => ({ proposalId: staged.id, expectedProposalRevision: staged.revision }));
      const id = await publication.prepare(reference, value.metadata.title ?? value.metadata.slug);
      acceptedPublication = { id, text, confirmed: false };
      say('');
    } catch (error) { report(error); }
    finally { working = false; if (draft) void refreshList(); render(); }
  }

  button('new').onclick = () => {
    if (!mayOpen()) return;
    clock.select();
    source = draft = undefined; target = { mode: 'create' }; original = undefined; conflict = readOnly = false;
    showBuffer('');
  };
  button('refresh').onclick = () => { void refresh(); };
  button('save').onclick = () => { void save(); };
  button('edit').onclick = () => { cancelTask(); setMode('edit'); say(''); render(); editor.focus(); };
  button('preview').onclick = () => { void preview(); };
  button('organize').onclick = () => { void organize(); };
  button('publish').onclick = () => { void publish(); };
  button('cancel-task').onclick = () => { cancelTask(); setMode('edit'); say(''); render(); };
  button('add-info').onclick = () => {
    if (locked() || closing || editor.composing() || frontmatter.test(editor.text())) return;
    editor.replace(display({ metadata: { slug: '', title: '', summary: '', date: today(), kind: 'article' }, body: editor.text() }));
    editor.focus();
  };
  button('original').onclick = () => { get('writing-original-text').textContent = original ?? ''; originalDialog.showModal(); };
  button('original-close').onclick = () => originalDialog.close();
  button('ai-apply').onclick = () => { void applyAi(); };
  get('writing-ai-items').onchange = showAiCandidate;
  get<HTMLDetailsElement>('writing-ai-context').ontoggle = showAiCandidate;
  button('ai-cancel').onclick = () => aiDialog.close();
  aiDialog.addEventListener('close', () => { comparison?.destroy(); comparison = undefined; suggestion = undefined; });
  for (const link of root.querySelectorAll<HTMLAnchorElement>('.writing-other a')) link.onclick = event => {
    event.preventDefault();
    maintenance(link.hash);
  };
  document.addEventListener('click', event => { if (event.target instanceof Node && !picker.contains(event.target)) picker.open = false; });
  picker.addEventListener('keydown', event => {
    if (event.key === 'Escape') { picker.open = false; picker.querySelector('summary')?.focus(); }
  });
  window.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.isComposing) return;
    if (event.shiftKey && event.key.toLowerCase() === 'm') {
      event.preventDefault(); maintenance('#maintenance'); return;
    }
    if (event.key.toLowerCase() !== 's') return;
    event.preventDefault();
    if (!aiDialog.open && !originalDialog.open) void save();
  });
  window.addEventListener('beforeunload', event => {
    if (!closeApproved && (dirty() || locked() || writeUnknown || publication.uncertain())) event.preventDefault();
  });
  window.addEventListener('pagehide', cancelTask, { once: true });
  installDesktopExit({
    dirty, unsettled: () => locked() || editor.composing(), uncertain: () => writeUnknown || publication.uncertain(),
    canSave: () => !readOnly && !writeUnknown && !locked(),
    save: async () => { await save(true); },
    closing: value => { closing = value; if(value)clock.pause(); render(); },
    beforeFinish: () => clock.finish(),
    finish: () => { closeApproved = true; cancelTask(); },
    resume: () => { closeApproved = false; say('关闭未确认，当前文字保留。'); },
  }, firstReady);
  render();
  void refreshList().then(() => { if (ready) editor.focus(); return publication.restore(); }).catch(() => {});
}
