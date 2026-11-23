/** Deliberately non-sensitive acceptance data, never imported by product code. */
export const deliveryPassword='NON_SENSITIVE_DELIVERY_TEST_PASSWORD_2026';
export function deliveryPayload(){return {version:1 as const,modules:{
  think:{posts:[{id:'1'.repeat(32),title:'STUDIO_DELIVERY_TEST_THINK',summary:'非敏感验收',date:'2026-10-23',kind:'article',body:'# 非敏感验收\n\n![pixel](asset:'+'6'.repeat(32)+')\n\n```txt\nSTUDIO_DELIVERY_TEST_CODE\n```'}]},
  keep:{bookmarks:[{id:'2'.repeat(32),title:'STUDIO_DELIVERY_TEST_KEEP',description:'非敏感收藏',sourceUrl:'https://example.com/',note:['非敏感说明'],category:{id:'5'.repeat(32),label:'非敏感分类'}}]},
  me:{paragraphs:['STUDIO_DELIVERY_TEST_ME'],links:[{label:'非敏感链接',url:'https://example.com/me'}]},
  build:{projects:[{id:'3'.repeat(32),title:'STUDIO_DELIVERY_TEST_BUILD',summary:'非敏感项目',sections:[{paragraphs:['非敏感内容'],code:'STUDIO_DELIVERY_TEST_BUILD_CODE'}],status:'in-progress',milestones:[{title:'非敏感阶段',status:'planned'}],updates:[{title:'非敏感进展',date:'2026-10-23',accomplishments:['非敏感完成']}],issues:[{title:'非敏感问题',description:'非敏感说明',status:'resolved',resolution:'非敏感解决'}]}],supplements:[{id:'4'.repeat(32),publicSlug:'nemu',title:'STUDIO_DELIVERY_TEST_SUPPLEMENT',sections:[{paragraphs:['非敏感补充']}]}]},
},assets:{['6'.repeat(32)]:{type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}}};}
