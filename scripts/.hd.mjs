import git from 'isomorphic-git'; import fs from 'node:fs';
const dir=process.cwd(); const out=process.argv[3];
const oid=await git.resolveRef({fs,dir,ref:'HEAD'});
try{const {blob}=await git.readBlob({fs,dir,oid,filepath:process.argv[2]}); fs.writeFileSync(out,Buffer.from(blob));}catch{fs.writeFileSync(out,'');}
