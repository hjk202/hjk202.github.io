import type { ExitEditor } from './desktop.ts';

/** View composition only: move the original controls without cloning forms or changing their handlers. */
export function arrangeWorkbench(editors: (ExitEditor & { root: HTMLElement })[]) {
  const content = document.getElementById('studio-content')!;
  const button = (id: string) => document.getElementById(id);
  const group = (className: string) => { const node = document.createElement('div'); node.className = className; return node; };
  const secondary = (toolbar: HTMLElement, ids: string[]) => {
    const controls = ids.map(button).filter((node): node is HTMLElement => !!node);
    if (!controls.length) return;
    const region = group('secondary-actions'); region.setAttribute('aria-label', '次要操作');
    for (const node of controls) { if (/-delete$|-clear$|^delete$/.test(node.id)) node.classList.add('danger-action'); region.append(node); }
    toolbar.append(region);
  };
  for (const item of editors) {
    const { root } = item; content.append(root); root.classList.add('module-panel');
    // Review owns its two-column material/candidate layout rather than an existing module form.
    if(root.id==='intake-editor'||root.id==='publish-editor')continue;
    const title = root.querySelector('h2')!, description = title.nextElementSibling!;
    const heading = group('panel-heading'); title.before(heading); heading.append(title);
    if (root.id === 'private-editor') heading.append(description);
    const badge = document.createElement('output'); badge.className = 'state-badge'; badge.setAttribute('aria-live', 'polite'); heading.append(badge);
    const status = root.querySelector('[role="status"]');
    const update = () => { badge.textContent = item.unsettled() ? '操作进行中' : item.uncertain() ? '操作结果待核对' : item.dirty() ? '有未保存修改' : '当前无未保存修改'; badge.dataset.dirty = String(item.dirty()); badge.dataset.uncertain = String(item.uncertain()); };
    root.addEventListener('input', () => queueMicrotask(update)); root.addEventListener('change', () => queueMicrotask(update)); root.addEventListener('click', () => queueMicrotask(update));
    root.addEventListener('studio:editor-state', update);
    if (status) new MutationObserver(update).observe(status, { childList: true });
    update();
    if (root.id === 'private-editor') {
      const tools = button('private-tools')!, nav = button('private-module-think')!.parentElement!;
      nav.classList.add('private-module-navigation');
      const actions = group('toolbar editor-actions');
      for (const id of ['private-new', 'private-new-supplement', 'private-save', 'private-validate', 'private-preview']) { const node = button(id); if (node) actions.append(node); }
      nav.after(actions); secondary(actions, ['private-delete']);
      const layout = group('module-workspace'), list = group('collection-panel'), documentPane = group('document-pane');
      list.append(button('private-list')!); documentPane.append(button('private-form')!, button('private-preview-content')!); layout.append(list, documentPane); tools.append(layout);
      button('private-save')!.classList.add('primary-action');
      continue;
    }
    const prefix = root.id.replace('-editor', ''), layout = group('module-workspace'), documentPane = group('document-pane');
    root.append(layout);
    const list = button(prefix + '-list');
    if (list) { const collection = group('collection-panel'); collection.append(button(prefix + '-new')!.parentElement!, list); layout.append(collection); }
    else layout.classList.add('singleton-workspace');
    for (const node of [...root.children]) if (node !== heading && node !== layout) documentPane.append(node);
    layout.append(documentPane);
    const save = button(prefix + '-save')!; save.classList.add('primary-action');
    const actions = save.parentElement!; actions.classList.add('editor-actions');
    const form = button(prefix + '-form')!;
    if (form.contains(actions)) form.prepend(actions); else form.before(actions);
    const more = document.createElement('details');
    more.id = prefix + '-actions'; more.className = 'control-menu';
    const summary = document.createElement('summary'); summary.textContent = '更多';
    const menu = group('control-menu-content');
    for (const action of ['validate', 'reload', 'delete', 'clear']) {
      const control = button(prefix + '-' + action);
      if (control) {
        if (action === 'delete' || action === 'clear') control.classList.add('danger-action');
        menu.append(control);
      }
    }
    more.append(summary, menu); actions.append(more);
  }
}
