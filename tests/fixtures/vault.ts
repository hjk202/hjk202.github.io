export const vaultPassword='phase4-nonsensitive-acceptance';
export const articleId='1'.repeat(32),noteId='2'.repeat(32),assetId='a'.repeat(32);
export const thinkVaultFixture={version:1,modules:{think:{posts:[
  {id:articleId,title:'安全验收样本：私人文章',summary:'CANARY_P4_THINK_ONLY',date:'2026-10-14',kind:'article',body:`## 一个清晰的段落\n\n**只是非敏感验收样本。**\n\n- 第一项\n- 第二项\n\n> 留给自己的想法\n\n\`\`\`js\n<script>window.vaultInjected = true</script>\n\`\`\`\n\n<script>window.vaultInjected = true</script>\n\n[不安全链接](javascript:alert(1))\n\n![不加载远程图](https://example.com/private.jpg)\n\n![加密的测试像素](asset:${assetId})`},
  {id:noteId,title:'安全验收样本：一则随记',summary:'中文与随记',date:'2026-10-13',kind:'note',body:'这一条也只是测试。'},
]}},assets:{[assetId]:{type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKz8AAAAASUVORK5CYII='}}};
export const keepId='3'.repeat(32),projectId='4'.repeat(32),supplementId='5'.repeat(32),categoryId='b'.repeat(32);
export const allVaultFixture={...thinkVaultFixture,modules:{...thinkVaultFixture.modules,
  keep:{bookmarks:[{id:keepId,title:'安全验收样本：私人收藏',description:'CANARY_P4_KEEP_ONLY',sourceUrl:'https://example.com/resource',note:['这不是作者正式收藏。'],category:{id:categoryId,label:'私人工具'}}]},
  build:{projects:[{id:projectId,title:'安全验收样本：私人项目',summary:'CANARY_P4_BUILD_ONLY',status:'in-progress',sections:[{title:'结构',paragraphs:['仅验证项目功能。'],code:'safe_example();'}],milestones:[{title:'验证阶段',status:'done'}],updates:[{date:'2026-10-14',title:'一次非敏感更新',accomplishments:['验证记录'] }],issues:[{title:'非敏感问题',description:'用于验证。',status:'resolved',resolution:'已验证。'}]}],supplements:[{id:supplementId,publicSlug:'nemu',title:'安全验收样本：NEMU私人补充',updates:[{date:'2026-10-14',title:'补充测试记录',challenges:['验证补充不增加项目数']}]}]},
  me:{paragraphs:['CANARY_P4_ME_ONLY：仅验证资料补充，不是正式简介。'],links:[{label:'非敏感测试链接',url:'https://example.com/profile'}]},
}};
