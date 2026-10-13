import { moduleShortcuts, search } from '../../core/search/search';
import type { ModuleMetadata } from '../../core/module/types';
import type { SearchIndex, SearchResult } from '../../core/search/types';
import { withBase } from '../../core/module/urls';

const dialog = document.querySelector<HTMLDialogElement>('[data-spotlight]');
if (dialog) {
  const input = dialog.querySelector<HTMLInputElement>('#space-query')!;
  const list = dialog.querySelector<HTMLElement>('#space-results')!;
  const status = dialog.querySelector<HTMLElement>('[data-search-status]')!;
  const caption = dialog.querySelector<HTMLElement>('[data-search-caption]')!;
  const closeButton = dialog.querySelector<HTMLButtonElement>('[data-search-close]')!;
  const retry = dialog.querySelector<HTMLButtonElement>('[data-search-retry]')!;
  const metadata: ModuleMetadata[] = JSON.parse(document.querySelector('[data-spotlight-modules]')!.textContent!);
  const moduleMap = new Map(metadata.map((module) => [module.id, module]));
  let index: SearchIndex | null = null;
  let request: Promise<void> | null = null;
  let loading = false;
  let failed = false;
  let selected = 0;
  let results: SearchResult[] = [];
  let composing = false;
  let trigger: Element | null = null;
  let pointerStartedOutside = false;
  let closeTimer: number | undefined;

  function select(next: number, scroll = false) {
    selected = Math.max(0, Math.min(next, results.length - 1));
    list.querySelectorAll<HTMLElement>('[role="option"]').forEach((option, position) => {
      option.setAttribute('aria-selected', String(position === selected));
      if (position === selected && scroll) option.scrollIntoView({ block: 'nearest' });
    });
    if (results.length) input.setAttribute('aria-activedescendant', `space-option-${selected}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function render(reset = true) {
    const query = input.value.trim();
    const fallback: SearchIndex = { modules: metadata.map((module) => ({ ...module, count: 0 })), results: [] };
    results = query ? search(query, index ?? fallback) : moduleShortcuts(metadata);
    list.replaceChildren();
    list.classList.toggle('shortcuts', !query);
    caption.textContent = query ? 'Search results' : 'Explore a direction';
    for (const [position, result] of results.entries()) {
      const option = document.createElement('a');
      option.href = withBase(result.url, dialog!.dataset.base);
      option.id = `space-option-${position}`;
      option.setAttribute('role', 'option');
      option.tabIndex = -1;
      const module = moduleMap.get(result.module)!;
      if (!query) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('class', 'shortcut-icon');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.3');
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', module.icon);
        svg.append(path);
        option.append(svg);
      } else {
        const label = document.createElement('span');
        label.className = 'result-module';
        label.textContent = module.name;
        option.append(label);
      }
      const title = document.createElement('span');
      title.className = 'result-title';
      title.textContent = result.title;
      option.append(title);
      if (query) {
        const description = document.createElement('span');
        description.className = 'result-description';
        description.textContent = result.description;
        option.append(description);
      }
      option.addEventListener('pointermove', (event) => {
        if (event.movementX || event.movementY) select(position);
      });
      option.addEventListener('mousedown', (event) => event.preventDefault());
      list.append(option);
    }
    select(reset ? 0 : selected);
    status.textContent = failed ? 'Search could not load. Module shortcuts are still available.' : loading ? 'Loading search…' : query ? `${results.length ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'No results. Try another thought.'}` : '';
    retry.hidden = !failed;
    list.setAttribute('aria-busy', String(loading));
  }

  async function load() {
    if (index || request) return request;
    failed = false;
    loading = true;
    render(false);
    request = (async () => {
      try {
        const response = await fetch(dialog!.dataset.indexUrl!, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Index request failed');
        const data = await response.json();
        if (!data || !Array.isArray(data.modules) || !Array.isArray(data.results)) throw new Error('Invalid search index');
        for (const entry of data.results) {
          const module = moduleMap.get(entry?.module);
          if (!module || typeof entry.title !== 'string' || typeof entry.description !== 'string' || typeof entry.url !== 'string' || !entry.url.startsWith(module.route)) throw new Error('Invalid search result');
          withBase(entry.url);
        }
        index = { modules: metadata.map((module) => ({ ...module, count: 0 })), results: data.results };
      } catch {
        failed = true;
      } finally {
        loading = false;
        request = null;
        render(input.value.trim().length > 0);
      }
    })();
    return request;
  }

  function finishClose() {
    window.clearTimeout(closeTimer);
    closeTimer = undefined;
    dialog!.removeAttribute('data-closing');
    dialog!.close();
    restoreAfterClose();
  }
  function updateOrigin(source: Element | null = trigger) {
    const sourceBounds = source?.getBoundingClientRect();
    const buttonBounds = document.querySelector('[data-search-trigger]')!.getBoundingClientRect();
    const origin = sourceBounds?.width ? sourceBounds : buttonBounds;
    // Layout offsets ignore the running transform, including after viewport changes.
    dialog!.style.setProperty('--from-x', `${origin.left + origin.width / 2 - (dialog!.offsetLeft + dialog!.offsetWidth / 2)}px`);
    dialog!.style.setProperty('--from-y', `${origin.top + origin.height / 2 - (dialog!.offsetTop + dialog!.offsetHeight / 2)}px`);
  }
  function close() {
    if (!dialog!.open || dialog!.hasAttribute('data-closing')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finishClose(); return; }
    const current = getComputedStyle(dialog!);
    dialog!.style.setProperty('--close-transform', current.transform);
    dialog!.style.setProperty('--close-opacity', current.opacity);
    dialog!.style.setProperty('--close-backdrop-opacity', getComputedStyle(dialog!, '::backdrop').opacity);
    updateOrigin();
    dialog!.setAttribute('data-closing', '');
    if (getComputedStyle(dialog!).animationName === 'none') finishClose();
    else closeTimer = window.setTimeout(finishClose, 320);
  }
  dialog.addEventListener('animationend', (event) => {
    if (event.target === dialog && event.animationName === 'spotlight-collapse') finishClose();
  });
  function open(source: Element | null) {
    if (dialog!.open) {
      if (dialog!.hasAttribute('data-closing')) {
        const current = getComputedStyle(dialog!);
        dialog!.style.setProperty('--open-transform', current.transform);
        dialog!.style.setProperty('--open-opacity', current.opacity);
        dialog!.style.setProperty('--open-backdrop-opacity', getComputedStyle(dialog!, '::backdrop').opacity);
        window.clearTimeout(closeTimer);
        closeTimer = undefined;
        dialog!.style.animation = 'none';
        dialog!.removeAttribute('data-closing');
        void dialog!.offsetWidth;
        dialog!.style.removeProperty('animation');
      }
      input.focus(); return;
    }
    dialog!.style.removeProperty('--open-transform');
    dialog!.style.removeProperty('--open-opacity');
    dialog!.style.removeProperty('--open-backdrop-opacity');
    trigger = source;
    input.value = '';
    composing = false;
    render();
    dialog!.style.animation = 'none';
    dialog!.showModal();
    updateOrigin(source);
    dialog!.style.removeProperty('animation');
    input.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('search-open');
    input.focus({ preventScroll: true });
    void load();
  }
  document.querySelectorAll('[data-search-trigger]').forEach((button) => button.addEventListener('click', () => open(button)));
  document.addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k' || event.isComposing) return;
    const target = event.target;
    if (!dialog!.open && target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    event.preventDefault();
    open(document.activeElement);
  });
  input.addEventListener('input', () => render());
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; render(); });
  input.addEventListener('keydown', (event) => {
    if (dialog!.hasAttribute('data-closing')) return;
    if (composing || event.isComposing || event.key === 'Process') return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      select(selected + (event.key === 'ArrowDown' ? 1 : -1), true);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (results[selected]) window.location.assign(withBase(results[selected].url, dialog!.dataset.base));
    }
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [input, closeButton, ...(!retry.hidden ? [retry] : [])];
    const position = focusable.indexOf(document.activeElement as HTMLInputElement);
    if (event.shiftKey && position <= 0) { event.preventDefault(); focusable.at(-1)!.focus(); }
    if (!event.shiftKey && position === focusable.length - 1) { event.preventDefault(); input.focus(); }
  });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  function restoreAfterClose() {
    // Native close events are queued; an old event must not reset a newly opened dialog.
    if (dialog!.open) return;
    window.clearTimeout(closeTimer);
    closeTimer = undefined;
    dialog!.removeAttribute('data-closing');
    pointerStartedOutside = false;
    input.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('search-open');
    if (trigger instanceof HTMLElement || trigger instanceof SVGElement) trigger.focus({ preventScroll: true });
  }
  dialog.addEventListener('close', restoreAfterClose);
  const outside = (event: PointerEvent | MouseEvent) => {
    const bounds = dialog!.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  dialog.addEventListener('pointerdown', (event) => { pointerStartedOutside = outside(event); });
  dialog.addEventListener('click', (event) => { if (pointerStartedOutside && outside(event)) close(); });
  closeButton.addEventListener('click', close);
  retry.addEventListener('click', () => { void load(); input.focus(); });
}
