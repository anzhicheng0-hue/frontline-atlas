import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const assets=['index.html','style.css','app.mjs','core.mjs','data-config.json','catalog.json','leaflet.js','leaflet.css','leaflet-LICENSE.txt'];
const out=new URL('../firmware/main/www/',import.meta.url);
await mkdir(out,{recursive:true});let total=0;
for(const name of assets){const bytes=gzipSync(await readFile(new URL('../dist/'+name,import.meta.url)),{level:9});const target=name.replaceAll('.','_').replaceAll('-','_')+'.gz';await writeFile(new URL(target,out),bytes);total+=bytes.length;console.log(`${name}: ${bytes.length} bytes gzip`);}
console.log(`Embedded web assets: ${total} bytes`);
