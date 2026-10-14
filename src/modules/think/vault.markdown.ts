export interface MarkdownBlock { type:'paragraph'|'heading'|'quote'|'list'|'code'; text:string; level?:number; ordered?:boolean }
export function markdownBlocks(source:string):MarkdownBlock[] {
  const blocks:MarkdownBlock[]=[];let paragraph:string[]=[];
  const flush=()=>{if(paragraph.length){blocks.push({type:'paragraph',text:paragraph.join('\n')});paragraph=[];}};
  const lines=source.split(/\r?\n/);
  for(let i=0;i<lines.length;i++) {
    const line=lines[i];
    if(/^```/.test(line)){flush();const code:string[]=[];while(++i<lines.length&&!/^```/.test(lines[i]))code.push(lines[i]);blocks.push({type:'code',text:code.join('\n')});}
    else if(!line.trim())flush();
    else if(/^#{1,3} /.test(line)){flush();const match=/^(#{1,3}) (.*)$/.exec(line)!;blocks.push({type:'heading',level:match[1].length,text:match[2]});}
    else if(/^> /.test(line)){flush();blocks.push({type:'quote',text:line.slice(2)});}
    else if(/^(?:[-*] |\d+\. )/.test(line)){flush();blocks.push({type:'list',ordered:/^\d/.test(line),text:line.replace(/^(?:[-*] |\d+\. )/,'')});}
    else paragraph.push(line);
  }
  flush();return blocks;
}
