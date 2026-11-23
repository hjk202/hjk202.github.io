import type {ExitEditor} from './desktop.ts';
import type {ProposalView,ProposalTarget,ThinkCandidate,BuildCandidate} from '../contracts/proposal.ts';
import {INTAKE_MAX_MATERIAL} from '../contracts/proposal.ts';
import type {ThinkSummary} from '../contracts/think.ts';
import {ApiError,createThinkApi} from './api.ts';
import type {Project,ProjectCollection} from '../contracts/build.ts';
import {projectFields} from './project-fields.ts';
import {authoringRequest} from './authoring-request.ts';
import {AI_TIMEOUT_MS} from '../contracts/ai.ts';

/** Public review client only. Files are selected as bounded UTF-8 data, never backend paths. */
export function installIntake(token:string):ExitEditor&{root:HTMLElement;open():Promise<void>} {
  const root=document.createElement('section');root.id='intake-editor';root.hidden=true;
  root.innerHTML=`<div class="intake-grid"><aside><h2>待审核</h2><ul id="intake-list"></ul><button id="intake-new" type="button">导入新材料</button><details><summary>待审列表</summary><button id="intake-refresh" type="button">刷新待审箱</button></details></aside><div>
  <fieldset id="intake-input"><legend>录入材料</legend><div class="toolbar"><label>内容类型<select id="intake-module"><option value="think">Think 文章</option><option value="build">Build 项目</option></select></label><label>目标<select id="intake-target"><option value="">新建文章草稿</option></select></label></div>
  <label>拟公开材料<textarea id="intake-material" rows="10" spellcheck="false"></textarea></label>
  <details id="intake-options"><summary>导入设置与文件</summary><label>材料格式<select id="intake-format"><option value="markdown">Markdown</option><option value="text">纯文字</option><option value="report">Personal Space 结构化报告 v1</option></select></label>
  <label>选择 UTF-8 Markdown / 文字文件（最多 64 KiB）<input type="file" id="intake-file" accept=".md,.txt,.json"></label>
  </details>
  <div class="toolbar"><button id="intake-create" class="primary-action" type="button">开始审核</button></div>
  <details id="intake-ai"><summary>用 AI 整理</summary><p class="hint">仅发送当前拟公开材料。Build 继续使用百炼。输入和输出各限 32 KiB，可能计费。</p><p id="intake-ai-status" role="status"></p><div class="toolbar"><button id="intake-organize" type="button" disabled>发送并整理</button><button id="intake-cancel-organize" type="button" hidden>取消自动整理</button></div></details></fieldset>
  <section id="intake-review" hidden><h2>审核候选</h2><details><summary>原材料与字段来源</summary><p id="intake-version"></p><pre id="intake-original"></pre><pre id="intake-evidence"></pre></details>
  <fieldset id="intake-fields"><legend>精调文章候选</legend><label>Slug<input id="intake-slug"></label><label>标题<input id="intake-title"></label><label>摘要<textarea id="intake-summary"></textarea></label><label>日期 YYYY-MM-DD<input id="intake-date"></label><label>类型<select id="intake-kind"><option value="">省略（article）</option><option value="article">文章</option><option value="note">随记</option></select></label><label>Markdown 正文<textarea id="intake-body" rows="16" spellcheck="false"></textarea></label></fieldset>
  <fieldset id="intake-project" hidden><legend>精调项目候选（与手动项目表单共用原模型）</legend><label>项目 slug<input id="intake-project-slug"></label><label>项目标题<input id="intake-project-title"></label><label>项目摘要<textarea id="intake-project-summary"></textarea></label><label>记录周期<input id="intake-project-period"></label><label>项目状态<select id="intake-project-status"><option value="">省略 / 待确认</option><option value="in-progress">进行中</option><option value="completed">已完成</option><option value="paused">暂停</option></select></label><div id="intake-project-keywords"></div><div id="intake-project-links"></div><div id="intake-project-sections"></div><div id="intake-project-milestones"></div><div id="intake-project-updates"></div><div id="intake-project-issues"></div></fieldset>
  <ul id="intake-diagnostics"></ul><p class="hint">新建固定 draft；已有文章修订保留原 published。审核不自动提交或上线。</p>
  <div class="toolbar"><button id="intake-save" type="button">保存待审候选</button><button id="intake-preview" type="button">预览候选</button><button id="intake-cancel" type="button" hidden>取消预览</button><button id="intake-apply" class="primary-action" type="button">批准并保存草稿 / 修订</button><button id="intake-publish" type="button">审核并发布到网站…</button><details id="intake-actions" class="control-menu"><summary>更多</summary><div class="control-menu-content"><button id="intake-discard" class="danger-action" type="button">丢弃本条</button></div></details></div><div id="intake-preview-frame"></div></section>
  <p id="intake-message" role="status"></p></div></div>`;
  document.getElementById('studio-content')!.append(root);
  const get=<T extends HTMLElement>(name:string)=>root.querySelector<T>('#intake-'+name)!;
  let current:ProposalView|undefined,baseline='',busy=false,composing=false,closing=false,blocked=false,epoch=0,sourceRows:ThinkSummary[]=[],project:BuildCandidate={};
  let controller:AbortController|undefined;
  let activeAi:AbortController|undefined,organizing=false,aiAvailable=false,aiTimer:ReturnType<typeof setTimeout>|undefined;
  const api=createThinkApi(token),snapshot=()=>get<HTMLTextAreaElement>('material').value;
  const draft=():ThinkCandidate=>{
    const metadata:ThinkCandidate['metadata']={...(current&&current.state!=='applied'&&current.module==='think'?current.candidate.metadata:{})};
    for(const name of ['slug','title','summary','date','kind'] as const){const value=get<HTMLInputElement>(name).value;if(value==='')delete metadata[name];else Object.assign(metadata,{[name]:value});}
    return{metadata,body:get<HTMLTextAreaElement>('body').value};
  };
  const module=()=>get<HTMLSelectElement>('module').value as 'think'|'build';
  const candidate=()=>current?.module==='build'?project:draft();
  const fingerprint=()=>JSON.stringify([snapshot(),current?.state!=='applied'&&current?candidate():null,snapshot().trim()||current?get<HTMLSelectElement>('target').value:null,snapshot().trim()||current?module():null]);
  const dirty=()=>fingerprint()!==baseline;
  const say=(text:string)=>{get('message').textContent=text;};
  const request=async<T>(method:string,path:string,body?:unknown,signal?:AbortSignal):Promise<T>=>{
    let response:Response;try{response=await fetch('/api/authoring/v1/'+path,{method,cache:'no-store',credentials:'omit',redirect:'error',headers:{'X-Studio-Token':token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.any([AbortSignal.timeout(path.endsWith('/organize')?AI_TIMEOUT_MS+10000:25000),...(signal?[signal]:[])])});}catch{throw new ApiError('CONNECTION_LOST');}
    const value=await response.json();if(!value?.ok)throw new ApiError(value?.error?.code??'INVALID_RESPONSE');return value.value as T;
  };
  const render=()=>{for(const name of ['input','fields','project'])get<HTMLFieldSetElement>(name).disabled=busy||closing;for(const name of ['create','new','refresh','save','apply','discard','preview'])get<HTMLButtonElement>(name).disabled=busy||composing||closing;
    get<HTMLButtonElement>('apply').disabled ||= !current?.canApply||dirty()||blocked;
    get<HTMLButtonElement>('publish').disabled=busy||closing||composing||blocked||!current||current.state==='applying'||current.state!=='applied'&&dirty();get('publish').textContent=current?.state==='applied'?'从已保存源码准备发布…':'审核并发布到网站…';
    get<HTMLButtonElement>('organize').disabled=closing||busy||organizing||composing||!aiAvailable||!snapshot().trim();
    get('cancel-organize').hidden=!organizing;
    get('cancel').hidden=!controller||controller.signal.aborted;
    get('input').hidden=!!current;
    get('review').hidden=!current;get('fields').hidden=current?.state==='applied'||current?.module==='build';get('project').hidden=current?.state==='applied'||current?.module!=='build';for(const name of ['save','preview','apply'])get(name).hidden=current?.state==='applied';
  };
  const invalidate=()=>{epoch++;controller?.abort();activeAi?.abort();get('preview-frame').replaceChildren();render();};
  function show(p:ProposalView){current=p;blocked=p.state==='applying';get('version').textContent=`${p.module} · ${p.state} · 提案 ${p.revision.slice(0,12)} · 候选 ${p.candidateHash.slice(0,12)}${p.state==='applied'?'':p.target.mode==='create'?' · 新建草稿':` · 更新 ${p.target.key.slice(0,12)}，源 ${p.target.expectedSourceRevision.slice(0,12)}`}`;get('diagnostics').replaceChildren(...p.diagnostics.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
    get<HTMLSelectElement>('module').value=p.module;
    if(p.state!=='applied'){get('original').textContent=p.material;get('evidence').textContent=JSON.stringify(p.evidence,null,2);get<HTMLTextAreaElement>('material').value='';
      if(p.module==='think'){for(const name of ['slug','title','summary','date','kind'] as const)get<HTMLInputElement>(name).value=p.candidate.metadata[name]??'';get<HTMLTextAreaElement>('body').value=p.candidate.body??'';}
      else{project=structuredClone(p.candidate);for(const name of ['slug','title','summary','period','status'] as const)get<HTMLInputElement>('project-'+name).value=project[name]??'';projectFields(root,project as Project,invalidate,'intake-project');}}
    else{get('original').textContent='原材料及候选已清除；后续请从真实内容库读取。';get('evidence').textContent=`源 revision: ${p.sourceRevision}`;for(const node of root.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('#intake-fields input,#intake-fields textarea,#intake-fields select,#intake-project input,#intake-project textarea,#intake-project select'))node.value='';for(const name of ['keywords','links','sections','milestones','updates','issues'])get('project-'+name).replaceChildren();project={};}
    baseline=fingerprint();invalidate();render();
  }
  async function list(){const values=await request<{id:string;module:string;state:string}[]>('GET','proposals');get('list').replaceChildren(...values.map(item=>{const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=`${item.module} · ${item.state} · ${item.id.slice(0,8)}`;b.onclick=()=>{if(dirty()&&!confirm('放弃未保存的材料或候选修改？'))return;void action(async()=>show(await request<ProposalView>('GET','proposals/'+item.id)));};li.append(b);return li;}));}
  async function action(work:()=>Promise<void>,mutation=false,allowClosing=false){if(busy||closing&&!allowClosing||composing)return;invalidate();busy=true;render();try{await work();}catch(e){const code=e instanceof ApiError?e.code:'INVALID_RESPONSE';if(mutation||['REVISION_CONFLICT','NOT_FOUND'].includes(code))blocked=true;say(`${code}：缓冲保留，请刷新/重新读取核对，不自动重试应用。`);}finally{busy=false;render();}}
  const target=():ProposalTarget=>{const key=get<HTMLSelectElement>('target').value;if(!key)return{mode:'create'};const row=sourceRows.find(row=>row.key===key);if(!row?.revision)throw new ApiError('REVISION_CONFLICT');return{mode:'update',key,expectedSourceRevision:row.revision};};
  async function save(){await action(async()=>{
    if(!current&&snapshot().trim()){show(await request<ProposalView>('POST','intake/'+module(),{material:snapshot(),format:get<HTMLSelectElement>('format').value,target:target()}));await list();say('材料已保存为待审候选；源文件未改。');return;}
    if(!current||current.state!=='pending'||snapshot().trim())return;const p=await request<ProposalView>('PUT','proposals/'+current.id,{expectedProposalRevision:current.revision,candidate:candidate(),target:current.target});show(p);say('候选已保存到本机待审箱；源文件未改。');},true,true);}
  root.addEventListener('compositionstart',()=>{composing=true;render();});root.addEventListener('compositionend',()=>{composing=false;render();});
  root.addEventListener('input',invalidate);get('target').addEventListener('change',invalidate);
  get('new').onclick=()=>{if(dirty()&&!confirm('放弃未保存的候选修改？'))return;current=undefined;get<HTMLTextAreaElement>('material').value='';baseline=fingerprint();invalidate();void action(loadTargets);};
  get('file').addEventListener('change',()=>{void action(async()=>{const file=get<HTMLInputElement>('file').files?.[0];if(!file)return;if(file.size>INTAKE_MAX_MATERIAL)throw new ApiError('PAYLOAD_TOO_LARGE');const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());get<HTMLTextAreaElement>('material').value=text;invalidate();say('文件仅载入本页，未发送到 AI；请核对材料。');});});
  get('create').onclick=()=>{if(current&&dirty()&&!confirm('新材料会替换当前审核视图。放弃本页未保存的候选修改并继续？'))return;void action(async()=>{const p=await request<ProposalView>('POST','intake/'+module(),{material:snapshot(),format:get<HTMLSelectElement>('format').value,target:target()});show(p);await list();say('已生成待审候选；请核对字段与事实。');},true);};
  get('organize').onclick=()=>{void(async()=>{
    if(busy||organizing||closing||composing||!aiAvailable||!snapshot().trim())return;
    if(current&&dirty()&&!confirm('自动整理将生成新的待审候选；放弃当前未保存的候选修改并继续？'))return;
    invalidate();const version=epoch,abort=new AbortController();activeAi=abort;organizing=true;render();say('正在自动整理选中材料；可以编辑材料或取消，原源文件未改。');
    try{const p=await request<ProposalView>('POST','intake/'+module()+'/organize',{material:snapshot(),target:target()},abort.signal);if(version!==epoch||abort.signal.aborted)return;activeAi=undefined;organizing=false;show(p);await list();say('AI 已填入新的待审候选；请核对原材料、逐字段来源与待确认项，再保存或发布。');}
    catch(e){if(version===epoch&&!abort.signal.aborted)say(`自动整理未完成（${e instanceof ApiError?e.code:'INVALID_RESPONSE'}）；原材料保留，无自动重试。`);}
    finally{if(activeAi===abort)activeAi=undefined;organizing=false;render();}
  })();};
  get('cancel-organize').onclick=()=>{invalidate();say('已取消自动整理；原材料保留，已送达上游的调用仍可能计费。');};
  get('refresh').onclick=()=>{void action(list);};get('save').onclick=()=>{void save();};
  get('discard').onclick=()=>{if(!current||!confirm('确认永久丢弃这条本机提案/回执？不会删除网站源文件。'))return;void action(async()=>{await request('DELETE','proposals/'+current!.id,{expectedProposalRevision:current!.revision});current=undefined;baseline=fingerprint();invalidate();await list();say('本条已丢弃。');},true);};
  get('apply').onclick=()=>{if(!current||dirty()||!current.canApply||!confirm('我已核对原材料、字段及个人事实。批准这份精确候选保存到本地源码？新建为草稿，修订保留原公开状态，不提交或上线。'))return;const p=current;void action(async()=>{show(await request<ProposalView>('POST','proposals/'+p.id+'/apply',{expectedProposalRevision:p.revision,candidateHash:p.candidateHash,target:p.state!=='applied'?p.target:{mode:'create'},factsConfirmed:true}));await list();say('已保存到真正内容源；未提交或部署。后续从内容库继续编辑。');},true);};
  get('publish').onclick=()=>{if(!current||current.state==='applying'||dirty()||busy||closing)return;if(current.state==='applied')window.dispatchEvent(new CustomEvent('studio:publish-source',{detail:{module:current.module,key:current.key,expectedSourceRevision:current.sourceRevision}}));else window.dispatchEvent(new CustomEvent('studio:publish-proposal',{detail:{proposalId:current.id,expectedProposalRevision:current.revision}}));};
  window.addEventListener('studio:publication-saved',event=>{const id=(event as CustomEvent<{proposalId:string}>).detail?.proposalId;if(!current||current.id!==id||current.state==='applied')return;if(dirty()){blocked=true;say('这份已批准提案已保存到真实源；本页另有未保存修改，缓冲保留。先复制需要内容并从真实源核对，不能覆盖已应用提案。');render();}else void action(async()=>{show(await request<ProposalView>('GET','proposals/'+id));await list();say('发布流程已保存这份候选；待审正文已清除，后续从真实源继续编辑。');});});
  get('preview').onclick=()=>{if(!current||current.state==='applied'||busy)return;invalidate();const version=epoch,abort=new AbortController();controller=abort;render();const p=current;
    const promise=p.module==='think'?api.preview(draft() as Parameters<typeof api.preview>[0],p.target.mode==='update'?p.target.key:undefined,abort.signal):authoringRequest(token,'build')<{html:string}>('POST','preview',{project:structuredClone(project),...(p.target.mode==='update'?{key:p.target.key}:{})},abort.signal);
    void promise.then(result=>{if(version!==epoch||abort.signal.aborted)return;const frame=document.createElement('iframe');frame.title='录入候选隔离预览';frame.setAttribute('sandbox','');frame.referrerPolicy='no-referrer';frame.srcdoc=result.html;get('preview-frame').replaceChildren(frame);say('候选预览完成，尚未应用。');}).catch(e=>{if(!abort.signal.aborted)say(`预览未完成：${e instanceof ApiError?e.code:'INVALID_RESPONSE'}`);}).finally(()=>{if(controller===abort){controller=undefined;render();}});};get('cancel').onclick=invalidate;
  async function loadTargets(){
    if(module()==='think')sourceRows=await api.list('all');else{const rows=await authoringRequest(token,'build')<ProjectCollection>('GET','documents');sourceRows=rows.entries.map(p=>({key:p.slug,fileName:'data.ts',revision:rows.revision,title:p.title,editable:true,deletable:true,issues:[]}));}
    const selected=get<HTMLSelectElement>('target').value;get('target').replaceChildren(...[{key:'',title:module()==='think'?'新建文章草稿':'新建项目草稿'},...sourceRows.filter(row=>row.editable)].map(row=>{const o=document.createElement('option');o.value=row.key;o.textContent=row.title??row.key;return o;}));get<HTMLSelectElement>('target').value=selected;
  }
  get('module').addEventListener('change',()=>{if(current&&dirty()&&!confirm('放弃未保存的候选修改并切换类型？')){get<HTMLSelectElement>('module').value=current.module;return;}current=undefined;invalidate();void action(loadTargets);void loadAi();});
  for(const name of ['slug','title','summary','period','status'] as const)get('project-'+name).addEventListener('input',()=>{const value=get<HTMLInputElement>('project-'+name).value;if(!value)delete project[name];else Object.assign(project,{[name]:value});invalidate();});
  async function loadAi(){try{const status=await api.aiStatus();aiAvailable=module()==='build'?(status.bailianAvailable??status.available):status.available;get('ai-status').textContent=`${module()==='build'?'阿里云百炼':status.service} · ${aiAvailable?'已配置，自动整理需显式点击':status.issue}`;if(status.issue==='AI_INITIALIZING')aiTimer=setTimeout(()=>{void loadAi();},500);}catch{get('ai-status').textContent='AI 状态暂不可读；可继续确定性导入。';}render();}
  window.addEventListener('pagehide',()=>{clearTimeout(aiTimer);invalidate();},{once:true});
  baseline=fingerprint();render();void loadAi();
  return{root,dirty,unsettled:()=>busy||composing,uncertain:()=>blocked,canSave:()=>!dirty()||!busy&&!blocked&&!composing&&(!current?!!snapshot().trim():current.state==='pending'&&!snapshot().trim()),save,closing:value=>{closing=value;render();},finish:invalidate,resume:()=>{},open:async()=>{root.hidden=false;await action(async()=>{await list();await loadTargets();});}};
}
