import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { parse, DOCUMENT_NODE, ELEMENT_NODE, type Node } from 'ultrahtml';
import { decodeHTML } from 'entities';
import { parseThinkSource } from '../think/document.ts';
import { fileBytes, git, sha } from './support.ts';

export const fastThinkPath = /^src\/modules\/think\/content\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

/** Check only committed resources in the isolated candidate, without running Astro or fetching URLs. */
export async function checkFastThink(root:string, path:string, slug:string):Promise<boolean>{
  if(fastThinkPath.exec(path)?.[1]!==slug)return false;
  const file=join(root,path), parsed=parseThinkSource(fileBytes(file,1024*1024).toString('utf8'));
  if(!parsed.ok||!parsed.value.validation.publishReady||parsed.value.document.metadata.published!==true)return false;
  const {createSatteriMarkdownProcessor}=await import('@astrojs/markdown-satteri');
  let rawHtml=false;
  const processor=await createSatteriMarkdownProcessor({syntaxHighlight:false,mdastPlugins:[{name:'m23-fast-no-raw-html',html(){rawHtml=true;}}]});
  const rendered=await processor.render(parsed.value.document.body);
  if(rawHtml)return false;
  const images=new Set(rendered.metadata.localImagePaths);
  let safe=true;
  function visit(node:Node){
    if(node.type!==ELEMENT_NODE&&node.type!==DOCUMENT_NODE)return;
    if(node.type===ELEMENT_NODE){
      if(node.name==='img'){
        const marker=node.attributes.__astro_image_??node.attributes.__ASTRO_IMAGE_;
        const src=marker ? JSON.parse(decodeHTML(marker)).src : decodeHTML(node.attributes.src??'');
        if(typeof src!=='string'||!src)safe=false;else images.add(src);
      }
      if(!/^(?:a|blockquote|br|code|del|em|h[1-6]|hr|img|input|li|ol|p|pre|section|strong|sup|table|tbody|td|th|thead|tr|ul)$/i.test(node.name))safe=false;
      if(node.name==='a'){
        const href=decodeHTML(node.attributes.href??'').trim();
        if(/^(?:[^/\s#?]+:|\/\/)/.test(href)&&!/^https?:\/\/|^mailto:/i.test(href))safe=false;
      }
    }
    node.children.forEach(visit);
  }
  visit(parse(rendered.code) as Node);
  if(!safe)return false;
  if(images.size===0)return true;
  const {imageSize}=await import('image-size');
  for(const source of images){
    let src:string;try{src=decodeURIComponent(source);}catch{return false;}
    if(!src||/[\\:%?#]/.test(src)||[...src].some(c=>c.charCodeAt(0)<32)||src.startsWith('//')||src.split('/').some(p=>p==='..'))return false;
    const parent=src.startsWith('/')?join(root,'public'):dirname(file);
    const asset=resolve(parent,src.replace(/^\//,''));
    const extension=extname(asset).slice(1).toLowerCase().replace(/^jpeg$/, 'jpg');
    // Keep SVG, uncommon formats and images outside the Studio size limits on the full path.
    if(!asset.startsWith(parent+sep)||!/^(?:png|jpg|gif|webp)$/.test(extension))return false;
    try{
      const name=relative(root,asset).replaceAll('\\','/'), bytes=fileBytes(asset,2*1024*1024);
      const image=imageSize(bytes);
      if(image.type!==extension||!image.width||!image.height||image.width>8192||image.height>8192||image.width*image.height>24_000_000)return false;
      const entry=await git(root,['ls-tree','HEAD','--',name]);
      if(!/^100644 blob [a-f0-9]{40}\t/.test(entry)||entry.split('\t')[1]!==name)return false;
      const blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if(entry.split(' ')[2]?.split('\t')[0]!==blob)return false;
      const digest=/^assets\/([a-f0-9]{64})\./.exec(src.replace(/^\.\//,''));
      if(digest&&sha(bytes)!==digest[1])return false;
    }catch{return false;}
  }
  return true;
}
