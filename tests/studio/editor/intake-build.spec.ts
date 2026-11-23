import { chooseWorkspace, reveal } from '../workbench-controls.ts';
import fs from 'node:fs';import {join,resolve}from'node:path';import{test as base,expect}from'@playwright/test';import{startStudioHttp}from'../../../studio/server/http.ts';
const test=base.extend<{repo:{root:string;origin:string};previewBase:string}>({previewBase:['/',{option:true}],repo:async({page,previewBase},use)=>{
  const cache=resolve('.cache/studio-m19-2');fs.mkdirSync(cache,{recursive:true});const root=fs.mkdtempSync(join(cache,'browser-'));
  fs.cpSync('src',join(root,'src'),{recursive:true,filter:p=>!/\/think\/content(?:\/|$)/.test(p.replaceAll('\\','/'))});fs.mkdirSync(join(root,'src/modules/think/content'),{recursive:true});fs.cpSync('public',join(root,'public'),{recursive:true,filter:p=>!p.replaceAll('\\','/').includes('/vault')});for(const file of ['package.json','astro.config.mjs','tsconfig.json'])fs.copyFileSync(file,join(root,file));
  fs.writeFileSync(join(root,'src/modules/build/data.ts'),"import { publicProjects } from './projects.ts';\nexport const projects = publicProjects([]);\n");
  const session=await startStudioHttp({repositoryRoot:root,port:0,intakeDirectory:join(root,'fixture-inbox'),webDirectory:resolve('.cache/studio/web'),previewBase}),errors:string[]=[],external:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==session.origin)external.push(r.url());});
  try{await use({root,origin:session.origin});}finally{await session.close();fs.rmSync(root,{recursive:true,force:true});expect(errors).toEqual([]);expect(external).toEqual([]);}
}});
test.setTimeout(180000);
for(const previewBase of ['/','/personal-space/'])test.describe('M19.2 Astro '+previewBase,()=>{
  test.use({previewBase});
  test('report fills original project controls, previews real Astro and applies draft only',async({page,repo})=>{
    await page.goto(repo.origin+'/#maintenance'); await chooseWorkspace(page, '录入');await page.locator('#intake-module').selectOption('build');await expect(page.locator('#intake-target option')).toHaveCount(1);
    const project={slug:'review-project',title:'非敏感原型',summary:'测试用项目报告',sections:[{title:'设计',paragraphs:['只完成了测试原型。'],code:'const message = "中文";'}],milestones:[{title:'后续计划',status:'planned'}],updates:[{date:'2026-10-31',title:'原型测试',accomplishments:['验证测试样例']}],issues:[{title:'待手动检查',description:'实际 App 仍待验',status:'open'}]};
    await reveal(page, 'intake-options'); await page.locator('#intake-format').selectOption('report');await page.locator('#intake-material').fill(JSON.stringify({version:1,module:'build',candidate:project}));await page.locator('#intake-create').click();await expect(page.locator('#intake-project-title')).toHaveValue(project.title);await expect(page.getByLabel('代码（可选，保留换行）',{exact:true})).toHaveValue(project.sections[0]!.code);
    await page.getByLabel('代码（可选，保留换行）',{exact:true}).fill('const message = "修订";\nconsole.log(message);');await expect(page.locator('#intake-apply')).toBeDisabled();await page.locator('#intake-save').click();await expect(page.locator('#intake-apply')).toBeEnabled();
    await page.locator('#intake-preview').click();await expect(page.frameLocator('#intake-preview-frame iframe').locator('body')).toContainText('非敏感原型',{timeout:150000});expect(fs.readFileSync(join(repo.root,'src/modules/build/data.ts'),'utf8')).not.toContain('review-project');
    page.once('dialog',d=>d.accept());await page.locator('#intake-apply').click();await expect(page.locator('#intake-message')).toContainText('已保存到真正内容源');const saved=fs.readFileSync(join(repo.root,'src/modules/build/data.ts'),'utf8');expect(saved).toContain('"published": false');expect(saved).toContain('修订');expect(saved).toContain('"status": "planned"');
  });
});
