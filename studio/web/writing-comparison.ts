import { MergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/** The proposal is read-only. A single scroll container holds both aligned documents. */
export function writingComparison(parent: HTMLElement, original: string, proposed: string) {
  const pane = (id: string, label: string) => [EditorState.readOnly.of(true), EditorView.editable.of(false),
    EditorView.lineWrapping, EditorView.editorAttributes.of({ id }),
    EditorView.contentAttributes.of({ 'aria-label': label, tabindex: '0' })];
  const merge = new MergeView({ parent, highlightChanges: true, gutter: false,
    a: { doc: original, extensions: pane('writing-ai-before', '当前原文') },
    b: { doc: proposed, extensions: pane('writing-ai-after', '将应用的内容') },
  });
  const jump = (event: MouseEvent) => {
    if (!(event.target instanceof Element) || !event.target.closest('.cm-changedLine')) return;
    const view = merge.a.dom.contains(event.target) ? merge.a : merge.b;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }, false);
    const left = view === merge.a;
    const chunk = merge.chunks.find(edit => left ? edit.fromA <= pos && pos < edit.toA : edit.fromB <= pos && pos < edit.toB);
    if (!chunk) return;
    // Spacers already align the counterpart. Move the shared viewport to the start of this change.
    view.dispatch({ effects: EditorView.scrollIntoView(left ? chunk.fromA : chunk.fromB, { y: 'start', yMargin: 8 }) });
  };
  merge.dom.addEventListener('click', jump);
  return merge;
}
