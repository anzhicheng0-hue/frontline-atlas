import {mkdir,cp,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
const dest=resolve(process.argv[2]||'F:/ESP32Projects/frontline_web_server');
if(!dest.toLowerCase().startsWith('f:\\esp32projects\\')) throw new Error('Export must remain under F:/ESP32Projects/');
try {await access(dest); if (!process.argv.includes('--update')) throw new Error('Destination exists; use --update only for this generated project.');} catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(dest,{recursive:true});
for(const name of ['CMakeLists.txt','sdkconfig.defaults','Update-Web.ps1','Start-Remote-Access.ps1','Stop-Remote-Access.ps1','main']) await cp(new URL('../firmware/'+name,import.meta.url),resolve(dest,name),{recursive:true});
await cp(new URL('../dist/',import.meta.url),resolve(dest,'web'),{recursive:true});
await cp(new URL('../README.md',import.meta.url),resolve(dest,'README.md'));
await writeFile(resolve(dest,'.frontline-export.json'),JSON.stringify({sourceProject:new URL('../',import.meta.url).pathname,exportedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({project:dest}));
