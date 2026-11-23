import { fileURLToPath, pathToFileURL } from 'node:url';
import { desktopControl } from './desktop.ts';
import { prepareStudio, readOrPrepareStudio } from './prepared.ts';
import { DesktopError } from './local.ts';
import { StartupTrace } from './startup.ts';

// The stable bootstrap activates an existing owned window or loads the frozen program.
const root=fileURLToPath(new URL('../../',import.meta.url));
const trace=new StartupTrace(root,'opener');trace.mark('open-request');
try {
  if(process.platform!=='win32'||process.argv.length!==3||process.argv[2]!=='open')throw new DesktopError('INVALID_COMMAND');
  let active=false;
  try {
    const current=await desktopControl(root,'status');
    if(current){if(!current.app)throw new DesktopError('APP_MODE_CONFLICT');await desktopControl(root,'activate');active=true;trace.mark('activated');}
  }catch(error){if(!(error instanceof DesktopError)||error.message!=='DESKTOP_UNAVAILABLE')throw error;}
  if (!active) {
    const prepared = await readOrPrepareStudio(root, root => prepareStudio(root, undefined, trace.mark));
    const app = await import(pathToFileURL(prepared.host).href) as {openApp(options:{root:string;preparedId:string}):Promise<void>};
    await app.openApp({ root, preparedId: prepared.id });
  }
}catch(error){process.stderr.write(`Studio: ${error instanceof DesktopError?error.message:'PREPARED_INVALID'}\n`);process.exitCode=1;}
