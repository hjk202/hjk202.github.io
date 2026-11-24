import type { PublicationPlan, PublicationStatus } from '../contracts/publish.ts';
import { awaitingPages } from '../contracts/publish.ts';
import type { writingRequest } from './writing-request.ts';
import { ApiError } from './api.ts';

type Reference = { module: 'think'; key: string; expectedSourceRevision: string } | { proposalId: string; expectedProposalRevision: string };
const active = (phase: PublicationStatus['phase']) => ['committing', 'checking', 'saving', 'pushing', 'dispatching'].includes(phase);

export function thinkPublication(request: ReturnType<typeof writingRequest>, get: <T extends HTMLElement = HTMLElement>(id: string) => T,
  notify: () => void, landed: (value: PublicationStatus) => Promise<void>) {
  let status: PublicationStatus | undefined, approved: PublicationPlan | undefined;
  let busy = false, uncertain = false, timer: ReturnType<typeof setTimeout> | undefined;
  let requestFailed = false;
  const dialog = get<HTMLDialogElement>('writing-publish-review');
  const button = (id: string) => get<HTMLButtonElement>(id);
  const report = get('writing-publication');
  const state = get('writing-publication-state');

  function render() {
    const reviewing = status?.phase === 'prepared' && dialog.open;
    report.hidden = !requestFailed && (!status || reviewing || status.phase === 'closed');
    if (requestFailed) state.textContent = '发布状态待核对，请先读取记录。';
    else if (status) {
      state.textContent = status.live ? '已上线' :
        status.phase === 'verifying' ? '已部署，等待核验' : status.phase === 'deploying' ? '正在部署' :
        status.phase === 'waiting' || status.phase === 'dispatching' ? '已推送，等待部署' :
        status.phase === 'failed' && status.runId ? '发布失败，请查看 GitHub' :
        status.pushState === 'confirmed' ? '已推送，部署待核对' :
        active(status.phase) ? '尚未推送，正在准备' : status.phase === 'unknown' ? '发布状态待核对' : '尚未推送';
      get('writing-publication-detail').textContent = [status.message, ...(status.observations ?? [])].join('\n');
    }
    button('writing-publication-check').hidden = !status || !uncertain && !['unknown', 'failed'].includes(status.phase);
    button('writing-publication-verify').hidden = !status?.runId || status.live || !['verifying','failed','unknown'].includes(status.phase);
    button('writing-publication-end').hidden = !status || status.live || !uncertain && !['unknown','failed','prepared'].includes(status.phase);
    for (const id of ['check', 'verify', 'end']) button('writing-publication-' + id).disabled = busy || !!status && active(status.phase) && !uncertain;
    notify();
  }
  function failed(error: unknown) {
    requestFailed = uncertain = true;
    get('writing-publication-detail').textContent = error instanceof ApiError ? error.code : 'INVALID_RESPONSE';
    render();
  }
  async function show(value: PublicationStatus) {
    clearTimeout(timer);
    status = value; requestFailed = false; uncertain = value.phase === 'unknown' || value.phase === 'failed' && value.sourceState === 'confirmed';
    render();
    if (active(value.phase) || awaitingPages(value.phase)) timer = setTimeout(() => { void poll(); }, active(value.phase)?1_000:6_000);
    if (value.sourceState === 'confirmed') await landed(value);
  }
  async function poll() {
    if (!status) return;
    const current=status;
    try {
      const remote=awaitingPages(current.phase);
      const next=await request<PublicationStatus>(remote?'POST':'GET','publish/'+current.id+(remote?'/reconcile':''),remote?{}:undefined);
      if(status?.id===current.id)await show(next);
    } catch(error){
      if(status?.id!==current.id)return;
      if(error instanceof ApiError&&error.code==='PUBLISH_BUSY'){timer=setTimeout(()=>{void poll();},2_000);return;}
      failed(error);
    }
  }
  async function end(id: string) {
    const current = await request<PublicationStatus>('GET', 'publish/' + id);
    if (!['prepared', 'failed', 'unknown'].includes(current.phase)) return show(current);
    await show(await request<PublicationStatus>('POST', 'publish/' + id + '/close',
      { expectedStatusRevision: current.revision, acknowledgeUnverified: true }));
  }
  const cancel = async () => {
    const plan = approved;
    approved = undefined; dialog.close();
    if (!plan) return;
    busy = true; notify();
    try { await end(plan.id); } catch (error) { failed(error); }
    finally { busy = false; notify(); }
  };
  dialog.addEventListener('cancel', event => { event.preventDefault(); void cancel(); });
  button('writing-publish-cancel').onclick = () => { void cancel(); };
  button('writing-publish-confirm').onclick = () => { void (async () => {
    const plan = approved;
    if (!plan?.canExecute || busy) return;
    approved = undefined; busy = true; dialog.close(); notify();
    try { await show(await request<PublicationStatus>('POST', 'publish/' + plan.id + '/execute',
      { bindingHash: plan.bindingHash, approvePublication: true }, undefined, 300_000)); }
    catch (error) { failed(error); }
    finally { busy = false; render(); }
  })(); };
  button('writing-publication-check').onclick = () => { void (async () => {
    if (!status || busy) return;
    busy = true; render();
    try {
      await poll();
      if (status.phase === 'unknown' || status.phase === 'failed') await show(await request<PublicationStatus>('POST', 'publish/' + status.id + '/reconcile', {}));
    } catch (error) { failed(error); }
    finally { busy = false; render(); }
  })(); };
  button('writing-publication-verify').onclick = () => { void (async () => {
    if (!status || busy) return;
    busy = true; render();
    try { await show(await request<PublicationStatus>('POST', 'publish/' + status.id + '/verify', {}, undefined, 300_000)); }
    catch (error) { failed(error); }
    finally { busy = false; render(); }
  })(); };
  button('writing-publication-end').onclick = () => { void (async () => {
    if (!status || busy || !confirm('结束这条未核验的发布记录？已经发生的保存或部署仍会保留。')) return;
    busy = true; render();
    try { await end(status.id); } catch (error) { failed(error); }
    finally { busy = false; render(); }
  })(); };
  window.addEventListener('pagehide', () => clearTimeout(timer), { once: true });
  return {
    busy: () => busy || dialog.open || (!!status && active(status.phase) && !uncertain),
    pending: () => !!status&&awaitingPages(status.phase),
    uncertain: () => uncertain,
    async prepare(reference: Reference, title: string) {
      busy = true; notify();
      try {
        const plan = await request<PublicationPlan>('POST', 'publish/prepare', reference, undefined, 300_000);
        approved = plan;
        status = await request<PublicationStatus>('GET', 'publish/' + plan.id);
        get('writing-publish-target').textContent = title + ' → ' + plan.site + (plan.verification ? ' · 单篇 Think，GitHub 构建和验证' : '');
        get('writing-publish-diff').textContent = plan.remoteDiff || '网站内容无差异。';
        get('writing-publish-local').textContent = plan.localDiff || '本机源码无变化。';
        get('writing-publish-issues').textContent = plan.issues.join('\n');
        button('writing-publish-confirm').disabled = !plan.canExecute;
        dialog.showModal();
        return plan.id;
      } finally { busy = false; render(); }
    },
    async restore() {
      if (busy || dialog.open || status && (status.live || active(status.phase) && !uncertain)) return;
      const statuses = await request<PublicationStatus[]>('GET', 'publish');
      const next = statuses.find(item => !['closed', 'complete', 'prepared'].includes(item.phase)) ?? statuses.find(item=>item.live);
      if (next) await show(next);
    },
  };
}
