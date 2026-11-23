import type { ExitEditor } from './desktop.ts';
import { arrangeWorkbench } from './workbench.ts';

/** Defer existing panel construction. Unopened modules own no buffers, password dialogs or listeners. */
export function lazyEditor<T extends ExitEditor & {root:HTMLElement;open?():void|Promise<void>;leave?():boolean}>(create: () => T) {
  const placeholder=document.createElement('section');placeholder.hidden=true;
  let editor: ReturnType<typeof create> | undefined;
  const initialize=()=>{if(!editor){editor=create();arrangeWorkbench([editor]);}return editor;};
  return {
    initialize,
    get root(){return editor?.root??placeholder;},
    open:()=>initialize().open?.(),leave:()=>editor?.leave?.()??true,
    dirty:()=>editor?.dirty()??false,unsettled:()=>editor?.unsettled()??false,uncertain:()=>editor?.uncertain()??false,
    canSave:()=>editor?.canSave()??true,save:async()=>{await editor?.save();},
    closing:(value:boolean)=>editor?.closing(value),finish:()=>editor?.finish(),resume:()=>editor?.resume(),
  };
}
