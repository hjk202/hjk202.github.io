import { PrivateSession } from '../private/session.ts';
import { thinkPosts, newPrivateThink } from '../private/think.ts';
import { PrivateError } from '../private/error.ts';
import { privateApi } from './private-api.ts';
import { ApiError } from './api.ts';
import type { ExitEditor } from './desktop.ts';
import type { PrivateSelectionMode,DeliveryCandidate } from '../contracts/private.ts';
import { textField, selectField } from './form-fields.ts';
import { decodeBase64,decryptVault } from '../../src/core/vault/crypto.ts';
import thinkView from '../../src/modules/think/vault.client.ts';
import type { VaultView } from '../../src/core/vault/types.ts';
import keepView from '../../src/modules/keep/vault.client.ts';
import { privateBookmarks, newPrivateBookmark } from '../private/keep.ts';
import { privateKeepFields } from './private-keep.ts';
import meView from '../../src/modules/me/vault.client.ts';
import { privateProfile } from '../private/me.ts';
import { privateMeFields } from './private-me.ts';
import buildView from '../../src/modules/build/vault.client.ts';
import { privateBuild,newPrivateProject,newPrivateSupplement } from '../private/build.ts';
import { privateBuildFields } from './private-build.ts';

type Bridge = { postMessage(value: { type: 'studio:private-select'; requestId: string; mode: PrivateSelectionMode }): void; addEventListener(type: 'message', callback: (event: MessageEvent) => void): void };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };

