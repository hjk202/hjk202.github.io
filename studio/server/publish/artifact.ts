import{inflateRawSync,crc32}from'node:zlib';import{sha,publicPath,PublishError}from'./support.ts';
const MAX=128*1024*1024;
/** Parse the fixed Pages ZIP -> artifact.tar in memory, without extracting any paths. */
export function pagesFiles(zip:Buffer):Map<string,Buffer>{
  try{
    if(zip.length>MAX||zip.length<22)throw new Error();let end=-1;for(let p=zip.length-22;p>=Math.max(0,zip.length-65557);p--)if(zip.readUInt32LE(p)===0x06054b50&&p+22+zip.readUInt16LE(p+20)===zip.length){end=p;break;}
    if(end<0||zip.readUInt16LE(end+4)||zip.readUInt16LE(end+6)||zip.readUInt16LE(end+8)!==1||zip.readUInt16LE(end+10)!==1)throw new Error();
    const central=zip.readUInt32LE(end+16),length=zip.readUInt32LE(end+12);if(central+length!==end||zip.readUInt32LE(central)!==0x02014b50)throw new Error();
    const flags=zip.readUInt16LE(central+8),method=zip.readUInt16LE(central+10),crc=zip.readUInt32LE(central+16),compressed=zip.readUInt32LE(central+20),size=zip.readUInt32LE(central+24),names=zip.readUInt16LE(central+28),extra=zip.readUInt16LE(central+30),comment=zip.readUInt16LE(central+32),local=zip.readUInt32LE(central+42);
    if(flags&1||![0,8].includes(method)||size>MAX||size<1024||central+46+names+extra+comment!==end||zip.subarray(central+46,central+46+names).toString()!=='artifact.tar'||zip.readUInt16LE(central+34)||zip.readUInt32LE(local)!==0x04034b50||zip.readUInt16LE(local+6)!==flags||zip.readUInt16LE(local+8)!==method)throw new Error();
    const localNames=zip.readUInt16LE(local+26),start=local+30+localNames+zip.readUInt16LE(local+28);if(zip.subarray(local+30,local+30+localNames).toString()!=='artifact.tar'||start+compressed>central)throw new Error();
    const data=zip.subarray(start,start+compressed),tar=method===0?data:inflateRawSync(data,{maxOutputLength:size});if(tar.length!==size||crc32(tar)!==crc)throw new Error();return tarFiles(tar);
  }catch{throw new PublishError('PAGES_ARTIFACT_INVALID');}
}
export function tarFiles(tar:Buffer):Map<string,Buffer>{
  if(tar.length>MAX||tar.length%512)throw new PublishError('PAGES_TAR_INVALID');const files=new Map<string,Buffer>();let offset=0,total=0,longName:string|undefined;
  const text=(value:Buffer)=>new TextDecoder('utf-8',{fatal:true}).decode(value.subarray(0,value.indexOf(0)<0?value.length:value.indexOf(0)));
  const octal=(value:Buffer)=>{const s=value.toString('ascii').replaceAll('\0','').trim();if(!/^[0-7]+$/.test(s))throw new PublishError('PAGES_TAR_INVALID');return parseInt(s,8);};
  for(;offset+512<=tar.length;){const header=tar.subarray(offset,offset+512);if(header.every(n=>n===0)){if(longName||offset+1024>tar.length||!tar.subarray(offset).every(n=>n===0))throw new PublishError('PAGES_TAR_INVALID');return files;}
    const checksum=octal(header.subarray(148,156)),sum=header.reduce((n,x,i)=>n+(i>=148&&i<156?32:x),0);if(sum!==checksum)throw new PublishError('PAGES_TAR_CHECKSUM');
    const size=octal(header.subarray(124,136)),kind=header[156],start=offset+512;if(size>32*1024*1024||start+size>tar.length)throw new PublishError('PAGES_TAR_LIMIT');const content=tar.subarray(start,start+size);offset=start+Math.ceil(size/512)*512;
    if(kind===76){if(longName||size>1024)throw new PublishError('PAGES_TAR_INVALID');longName=text(content).replace(/\n$/,'');continue;}
    const name=longName??((header.subarray(257,263).toString()==='ustar\0'&&text(header.subarray(345,500))?text(header.subarray(345,500))+'/':'')+text(header.subarray(0,100)));longName=undefined;
    const normalized=name.replace(/^\.\//,'').replace(/\/$/,'');if(kind===53){if(size||normalized&&publicPath(normalized)!==normalized)throw new PublishError('PAGES_TAR_INVALID');continue;}
    if(kind!==0&&kind!==48)throw new PublishError('PAGES_TAR_TYPE');publicPath(normalized);if(files.has(normalized)||files.size>=512||(total+=size)>MAX)throw new PublishError('PAGES_TAR_LIMIT');files.set(normalized,content);
  }throw new PublishError('PAGES_TAR_TRUNCATED');
}
export function sameCatalog(files:Map<string,Buffer>,expected:Record<string,string>){const actual=Object.fromEntries([...files].sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>[name,sha(bytes)]));const keys=Object.keys(expected).sort();if(JSON.stringify(Object.keys(actual).sort())!==JSON.stringify(keys)||keys.some(key=>actual[key]!==expected[key]))throw new PublishError('CHECKED_ARTIFACT_MISMATCH');}
export function releaseIdentity(bytes:Buffer,source:string,expected:Record<string,string>){
  let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new PublishError('RELEASE_IDENTITY_INVALID');}
  if(!value||Object.keys(value).sort().join()!=='files,source,version'||value.version!==1||value.source!==source||!value.files||typeof value.files!=='object'||Array.isArray(value.files))throw new PublishError('RELEASE_IDENTITY_INVALID');
  const keys=Object.keys(expected).filter(k=>k!=='release-manifest.json').sort();if(JSON.stringify(Object.keys(value.files).sort())!==JSON.stringify(keys)||keys.some(k=>value.files[k]!==expected[k]))throw new PublishError('RELEASE_IDENTITY_FILES_INVALID');
}
