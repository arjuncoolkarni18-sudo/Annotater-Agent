import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {deployGoogle} from '../scripts/deploy-google.mjs';
const db={uuid:'11111111-2222-3333-4444-555555555555',name:'margin-google'};
async function config(overrides={}){const dir=await mkdtemp(path.join(tmpdir(),'margin-deploy-')),file=path.join(dir,'wrangler.json');await writeFile(file,JSON.stringify({name:'annotater-agent',d1_databases:[{binding:'DB',database_name:db.name,...overrides}]}));return file;}
test('existing provisioned DB gets its ID before migrations and is reused on the next build',async()=>{
 const file=await config(),calls=[];const run=async args=>{calls.push(args);if(args[1]==='list')return JSON.stringify([db]);if(args[1]==='migrations')assert.equal(JSON.parse(await readFile(file)).d1_databases[0].database_id,db.uuid);};
 await deployGoogle({configPath:file,run});await deployGoogle({configPath:file,run});assert.equal(calls.filter(a=>a[1]==='create').length,0);assert.deepEqual(calls.slice(0,3).map(a=>a.slice(0,2)),[['d1','list'],['d1','migrations'],['deploy','--config']]);
});
test('a first deployment creates one DB, resolves its ID, then migrates before deploying',async()=>{
 const file=await config(),calls=[];let created=false;const run=async args=>{calls.push(args);if(args[1]==='list')return JSON.stringify(created?[db]:[]);if(args[1]==='create')created=true;};
 await deployGoogle({configPath:file,run});assert.deepEqual(calls.map(a=>a[1]),['list','create','list','migrations','--config']);assert.equal(JSON.parse(await readFile(file)).d1_databases[0].database_id,db.uuid);
});
test('missing pinned DB stops without creating a replacement or deploying',async()=>{
 const file=await config({database_id:db.uuid}),calls=[];await assert.rejects(deployGoogle({configPath:file,run:async args=>{calls.push(args);return '[]';}}),/preserve account data/);assert.equal(calls.length,1);
});
test('failed migrations prevent publication of a new Worker version',async()=>{
 const file=await config(),calls=[];await assert.rejects(deployGoogle({configPath:file,run:async args=>{calls.push(args);if(args[1]==='list')return JSON.stringify([db]);throw Error('Migration failed');}}),/Migration failed/);assert.equal(calls.some(a=>a[0]==='deploy'),false);
});