export function installPrivateEditor(token: string): ExitEditor & { root: HTMLElement; open(): void; leave(): boolean } {
  const root = document.createElement('section'); root.id = 'private-editor'; root.hidden = true;
  root.innerHTML = `<h2>私人资料库</h2><p>打开或新建仓库外的加密资料库，在本机编辑后保存即可。口令不会记住，也不发送给后台、AI 或 Agent。保存只更新资料库；供网站使用需另外准备网站更新。切换公开模块、锁定、后台隐藏或闲置十分钟会清除未保存缓冲，请先保存。</p>
  <div class="toolbar"><button type="button" id="private-open">打开私人资料库</button><button type="button" id="private-create">新建私人资料库</button><button type="button" id="private-unlock">解锁所选资料库</button><button type="button" id="private-lock">立即锁定</button></div>
  <p id="private-state" role="status"></p><fieldset id="private-tools" hidden><legend id="private-module-title">私人 Think</legend><div class="toolbar"><button type="button" id="private-module-think">私人 Think</button><button type="button" id="private-module-keep">私人 Keep</button></div><button type="button" id="private-new">新建私人文章</button><button type="button" id="private-save">保存私人资料库</button><button type="button" id="private-validate">校验资料库</button><ul id="private-list"></ul><div id="private-form"></div><button type="button" id="private-delete">删除私人文章</button><button type="button" id="private-preview">内存预览私人文章</button></fieldset><div id="private-preview-content"></div>`;
  document.body.append(root);
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>('#private-' + id)!;
  new MutationObserver(() => { for (const input of get('form').querySelectorAll('input,textarea')) { input.setAttribute('autocomplete','off'); input.setAttribute('spellcheck','false'); } }).observe(get('form'),{childList:true,subtree:true});
  const bridge = window.top === window ? (window as Window & { chrome?: { webview?: Bridge } }).chrome?.webview : undefined;
  const state = new PrivateSession(), api = privateApi(token);
  let handle: string | undefined, revision: string | null = null, selectedId: string | undefined;
  let privateModule:'think'|'keep'|'me'|'build'='think';
  let busy = false, composing = false, blocked = false, closing = false, formInvalid = false, epoch = 0;
  let activeWrite: { kind: 'library' | 'export' | 'website'; generation: number } | undefined;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const dirty = () => state.dirty || formInvalid;
  const meButton=document.createElement('button');meButton.type='button';meButton.id='private-module-me';meButton.textContent='私人 Me';get('module-think').parentElement!.append(meButton);
  const buildButton=document.createElement('button');buildButton.type='button';buildButton.id='private-module-build';buildButton.textContent='私人 Build';get('module-think').parentElement!.append(buildButton);
  const supplementButton=document.createElement('button');supplementButton.type='button';supplementButton.id='private-new-supplement';supplementButton.textContent='新建公开项目的私人补充';get('new').after(supplementButton);
  const deliveryPanel=document.createElement('section');deliveryPanel.id='private-delivery';deliveryPanel.innerHTML=`<h3>供网站使用（可选）</h3><p>仅在本机使用，保存资料库后即可结束。要让网站解锁这些内容，再按以下步骤准备更新；不会提交、推送或发布。</p><button type="button" id="private-prepare">准备网站更新</button>
  <section id="private-delivery-steps" hidden aria-label="网站更新向导"><ol class="delivery-progress"><li id="private-step-select">1 · 选择更新文件位置</li><li id="private-step-export">2 · 校验并生成更新文件</li><li id="private-step-confirm">3 · 确认更新本地网站</li></ol>
  <p id="private-delivery-help"></p><div class="toolbar"><button type="button" id="private-select-export">选择新的更新文件位置</button><button type="button" id="private-export">校验并生成更新文件</button><button type="button" id="private-deliver" class="primary-action">确认更新本地网站</button></div><p id="private-delivery-message" role="status"></p><details><summary>文件版本与恢复详情</summary><p>资料库是作者源；更新文件是重新加密的密文候选；本地网站使用固定 public/vault/bundle.json。三者分别校验。旧网站密文备份在资料库同目录，恢复前请另存副本并核对口令及关联。</p><p id="private-delivery-details"></p><button type="button" id="private-delivery-status">读取本地网站文件状态</button></details><button type="button" id="private-delivery-back">返回资料库</button></section>`;root.append(deliveryPanel);
  let deliveryOpen=false,localUpdated=false;
  let exportHandle:string|undefined,candidate:DeliveryCandidate|undefined,candidateVersion=0,deliveryUncertain=false,attemptRevision:string|undefined;
  const sayDelivery=(text:string)=>{get('delivery-message').textContent=text;};
  function invalidateCandidate(){candidate=undefined;candidateVersion=0;localUpdated=false;sayDelivery('更新文件尚未生成或已失效；请先保存资料库，再准备网站更新。');get('delivery-details').textContent='';}
  // A selector transaction contains no plaintext. Its lifetime is separate from the editor epoch.
  let selection: { requestId: string; mode: PrivateSelectionMode; handle?: string } | undefined;
  let view: VaultView | undefined, unmount: (() => void) | undefined;
  const blobs = new Map<string,string>();
  const say = (value: string) => { get('state').textContent = value; };
  const passwordDialog = document.createElement('dialog'); passwordDialog.id = 'private-password-dialog';
  passwordDialog.innerHTML = `<form method="dialog" autocomplete="off"><h2>私人资料库口令</h2><p>保存请使用至少 16 个字符的口令；不会保留或发送口令。选择文件后需重新解锁。</p><label>口令<input id="private-password" type="password" autocomplete="off" spellcheck="false"></label><label id="private-password-confirm-label">再次输入口令<input id="private-password-confirm" type="password" autocomplete="off" spellcheck="false"></label><button value="cancel" type="button" id="private-password-cancel">取消</button><button value="ok" type="submit">继续</button><p id="private-password-error" role="status"></p></form>`;
  document.body.append(passwordDialog);
  const password = passwordDialog.querySelector<HTMLInputElement>('#private-password')!, confirmation = passwordDialog.querySelector<HTMLInputElement>('#private-password-confirm')!;
  let passwordResult: ((value: string | undefined) => void) | undefined, confirmPassword = false;
  function finishPassword(value?: string) { password.value = confirmation.value = ''; passwordDialog.querySelector('#private-password-error')!.textContent = ''; if (passwordDialog.open) passwordDialog.close(); const resolve = passwordResult; passwordResult = undefined; resolve?.(value); }
  function askPassword(confirm: boolean): Promise<string | undefined> {
    finishPassword(); confirmPassword = confirm; passwordDialog.querySelector<HTMLElement>('#private-password-confirm-label')!.hidden = !confirm;
    passwordDialog.showModal(); password.focus(); return new Promise(resolve => { passwordResult = resolve; });
  }
  passwordDialog.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); if (confirmPassword && password.value !== confirmation.value) { passwordDialog.querySelector('#private-password-error')!.textContent = '两次口令不同。'; return; } finishPassword(password.value); });
  passwordDialog.querySelector('#private-password-cancel')!.addEventListener('click', () => finishPassword());
  passwordDialog.addEventListener('cancel', event => { event.preventDefault(); finishPassword(); });
  function clearPreview() { unmount?.(); unmount = undefined; view?.dispose(); view = undefined; get('preview-content').replaceChildren(); for (const url of blobs.values()) URL.revokeObjectURL(url); blobs.clear(); }
  function render() {
    const label=privateModule==='think'?'私人文章':privateModule==='keep'?'私人收藏':privateModule==='build'?'私人项目':'私人介绍';get('module-title').textContent='私人 '+({think:'Think',keep:'Keep',me:'Me',build:'Build'}[privateModule]);get('new').textContent=privateModule==='me'?'新建 / 编辑私人介绍':'新建'+label;get('delete').textContent=privateModule==='me'?'清空私人介绍':'删除'+label;get('preview').textContent='内存预览'+label;supplementButton.hidden=privateModule!=='build';supplementButton.disabled=busy||closing||formInvalid;
    get<HTMLFieldSetElement>('tools').hidden = !state.unlocked;
    get<HTMLFieldSetElement>('tools').disabled = busy || closing;
    for (const id of ['open','create','unlock']) get<HTMLButtonElement>(id).disabled = !bridge || busy || closing || id === 'unlock' && !handle;
    get<HTMLButtonElement>('save').disabled = busy || closing || blocked || formInvalid || !state.unlocked;
    for (const id of ['delete','preview']) get<HTMLButtonElement>(id).disabled = busy || closing || !selectedId;
    get<HTMLButtonElement>('select-export').disabled=!bridge||busy||closing||dirty()||blocked||deliveryUncertain&&!!attemptRevision||!handle||revision===null;
    get<HTMLButtonElement>('export').disabled=!bridge||busy||closing||deliveryUncertain||dirty()||blocked||!state.unlocked||!exportHandle||revision===null;
    get<HTMLButtonElement>('deliver').disabled=!bridge||busy||closing||deliveryUncertain||dirty()||blocked||!state.unlocked||!candidate||candidateVersion!==state.version;
    get<HTMLButtonElement>('delivery-status').disabled=!bridge||busy||closing;
    get('delivery-steps').hidden=!deliveryOpen;get('prepare').hidden=deliveryOpen;
    get<HTMLButtonElement>('prepare').disabled=!bridge||busy||closing;
    get<HTMLButtonElement>('delivery-back').disabled=busy||closing;
    const stage=localUpdated||candidate?3:exportHandle?2:1;
    for(const [index,id]of ['select','export','confirm'].entries())get('step-'+id).setAttribute('aria-current',index+1===stage?'step':'false');
    get('export').hidden=stage!==2;get('deliver').hidden=stage!==3||localUpdated;
    get('delivery-help').textContent=deliveryUncertain?'上次写入结果未确认，请展开详情读取本地网站状态，不要重复写入。':localUpdated?'本地网站更新已完成，线上仍未发布。可以返回资料库，或展开详情核对版本和备份。':dirty()?'先保存私人资料库，再准备网站更新。':!state.unlocked?'请先解锁资料库；选择文件时会锁定，返回后需重新输入口令。':stage===1?'选择仓库外一个尚不存在的新文件。选择前会锁定，返回后重新解锁，已有资料保持加密保存。':stage===2?'资料库已重新打开；下一步校验完整内容和公开项目关联，并再次确认口令生成加密更新文件。':'更新文件已就绪。最后确认才替换本地网站文件；旧密文会先备份，线上网站不会自动变化。';
    root.dispatchEvent(new Event('studio:editor-state'));
  }
  function list() {
    get('list').replaceChildren(); if (!state.unlocked) return;
    const payload=state.snapshot(),entries=privateModule==='think'?thinkPosts(payload).map(post=>({id:post.id,label:`${post.title||'未命名'} · ${post.date}`})):privateModule==='keep'?privateBookmarks(payload).map(entry=>({id:entry.id,label:entry.title||'未命名收藏'})):privateModule==='build'?[...privateBuild(payload).projects.map(entry=>({id:entry.id,label:'项目 · '+(entry.title||'未命名')})),...privateBuild(payload).supplements.map(entry=>({id:entry.id,label:'补充 · '+(entry.title||'未命名')}))]:privateProfile(payload)?[{id:'me',label:'私人介绍'}]:[];
    for (const entry of entries) { const row = document.createElement('li'), button = document.createElement('button'); button.type = 'button'; button.textContent = entry.label; button.addEventListener('click', () => { if (formInvalid) return say('当前输入超过完整包限额，请先缩减或明确锁定放弃。'); selectedId = entry.id; clearPreview(); form(); }); row.append(button); get('list').append(row); }
  }
  function form() {
    get('form').replaceChildren(); if (!state.unlocked) return render();
    const candidate = state.snapshot(), post = privateModule==='think'?thinkPosts(candidate).find(post => post.id === selectedId):undefined;
    const changed = () => { try { state.replaceCandidate(candidate); invalidateCandidate(); formInvalid = false; clearPreview(); list(); say('私人修改只在内存，尚未加密保存。'); } catch (error) { formInvalid = true; invalidateCandidate(); clearPreview(); report(error); } render(); };
    if (post) {
      textField(get('form'), '私人标题', post.title, value => { post.title = value; changed(); });
      textField(get('form'), '私人摘要', post.summary, value => { post.summary = value; changed(); }, true);
      textField(get('form'), '私人日期', post.date, value => { post.date = value; changed(); });
      selectField(get('form'), '私人类型', post.kind, [['article','文章'],['note','随记']], value => { post.kind = value as 'article' | 'note'; changed(); });
      textField(get('form'), '私人正文', post.body, value => { post.body = value; changed(); }, true);
    }
    if(privateModule==='keep'){const entry=privateBookmarks(candidate).find(entry=>entry.id===selectedId);if(entry)privateKeepFields(get('form'),entry,changed);}
    if(privateModule==='me'&&selectedId==='me'){const profile=privateProfile(candidate);if(profile)privateMeFields(get('form'),profile,changed);}
    if(privateModule==='build'){const data=privateBuild(candidate),entry=[...data.projects,...data.supplements].find(entry=>entry.id===selectedId);if(entry)privateBuildFields(get('form'),entry,changed);}
    for (const input of get('form').querySelectorAll('input,textarea')) { input.setAttribute('autocomplete','off'); input.setAttribute('spellcheck','false'); }
    render();
  }
  function lock(message = '已锁定；私人缓冲、预览和口令已清除。', selecting = false) {
    if(activeWrite){if(activeWrite.kind==='library')blocked=true;else deliveryUncertain=true;message+=' 已发出的密文写入结果须重新核对，不会自动重试。';}
    clearTimeout(idle); epoch++; if(!selecting){selection=undefined;deliveryOpen=false;} state.lock(); selectedId = undefined; exportHandle=undefined;invalidateCandidate();finishPassword(); clearPreview(); get('form').replaceChildren(); get('list').replaceChildren(); busy = selecting; composing = formInvalid = false; say(message); render();
  }
  function report(error: unknown,delivery=false) {
    const codes = ['PRIVATE_UNLOCK_FAILED','PRIVATE_VALIDATION_FAILED','PRIVATE_ASSET_MISSING','PRIVATE_UNSUPPORTED_MODULE','PRIVATE_PUBLIC_REFERENCE','PRIVATE_STALE','PRIVATE_ENCRYPT_FAILED','PRIVATE_HANDLE_INVALID','PRIVATE_CONFLICT','PRIVATE_ENVELOPE_INVALID','PRIVATE_FILE_UNSAFE','PRIVATE_BACKUP_INVALID','PRIVATE_WRITE_FAILED','PRIVATE_PUBLIC_CHANGED','PRIVATE_FAILED','PRIVATE_UNAVAILABLE','CONNECTION_LOST','INVALID_RESPONSE','UNAUTHORIZED','DELIVERY_NOT_READY','DELIVERY_STALE','DELIVERY_FAILED'];
    const code = error instanceof ApiError || error instanceof PrivateError ? codes.find(code => code === error.message) ?? 'PRIVATE_FAILED' : 'PRIVATE_FAILED';
    say(`操作未完成（${code}）。${state.unlocked ? '私人修改保留在当前内存' : '私人会话保持锁定'}；${delivery?'网站更新请核对状态，不会自动重试':'不会自动重试或更新网站文件'}。`);
  }
  async function unlockSelected() {
    if (!handle || busy || document.hidden || closing) return;
    busy = true; render(); const generation = ++epoch;
    try {
      const [file, snapshot] = await Promise.all([api.read(handle), api.snapshot()]); if (generation !== epoch || closing) return;
      revision = file.revision;
      if (file.envelope === null) state.create(snapshot);
      else { const secret = await askPassword(false); if (!secret || generation !== epoch) { if(generation===epoch)say('解锁已取消；资料库仍锁定，没有修改文件。'); return; } await state.unlock(file.envelope, secret, snapshot); if (generation !== epoch) return; }
      blocked = false; selectedId = undefined; activity(); list(); form(); say('已在本机内存打开完整私人包。各模块独立编辑，未编辑内容和资产保持。');
    } catch (error) { if (generation === epoch) report(error); }
    finally { if (generation === epoch) { busy = false; render(); } }
  }
  async function save() {
    if (!handle || !state.unlocked || busy || blocked || composing || formInvalid) return;
    busy = true; invalidateCandidate();say('正在校验并加密；尚未确认资料库保存成功。'); render(); const generation = epoch;
    let sent = false;
    try {
      const snapshot = await api.snapshot(); if (generation !== epoch) return; state.validate(snapshot);
      const secret = await askPassword(true); if (!secret || generation !== epoch) return;
      const sealed = await state.seal(secret, snapshot); if (generation !== epoch) return;
      sent = true; activeWrite={kind:'library',generation};const result = await api.save(handle, revision, sealed.envelope, sealed.publicRevision);
      if (generation !== epoch) return;
      revision = result.revision; state.markSaved(sealed.version); blocked = result.cleanupPending;
      say(result.cleanupPending ? '资料库密文已保存，临时文件清理未确认。请锁定后重新打开核对，不重复保存。' : '私人资料库已保存；旧密文已备份。仅本机使用可到此结束，网站文件未变。');
    } catch (error) { if (generation === epoch) { blocked ||= sent; report(error); } }
    finally { if(activeWrite?.generation===generation)activeWrite=undefined;if (generation === epoch) { busy = false; render(); } }
  }
  async function validate(preview: boolean) {
    if (!state.unlocked || busy || formInvalid) return; busy = true; render(); const generation = epoch, version = state.version;
    try {
      const snapshot = await api.snapshot(); if (generation !== epoch || version !== state.version) return;
      const payload = state.validate(snapshot); clearPreview();
      if (preview && selectedId) {
        const previewView = (privateModule==='think'?thinkView:privateModule==='keep'?keepView:privateModule==='me'?meView:buildView)(payload.modules[privateModule], { module: { id:privateModule,name:{think:'Think',keep:'Keep',me:'Me',build:'Build'}[privateModule],route:privateModule==='me'?'/':`/${privateModule}/`,icon:'',order:0,count:0 }, publicTargets:snapshot.slugs.map(slug=>`/build/${slug}/`),base:'/',asset(id) {
          if (!blobs.has(id)) { const asset = payload.assets[id]; if (!asset) throw new PrivateError('PRIVATE_ASSET_MISSING'); blobs.set(id, URL.createObjectURL(new Blob([decodeBase64(asset.data,512*1024)],{type:asset.type}))); } return blobs.get(id)!;
        } });
        view = previewView; const cleanup = previewView.mount(get('preview-content'), selectedId); if (cleanup) unmount = cleanup;
      }
      say(preview ? '私人受控预览仅在内存；链接不导航，不启动 Astro 或发送正文。' : '完整私人包及当前公开关联校验通过；尚未保存。');
    } catch (error) { if (generation === epoch) { clearPreview(); report(error); } }
    finally { if (generation === epoch) { busy = false; render(); } }
  }
  async function exportCandidate() {
    if(!handle||revision===null||!exportHandle||!state.unlocked||dirty()||blocked||busy||closing||deliveryUncertain)return;
    busy=true;render();const generation=epoch,version=state.version;let sent=false;
    try {
      const snapshot=await api.snapshot();if(generation!==epoch)return;state.validate(snapshot);
      const master=await api.read(handle);if(generation!==epoch)return;if(master.revision!==revision)throw new PrivateError('DELIVERY_STALE');
      const secret=await askPassword(true);if(!secret||generation!==epoch)return;
      try{if(!master.envelope||JSON.stringify(await decryptVault(master.envelope,secret))!==JSON.stringify(state.snapshot()))throw new Error();}catch{throw new PrivateError('PRIVATE_UNLOCK_FAILED');}
      if(generation!==epoch)return;
      const sealed=await state.seal(secret,snapshot);if(generation!==epoch||version!==state.version)return;
      sent=true;activeWrite={kind:'export',generation};const result=await api.exportCandidate(exportHandle,handle,revision,sealed.envelope,sealed.publicRevision);
      if(generation!==epoch||version!==state.version)return;
      candidate=result;candidateVersion=version;exportHandle=undefined;
      sayDelivery('网站更新文件已生成。尚未更新本地网站，更未上线。');
      get('delivery-details').textContent=`更新文件 SHA-256：${result.revision}；资料库版本：${result.masterRevision}；本地网站预期版本：${result.targetRevision??'尚不存在'}。`;
    }catch(error){if(generation===epoch){if(sent){deliveryUncertain=true;exportHandle=undefined;}report(error,true);sayDelivery('更新文件生成未确认；不要重复覆盖。请核对错误码，重新选择尚不存在的新位置。');}}
    finally{if(activeWrite?.generation===generation)activeWrite=undefined;if(generation===epoch){busy=false;render();}}
  }
  async function replaceBundle() {
    if(!candidate||!state.unlocked||dirty()||blocked||busy||closing||deliveryUncertain||candidateVersion!==state.version)return;
    const selected=candidate,generation=epoch,version=state.version;busy=true;render();let sent=false;
    try {
      const snapshot=await api.snapshot();if(generation!==epoch)return;state.validate(snapshot);
      if(snapshot.revision!==selected.publicRevision)throw new PrivateError('PRIVATE_PUBLIC_CHANGED');
      const status=await api.deliveryStatus();if(generation!==epoch||version!==state.version)return;
      if(status.targetRevision!==selected.targetRevision)throw new PrivateError('DELIVERY_STALE');
      if(!window.confirm(`确认更新本地网站的私人内容？\n将此更新文件替换 public/vault/bundle.json。\n更新文件 SHA-256：${selected.revision}\n旧网站密文将备份到资料库同目录；此操作不提交、推送或发布，线上网站不会自动变化。`))return;
      if(generation!==epoch||version!==state.version)return;
      sent=true;attemptRevision=selected.revision;activeWrite={kind:'website',generation};const result=await api.replaceBundle(selected.id,selected.targetRevision);
      if(generation!==epoch)return;
      if(result.revision!==selected.revision)throw new ApiError('INVALID_RESPONSE');
      candidate=undefined;deliveryUncertain=result.cleanupPending;localUpdated=!result.cleanupPending;if(!result.cleanupPending)attemptRevision=undefined;
      sayDelivery(result.cleanupPending?'本地网站密文已写入，但临时清理未确认；请核对状态，不要发布或盲重试。':'本地网站已更新。资料库保持；这是待发布的本地改动，尚未提交或上线。');
      get('delivery-details').textContent=`本地网站 SHA-256：${result.revision}。${result.backupRevision?'旧密文备份 SHA-256：'+result.backupRevision+'。':'原网站密文不存在。'}`;
    }catch(error){if(generation===epoch){if(sent)deliveryUncertain=true;else invalidateCandidate();report(error,true);sayDelivery('本地网站更新未确认；可能尚未写入或响应未知。请展开详情读取文件状态核对，不自动重试。');}}
    finally{if(activeWrite?.generation===generation)activeWrite=undefined;if(generation===epoch){busy=false;render();}}
  }
  async function inspectDelivery() {
    if(busy||closing||!bridge)return;busy=true;render();const generation=epoch;
    try{const status=await api.deliveryStatus();if(generation!==epoch)return;if(attemptRevision&&status.targetRevision===attemptRevision){deliveryUncertain=false;attemptRevision=undefined;candidate=undefined;candidateVersion=0;localUpdated=true;sayDelivery('已读取并确认本地网站已更新；仍未提交、推送或发布。');}else sayDelivery(deliveryUncertain?'上次结果仍未确认，请保留现场，不盲重试。':'已读取本地网站文件状态，没有进行写入。');get('delivery-details').textContent=`本地网站 SHA-256：${status.targetRevision??'尚不存在'}。`;}
    catch{if(generation===epoch)sayDelivery('本地网站文件状态无法安全读取；未重试写入，请核对错误与本地文件。');}
    finally{if(generation===epoch){busy=false;render();}}
  }
  function choose(mode: PrivateSelectionMode) {
    if (!bridge || busy || closing || composing || mode==='export'&&(dirty()||blocked||deliveryUncertain&&!!attemptRevision||!handle||revision===null)) return;
    if(dirty()&&!window.confirm('选择资料库会锁定并放弃未保存私人修改，继续？'))return;
    lock('已保存的资料保持加密；选择文件前已锁定，返回后需重新解锁。');
    deliveryOpen=mode==='export';selection = { requestId:crypto.randomUUID(),mode }; busy = true; render(); bridge.postMessage({ type:'studio:private-select',requestId:selection.requestId,mode });
  }
  function resumeSelection() {
    if(!selection?.handle||document.hidden||closing)return;
    const selected=selection;selection=undefined;busy=false;
    if(selected.mode==='export'){exportHandle=selected.handle;deliveryUncertain=false;attemptRevision=undefined;sayDelivery('已选择新的更新文件位置；请重新解锁资料库，尚未写入。');}
    else{handle=selected.handle;blocked=false;}
    void unlockSelected();
  }
  bridge?.addEventListener('message', event => {
    const value = event.data as Record<string,unknown>;
    if (!selection || !value || typeof value !== 'object' || value.requestId !== selection.requestId || selection.handle) return;
    if (value.type === 'studio:private-bound' && Object.keys(value).sort().join() === 'handle,requestId,type' && uuid(value.handle)) {selection.handle=value.handle;resumeSelection();render();}
    else if (value.type === 'studio:private-cancelled' || value.type === 'studio:private-error') { selection = undefined; busy = false; say('文件未选择或无法安全打开；没有读取明文或修改文件。'); render(); }
  });
  get('open').addEventListener('click', () => choose('open')); get('create').addEventListener('click', () => choose('create'));
  get('unlock').addEventListener('click', () => { if (!dirty() || window.confirm('重新解锁会放弃未保存私人修改，继续？')) { lock(); void unlockSelected(); } });
  get('lock').addEventListener('click', () => { if (!dirty() || window.confirm('立即锁定将清除未保存私人修改，继续？')) lock(); });
  for(const module of ['think','keep','me','build'] as const)get('module-'+module).addEventListener('click',()=>{if(busy||closing||composing||formInvalid)return;privateModule=module;selectedId=undefined;clearPreview();list();form();});
  function newRecord(supplement=false) { if (!state.unlocked || busy || closing || formInvalid || supplement&&privateModule!=='build') return; const previous=selectedId;try{const payload=state.snapshot();if(privateModule==='think'){const post=newPrivateThink(today());payload.modules.think??={posts:[]};thinkPosts(payload).push(post);selectedId=post.id;}else if(privateModule==='keep'){const entry=newPrivateBookmark();payload.modules.keep??={bookmarks:[]};privateBookmarks(payload).push(entry);selectedId=entry.id;}else if(privateModule==='me'){payload.modules.me??={paragraphs:[]};selectedId='me';}else{payload.modules.build??={projects:[],supplements:[]};const data=privateBuild(payload);if(supplement){const entry=newPrivateSupplement();data.supplements.push(entry);selectedId=entry.id;}else{const entry=newPrivateProject();data.projects.push(entry);selectedId=entry.id;}}state.replaceCandidate(payload);invalidateCandidate();clearPreview();list();form();say('私人记录只在内存，尚未加密保存。');}catch(error){selectedId=previous;report(error);} }
  get('new').addEventListener('click',()=>newRecord());supplementButton.addEventListener('click',()=>newRecord(true));
  get('delete').addEventListener('click', () => { if (!state.unlocked || !selectedId || busy || closing || !window.confirm(privateModule==='me'?'清空整个私人介绍（段落和链接）？须保存才写入资料库，公开资料保持。':'从当前资料库缓冲删除这条记录？须保存才写入资料库。')) return; const payload=state.snapshot();if(privateModule==='think')payload.modules.think={posts:thinkPosts(payload).filter(post=>post.id!==selectedId)};else if(privateModule==='keep')payload.modules.keep={bookmarks:privateBookmarks(payload).filter(entry=>entry.id!==selectedId)};else if(privateModule==='me')delete payload.modules.me;else{const data=privateBuild(payload);data.projects=data.projects.filter(entry=>entry.id!==selectedId);data.supplements=data.supplements.filter(entry=>entry.id!==selectedId);}state.replaceCandidate(payload);invalidateCandidate();selectedId=undefined;clearPreview();list();form();say('私人记录已从内存缓冲移除，尚未加密保存。'); });
  get('save').addEventListener('click', () => { void save(); }); get('validate').addEventListener('click', () => { void validate(false); }); get('preview').addEventListener('click', () => { void validate(true); });
  get('select-export').addEventListener('click',()=>choose('export'));get('export').addEventListener('click',()=>{void exportCandidate();});get('deliver').addEventListener('click',()=>{void replaceBundle();});get('delivery-status').addEventListener('click',()=>{void inspectDelivery();});
  get('prepare').addEventListener('click',()=>{deliveryOpen=true;render();});get('delivery-back').addEventListener('click',()=>{deliveryOpen=false;render();});
  get('preview-content').addEventListener('click', event => { if (event.target instanceof Element && event.target.closest('a')) event.preventDefault(); });
  root.addEventListener('compositionstart', () => { composing = true; }); root.addEventListener('compositionend', () => { composing = false; });
  function activity() { clearTimeout(idle); if (state.unlocked) idle = setTimeout(() => lock('闲置十分钟，私人会话已锁定。未保存缓冲已清除。'),600000); }
  for (const event of ['pointerdown','keydown','wheel']) document.addEventListener(event, activity, { passive:true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) lock('进入后台，私人会话已锁定。未保存缓冲已清除。',!!selection); else resumeSelection(); });
  window.addEventListener('pagehide', () => { clearTimeout(idle); lock(); }); window.addEventListener('pageshow', event => { if (event.persisted) lock(); });
  render(); say(bridge ? '资料库已锁定；打开已有资料库，或在仓库外新建一份。' : '私人资料库文件操作仅在正式 Windows App 中提供。');
  return { root, open() { render(); }, leave() { if (busy || composing) { say('请等待当前私人操作完成后切换。'); return false; } if (dirty() && !window.confirm('切换公开模块会锁定并放弃未保存私人修改，继续？')) return false; lock(); return true; }, dirty, unsettled:() => busy || composing, uncertain:() => blocked||deliveryUncertain, canSave:() => !dirty() || !!handle && !blocked && !busy && !composing && !formInvalid, save, closing(value) { closing = value; if(!value)resumeSelection();render(); }, finish() { lock(); }, resume() { render(); } };
}
