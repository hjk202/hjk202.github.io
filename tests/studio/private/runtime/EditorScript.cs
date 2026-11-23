internal static class EditorScript
{
    internal const string Value = """
globalThis.__probeResult=null;
let memoryStage=0;
(async()=>{
 const wait=async predicate=>{for(let count=0;count<300;count++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,30));}throw new Error('PROBE_TIMEOUT')};
 const get=id=>document.getElementById('private-'+id);
 const marker=String.fromCharCode(83,84,85,68,73,79,95,77,49,50,95,86,79,76,65,84,73,76,69,95,67,65,78,65,82,89,95,55,50,57,49,51,55,95)+crypto.randomUUID();
 const password=marker+crypto.randomUUID();
 memoryStage=1;document.getElementById('module-私人').click();get('create').click();await wait(()=>!get('tools').hidden&&!get('tools').disabled);
 get('new').click();
 const field=(label,value)=>{const row=[...get('form').querySelectorAll('label')].find(row=>row.firstChild.textContent===label);const input=row.querySelector('input,textarea');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
 const button=text=>[...get('form').querySelectorAll('button')].find(button=>button.textContent===text);
 field('私人标题',marker);field('私人摘要','non-sensitive');field('私人正文',marker);
 memoryStage=2;get('preview').click();await wait(()=>get('preview-content').textContent.includes(marker)&&!get('tools').disabled);
 get('module-keep').click();get('new').click();field('私人收藏标题',marker);field('私人收藏说明',marker);field('私人来源链接','https://example.com/'+marker);field('私人说明段落 1',marker);get('preview').click();await wait(()=>get('preview-content').textContent.includes(marker)&&!get('tools').disabled);
 get('module-me').click();get('new').click();button('添加私人介绍段落').click();field('私人介绍段落 1',marker);get('preview').click();await wait(()=>get('preview-content').textContent.includes(marker)&&!get('tools').disabled);
 get('module-build').click();get('new').click();field('私人项目标题',marker);field('私人项目摘要','non-sensitive');field('内容段落 1',marker);field('代码（可选，保留换行）',marker);get('preview').click();await wait(()=>get('preview-content').textContent.includes(marker)&&!get('tools').disabled);
 memoryStage=3;get('save').click();await wait(()=>get('password-dialog').open);get('password').value=password;get('password-confirm').value=password;get('password-dialog').querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));
 await wait(()=>get('state').textContent.includes('资料库已保存')&&!get('tools').disabled);get('lock').click();
 memoryStage=4;get('unlock').click();await wait(()=>get('password-dialog').open);get('password').value=password;get('password-dialog').querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));
 await wait(()=>!get('tools').hidden&&!get('tools').disabled);
 let recovered=true;for(const module of ['think','keep','me','build']){get('module-'+module).click();get('list').querySelector('button').click();recovered&&=[...get('form').querySelectorAll('input,textarea')].some(input=>input.value===marker);}
 if(globalThis.__deliveryProbe){
   memoryStage=6;get('prepare').click();get('select-export').click();await wait(()=>get('password-dialog').open);get('password').value=password;get('password-dialog').querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));await wait(()=>!get('export').disabled);get('export').click();await wait(()=>get('password-dialog').open);get('password').value=password;get('password-confirm').value=password;get('password-dialog').querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));await wait(()=>get('delivery-message').textContent.includes('网站更新文件已生成')&&!get('deliver').disabled);
   globalThis.confirm=()=>true;get('deliver').click();await wait(()=>get('delivery-message').textContent.includes('本地网站已更新')&&!get('tools').disabled);
 }
 get('lock').click();
 memoryStage=5;const clear=get('form').childNodes.length===0&&get('preview-content').childNodes.length===0&&get('password').value===''&&get('password-confirm').value==='';
 const frame=document.createElement('iframe');frame.sandbox='allow-scripts';frame.src='about:blank';document.body.append(frame);await new Promise(resolve=>setTimeout(resolve,100));
 globalThis.__probeResult={ok:recovered&&clear,storesEmpty:localStorage.length===0&&sessionStorage.length===0};
})().catch(()=>{globalThis.__probeResult={ok:false,storesEmpty:false,memoryStage};});
""";
}
