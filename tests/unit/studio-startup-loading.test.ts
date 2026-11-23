import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import type { TestContext } from 'node:test';

function fixture(t: TestContext) {
  const cache = resolve('.cache/studio-m16-2'); fs.mkdirSync(cache, { recursive: true });
  const root = fs.mkdtempSync(join(cache, 'loading-'));
  for (const module of ['think/content', 'keep']) fs.mkdirSync(join(root, 'src/modules', module), { recursive: true });
  fs.writeFileSync(join(root, 'src/modules/think/content/existing.md'), '---\nslug: existing\n---\nNON_SENSITIVE_LOADING_FIXTURE\n');
  fs.writeFileSync(join(root, 'src/modules/keep/data.ts'), "import { publicBookmarks } from './bookmarks.ts';\nexport const bookmarks = publicBookmarks([]);\n");
  for (const file of ['package.json', 'astro.config.mjs', 'tsconfig.json']) fs.writeFileSync(join(root, file), '{}');
  t.after(() => { assert.ok(relative(cache, root).startsWith('loading-')); fs.rmSync(root, { recursive: true }); });
  return root;
}
const moduleUrl = (file: string) => JSON.stringify(pathToFileURL(resolve(file)).href);
async function run(code: string) {
  const env = { ...process.env };
  for (const name of Object.keys(env)) if (/^(DASHSCOPE|STUDIO_AI|OPENAI|ANTHROPIC)_/.test(name)) delete env[name];
  const reply = await promisify(execFile)(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], { env, windowsHide: true, timeout: 20_000, maxBuffer: 65536 });
  return JSON.parse(reply.stdout);
}

test('M16.2 real HTTP starts, pairs, lists Think and rejects unpaired previews without loading compilers; Keep loads AST on demand', async t => {
  const root = fixture(t);
  const reply = await run(`
    import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
    const seen={markdown:false,ast:false};registerHooks({load(url,context,next){
      if(url.includes('/@astrojs/markdown-satteri/'))seen.markdown=true;
      if(url.endsWith('/typescript/lib/typescript.js'))seen.ast=true;
      return next(url,context);
    }});
    const {startStudioHttp}=await import(${moduleUrl('studio/server/http.ts')});
    const session=await startStudioHttp({repositoryRoot:${JSON.stringify(root)},port:0});
    try{
      assert.deepEqual(seen,{markdown:false,ast:false});
      assert.equal((await fetch(session.origin)).status,200);
      assert.equal((await fetch(session.origin+'/api/authoring/v1/think/preview',{method:'POST'})).status,401);
      const headers={'X-Studio-Token':session.token};
      const think=await fetch(session.origin+'/api/authoring/v1/think/documents',{headers});assert.equal(think.status,200);assert.equal((await think.json()).value.length,1);
      assert.deepEqual(seen,{markdown:false,ast:false});
      const keep=await fetch(session.origin+'/api/authoring/v1/keep/documents',{headers});assert.equal(keep.status,200);assert.equal((await keep.json()).ok,true);
      assert.deepEqual(seen,{markdown:false,ast:true});console.log(JSON.stringify(seen));
    }finally{assert.equal((await session.close()).ok,true);}
  `);
  assert.deepEqual(reply, { markdown: false, ast: true });
});

for (const kind of ['think', 'source']) for (const action of ['cancel', 'close', 'failure']) {
  test(`M16.2 ${kind} first compiler load: ${action} preserves source and cleans staging`, async t => {
    const root = fixture(t), original = fs.readFileSync(join(root, 'src/modules/think/content/existing.md'));
    const result = await run(`
      import assert from 'node:assert/strict';import fs from 'node:fs';import {join} from 'node:path';import {registerHooks} from 'node:module';
      let entered,release;const loading=new Promise(r=>entered=r);globalThis.loadingEntered=entered;globalThis.releaseLoading=new Promise(r=>release=r);
      registerHooks({load(url,context,next){
        if(url.endsWith('/@astrojs/markdown-satteri/dist/index.js'))return {format:'module',shortCircuit:true,source:
          'globalThis.loadingEntered();await globalThis.releaseLoading;'+
          ${JSON.stringify(action === 'failure' ? "throw new Error('NON_SENSITIVE_INTERNAL_EXCEPTION');" : "export async function createSatteriMarkdownProcessor(){throw new Error('MUST_NOT_COMPILE_AFTER_CANCEL');}")}};
        return next(url,context);
      }});
      const root=${JSON.stringify(root)},kind=${JSON.stringify(kind)},action=${JSON.stringify(action)};
      const opened=(await import(${moduleUrl('studio/server/think/service.ts')})).openThinkAuthoring(root);assert.equal(opened.ok,true);const service=opened.value;
      const preview=kind==='think'?(await import(${moduleUrl('studio/server/think/preview.ts')})).createThinkPreview(service,{repositoryRoot:root})
        :(await import(${moduleUrl('studio/server/source-preview.ts')})).createSourcePreview(()=>({ok:true,value:{module:'keep',slug:'fixture',source:"import { publicBookmarks } from './bookmarks.ts';\\nexport const bookmarks = publicBookmarks([]);"}}),{repositoryRoot:root});
      try{
        const controller=new AbortController(),input={document:{metadata:{slug:'fixture',title:'Fixture',summary:'Non sensitive',date:'2026-10-30',published:false,kind:'article'},body:'Non sensitive'}};
        const pending=kind==='think'?preview.previewThink(input,controller.signal):preview.preview({},controller.signal);
        await loading;
        let stopped;if(action==='close')stopped=preview.close();else if(action==='cancel')controller.abort();
        release();const value=await pending;await stopped;
        assert.equal(value.ok,false);assert.equal(value.error.code,action==='failure'?'PREVIEW_FAILED':'PREVIEW_CANCELLED');
        assert.ok(!JSON.stringify(value).includes('INTERNAL_EXCEPTION'));assert.ok(!value.error.cleanupPending);
        assert.deepEqual(fs.readdirSync(join(root,'.cache/studio/preview')),[]);
        assert.equal(service.listThink({}).ok,true);
        console.log(JSON.stringify({code:value.error.code,cleaned:true}));
      }finally{await preview.close();service.close();}
    `);
    assert.deepEqual(result, { code: action === 'failure' ? 'PREVIEW_FAILED' : 'PREVIEW_CANCELLED', cleaned: true });
    assert.deepEqual(fs.readFileSync(join(root, 'src/modules/think/content/existing.md')), original);
  });
}
