import type { PrivateBookmark } from '../private/keep.ts';
import { textField, stringArray } from './form-fields.ts';
export function privateKeepFields(root:HTMLElement, entry:PrivateBookmark, changed:()=>void) {
  for (const [key,label,multiline] of [['title','私人收藏标题',false],['description','私人收藏说明',true],['sourceUrl','私人来源链接',false]] as const) textField(root,label,entry[key],value=>{entry[key]=value;changed();},multiline);
  textField(root,'私人收藏类型（可选）',entry.kind??'',value=>{if(value==='')delete entry.kind;else entry.kind=value;changed();});
  const category=document.createElement('fieldset'),legend=document.createElement('legend'),toggle=document.createElement('button');legend.textContent='私人分类';category.append(legend);toggle.type='button';root.append(category,toggle);
  const render=()=>{
    category.replaceChildren(legend);toggle.textContent=entry.category?'移除私人分类':'添加私人分类';
    if(entry.category){textField(category,'私人分类 ID（32位）',entry.category.id,value=>{entry.category!.id=value;changed();});textField(category,'私人分类名称',entry.category.label,value=>{entry.category!.label=value;changed();});}
  };
  toggle.addEventListener('click',()=>{if(entry.category)delete entry.category;else entry.category={id:crypto.randomUUID().replaceAll('-',''),label:''};changed();render();});render();
  const notes=document.createElement('div');root.append(notes);stringArray(notes,entry.note,'私人说明段落',changed);
}
