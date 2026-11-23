import { Annotation, Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, isolateHistory } from '@codemirror/commands';
import { codeFolding, defaultHighlightStyle, foldEffect, syntaxHighlighting } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { searchKeymap } from '@codemirror/search';

const supplied = Annotation.define<string>();
const normalize = (text: string) => text.replace(/\r\n?/g, '\n');

export function writingBuffer(parent: HTMLElement, change: (activity: boolean) => void, images?: (files: File[])=>void) {
  const lock = new Compartment();
  let raw = '', opened = '', beforeReplace: string | undefined, locked = false;
  const editing = (readOnly: boolean) => [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];
  const receive = (event: ClipboardEvent | DragEvent) => {
    const transfer = 'clipboardData' in event ? event.clipboardData : event.dataTransfer;
    const files = [...(transfer?.files??[])];
    if(!files.length || !images || locked)return false;
    event.preventDefault(); images(files); return true;
  };
  const state = (text: string) => EditorState.create({ doc: text, extensions: [
    lock.of(editing(locked)), markdown({ base: markdownLanguage }), history(), EditorView.lineWrapping,
    syntaxHighlighting(defaultHighlightStyle),
    placeholder('在这里写下你的想法…'),
    codeFolding({ placeholderDOM: (_view, unfold) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'writing-fold'; button.textContent = '文章信息';
      button.addEventListener('click', unfold);
      return button;
    } }),
    EditorView.domEventHandlers({paste:receive,drop(event, view){
      if(event.dataTransfer?.files.length&&!locked){
        const offset=view.posAtCoords({x:event.clientX,y:event.clientY});
        if(offset!==null)view.dispatch({selection:{anchor:offset}});
      }
      return receive(event);
    }}),
    keymap.of([{key:'Mod-Alt-c',run(view){
      if(view.state.readOnly||view.composing)return false;
      const {from,to}=view.state.selection.main, doc=view.state.doc, selected=doc.sliceString(from,to);
      const opening=doc.lineAt(from).from===from?'':'\n';
      const closing=doc.lineAt(to).to===to?'':'\n';
      const tick='\x60';
      const fence=tick.repeat(Math.max(3,...[...selected.matchAll(/`+/g)].map(match=>match[0].length+1)));
      const text=opening+fence+'\n'+selected+'\n'+fence+closing;
      const anchor=from+opening.length+fence.length;
      view.dispatch({changes:{from,to,insert:text},selection:{anchor},annotations:isolateHistory.of('full'),scrollIntoView:true});
      return true;
    }}, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    EditorView.contentAttributes.of({ 'aria-label': 'Markdown 编辑器', spellcheck: 'false' }),
    EditorView.updateListener.of(update => {
      for (const transaction of update.transactions) {
        if (!transaction.docChanged) continue;
        const exact = transaction.annotation(supplied);
        const text = transaction.newDoc.toString();
        if (exact !== undefined) { raw = exact; continue; }
        if (normalize(opened) === text) { raw = opened; continue; }
        if (beforeReplace !== undefined && normalize(beforeReplace) === text) { raw = beforeReplace; continue; }
        // CodeMirror indexes logical lines. Map changes back to the original bytes so
        // mixed line endings in untouched text survive an ordinary edit and save.
        const carriageReturns: number[] = [];
        for (const match of raw.matchAll(/\r\n/g)) carriageReturns.push(match.index - carriageReturns.length);
        const offset = (position: number) => {
          let start = 0, end = carriageReturns.length;
          while (start < end) {
            const middle = (start + end) >>> 1;
            if (carriageReturns[middle]! < position) start = middle + 1;
            else end = middle;
          }
          return position + start;
        };
        const newline = /\r\n|\r|\n/.exec(raw)?.[0] ?? '\n';
        const fragments: string[] = [];
        let cursor = 0;
        transaction.changes.iterChanges((from, to, _fromB, _toB, inserted) => {
          fragments.push(raw.slice(cursor, offset(from)), inserted.toString().replaceAll('\n', newline));
          cursor = offset(to);
        });
        fragments.push(raw.slice(cursor));
        raw = fragments.join('');
      }
      if (update.docChanged) change(update.transactions.some(transaction => transaction.docChanged && transaction.annotation(supplied) === undefined));
    }),
  ] });
  const view = new EditorView({ parent, state: state('') });
  return {
    text: () => raw,
    line: () => view.state.doc.lineAt(view.state.selection.main.head).number,
    scroll: () => view.scrollDOM.scrollTop,
    restoreScroll(top:number) { view.requestMeasure({read:()=>top,write:value=>{view.scrollDOM.scrollTop=value;}}); },
    insert(text:string) {
      const {from,to}=view.state.selection.main;
      view.dispatch({changes:{from,to,insert:text},selection:{anchor:from+text.length},annotations:isolateHistory.of('full'),scrollIntoView:true});
    },
    composing: () => view.composing,
    open(text: string, collapseInfo = false) {
      raw = opened = text; beforeReplace = undefined;
      const doc = normalize(text);
      view.setState(state(doc));
      const header = /^(?:\uFEFF)?---[ \t]*\n[\s\S]*?^---[ \t]*$/m.exec(doc);
      if (collapseInfo && header?.index === 0) view.dispatch({ effects: foldEffect.of({ from: 0, to: header[0].length }) });
    },
    replace(text: string) {
      beforeReplace = raw;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: normalize(text) }, annotations: [supplied.of(text), isolateHistory.of('full')] });
    },
    readonly(value: boolean) {
      if (value === locked) return;
      locked = value;
      view.dispatch({ effects: lock.reconfigure(editing(value)) });
    },
    focus: () => view.focus(),
  };
}
