import { prepareClose, closeFailed } from '../contracts/desktop.ts';
import type { CloseResult } from '../contracts/desktop.ts';

type WebView = {
  postMessage(value: { type: 'studio:editor-ready' | 'studio:editor-initialized' } | CloseResult): void;
  addEventListener(type: 'message', handler: (event: MessageEvent) => void): void;
};
export type ExitEditor = {
  dirty(): boolean;
  unsettled(): boolean;
  uncertain(): boolean;
  canSave(): boolean;
  save(): Promise<void>;
  finish(): void;
  beforeFinish?(): Promise<void>;
  resume(): void;
  closing(value: boolean): void;
};
/** Browser mode has no native lifecycle. Only the top-level host's WebView message channel is used. */
export function installDesktopExit(editor: ExitEditor, ready: Promise<void> = Promise.resolve()): void {
  const bridge = (window as Window & { chrome?: { webview?: WebView } }).chrome?.webview;
  if (!bridge || window.top !== window || !/^http:\/\/127\.0\.0\.1:[1-9]\d*$/.test(location.origin)) return;
  let active: string | undefined;
  let prepared: string | undefined;
  let saving = false;
  let failedSave = false;
  const dialog = document.createElement('dialog'); dialog.id = 'studio-exit';
  const title = document.createElement('h2'); title.textContent = '退出 Studio';
  const state = document.createElement('p'); state.id = 'studio-exit-state';
  const controls = document.createElement('div'); controls.className = 'toolbar';
  const save = document.createElement('button'), discard = document.createElement('button'), cancel = document.createElement('button');
  for (const button of [save, discard, cancel]) button.type = 'button';
  save.textContent = '保存并退出'; discard.textContent = '放弃修改并退出'; cancel.textContent = '取消';
  controls.append(save, discard, cancel); dialog.append(title, state, controls); document.body.append(dialog);
  const reply = (status: 'ready' | 'cancel') => {
    if (!active) return;
    const requestId = active; active = undefined;
    if (status === 'ready') {
      prepared = requestId; state.textContent = '正在关闭本次服务…'; save.disabled = discard.disabled = cancel.disabled = true;
      if (editor.beforeFinish) {
        void editor.beforeFinish().catch(() => {}).then(() => { editor.finish(); bridge.postMessage({ type: 'studio:close-result', requestId, status }); });
        return;
      }
      editor.finish();
    }
    else { editor.closing(false); dialog.close(); }
    bridge.postMessage({ type: 'studio:close-result', requestId, status });
  };
  const update = () => {
    const pending = editor.unsettled();
    state.textContent = pending ? '操作尚未结束或正在输入。请等待结果，或取消退出；不会中断写入后假定回滚。'
      : failedSave ? '保存未确认或仍有修改。缓冲保留，请取消退出，核对编辑器诊断后再决定。'
      : editor.uncertain() ? '操作结果未确认或源文件存在冲突。缓冲保留，请取消退出后核对；也可明确放弃并退出。'
      : editor.dirty() ? '当前有未保存修改。请选择保存、放弃或取消。' : '未保存内容已处理，可退出。';
    save.disabled = pending || !editor.canSave(); discard.disabled = pending;
    cancel.disabled = false;
  };
  cancel.addEventListener('click', () => reply('cancel'));
  dialog.addEventListener('cancel', event => { event.preventDefault(); reply('cancel'); });
  discard.addEventListener('click', () => { if (!editor.unsettled()) reply('ready'); });
  save.addEventListener('click', () => { void (async () => {
    if (saving || editor.unsettled() || !editor.canSave()) return;
    saving = true;
    save.disabled = discard.disabled = true;
    await editor.save();
    saving = false;
    if (!active) return;
    if (!editor.dirty() && !editor.unsettled() && !editor.uncertain()) reply('ready');
    else { failedSave = true; update(); }
  })(); });
  bridge.addEventListener('message', event => {
    if (closeFailed(event.data) && event.data.requestId === prepared) {
      prepared = undefined; editor.resume(); editor.closing(false); if (dialog.open) dialog.close(); return;
    }
    if (!prepareClose(event.data) || active || prepared) return;
    active = event.data.requestId; failedSave = false; editor.closing(true);
    if (!editor.dirty() && !editor.unsettled() && !editor.uncertain()) reply('ready');
    else { update(); dialog.showModal(); }
  });
  // Recheck writes/composition while the modal is open. This does not retry any operation.
  const timer = window.setInterval(() => { if (!saving && active && dialog.open) update(); }, 150);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
  bridge.postMessage({ type: 'studio:editor-initialized' });
  void ready.then(()=>{if(!prepared)bridge.postMessage({type:'studio:editor-ready'});});
}
