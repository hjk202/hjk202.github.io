import { build } from 'vite';
import { isAbsolute, join } from 'node:path';
import fs from 'node:fs';

// Fixed preparation child; never started by the Web UI, Agent, or daily launcher.
const [root,output]=process.argv.slice(2);
if(!root||!output||!isAbsolute(root)||!isAbsolute(output)||process.argv.length!==4)throw new Error('INVALID_PREPARATION');
await build({configFile:false,root,publicDir:false,logLevel:'error',
  build:{ssr:true,outDir:output,emptyOutDir:true,sourcemap:false,minify:false,target:'node22',
    rolldownOptions:{input:{app:join(root,'studio/windows/app.ts'),backend:join(root,'studio/server/main.ts')},
      external:id=>!id.startsWith('.')&&!isAbsolute(id),
      output:{entryFileNames:'[name].mjs',chunkFileNames:'[name]-[hash].mjs',format:'es'},
    },
  },
});
for(const [source,target]of [['studio/server/think/preview-build.mjs','preview-build.mjs'],['studio/server/think/preview-build.mjs','think/preview-build.mjs'],
  ['studio/server/publish/verify.mjs','verify.mjs'],
  ['studio/windows/Read-Credentials.ps1','Read-Credentials.ps1'],['studio/windows/Credentials.ps1','Credentials.ps1']] as const){
  fs.mkdirSync(join(output,target,'..'),{recursive:true});fs.copyFileSync(join(root,source),join(output,target));
}
