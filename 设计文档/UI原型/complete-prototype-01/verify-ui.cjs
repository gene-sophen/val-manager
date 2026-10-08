// Pure state/template verification. Browser testing is recorded separately.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const r=spawnSync(process.execPath,['--test',path.join(__dirname,'prototype-rules.test.cjs'),path.join(__dirname,'view-contract.test.cjs'),path.join(__dirname,'runtime-contract.test.cjs'),path.resolve(__dirname,'../../../游戏/tests/season-2026.test.js')],{stdio:'inherit'});
if(r.error)throw r.error;
process.exitCode=r.status??1;
