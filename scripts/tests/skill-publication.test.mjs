import test from 'node:test';
import assert from 'node:assert/strict';
import { publishSkill, unpublishSkill, buildSkillPublicUrl, parseSkillPublicHash, revokeSkillPublications, isSkillPublicRevoked, getSkillVersions } from '../../src/personalized-home-2-0/ai-workspace/skill-publication.js';
const skill={id:'own-one',title:'测试妙招',type:'custom',author:'我',skillType:'prompt',prompt:'你好，{{姓名}}',variables:[{name:'姓名',defaultValue:'小李'}],description:'说明',installCount:3,enabled:false,autoSend:true,privateDraft:'not-public'};
const fields={visibility:'plaza',description:'公开简介',category:'study',examples:['怎么做？'],originality:true};
test('publication snapshots isolate draft edits and version history',()=>{
  const first=publishSkill(skill,fields,'2026-11-13T10:00:00Z');
  assert.equal(first.publication.version,'1.0');
  first.prompt='新草稿';first.variables[0].defaultValue='修改';
  assert.equal(first.publication.snapshot.prompt,'你好，{{姓名}}');
  assert.equal(first.publication.snapshot.variables[0].defaultValue,'小李');
  const second=publishSkill(first,fields,'2026-11-13T11:00:00Z');
  assert.equal(second.publication.version,'1.1');
  assert.equal(second.versions.length,2);
  assert.equal(second.versions[1].snapshot.prompt,'你好，{{姓名}}');
  assert.equal(second.versions[0].snapshot.prompt,'新草稿');
});
test('Unicode public link roundtrip strips ownership and private/runtime fields',()=>{
  const published=publishSkill(skill,fields,'2026-11-13T10:00:00Z');
  const url=buildSkillPublicUrl(published,'http://localhost:1420/?foo=1');
  const result=parseSkillPublicHash(new URL(url).hash);
  assert.equal(result.title,'测试妙招');assert.equal(result.description,'公开简介');
  assert.equal(result.type,'community');assert.equal(result.enabled,true);assert.equal(result.installCount,3);
  assert.equal(result.privateDraft,undefined);assert.equal(result.autoSend,undefined);assert.equal(result.publication,undefined);
});
test('publish guards and malformed public links fail safely',()=>{
  assert.throws(()=>publishSkill({...skill,type:'official'},fields),/仅可发布/);
  assert.throws(()=>publishSkill(skill,{...fields,originality:false}),/分享授权/);
  assert.throws(()=>publishSkill(skill,{...fields,description:''}),/公开简介/);
  assert.equal(parseSkillPublicHash('#skill-public=not+base64'),null);
  assert.equal(parseSkillPublicHash('#skill-public='+ 'x'.repeat(300001)),null);
  assert.equal(parseSkillPublicHash('#unrelated'),null);
  assert.throws(()=>buildSkillPublicUrl(skill),/请先发布/);
});
test('unpublish keeps draft and invalidates old local snapshot links',()=>{
  const previousTime=new Date(Date.now()-10000).toISOString();
  const published=publishSkill(skill,fields,previousTime);
  const unpublished=unpublishSkill(published);
  assert.equal(unpublished.publication.status,'unpublished');assert.equal(unpublished.prompt,skill.prompt);
  const data=new Map();const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  revokeSkillPublications(published,storage);
  assert.equal(isSkillPublicRevoked(skill.id,previousTime,storage),true);
  assert.equal(isSkillPublicRevoked('different','2026-11-13T10:00:00Z',storage),false);
  assert.equal(isSkillPublicRevoked(skill.id,new Date(Date.now()+10000).toISOString(),storage),false);
});
test('single sample version remains read-only with honest unknown date',()=>{
  const versions=getSkillVersions({id:'legacy',title:'已有妙招',prompt:'正文',usageCount:800});
  assert.equal(versions.length,1);assert.equal(versions[0].publishedAt,null);
  assert.equal(versions[0].snapshot.installCount,null);
});

test('oversized imported bodies and variable settings reject rather than silently truncating',()=>{
  for (const key of ['prompt','code','script','skillMarkdown']) {
    const input={...skill,[key]:'字'.repeat(60001)};
    assert.throws(()=>publishSkill(input,fields),/无法完整发布/);
    assert.equal(input[key].length,60001);
    assert.equal(input.publication,undefined);
  }
  assert.throws(()=>publishSkill({...skill,variables:[{name:'test',defaultValue:'a'.repeat(2001)}]},fields),/变量默认值/);
  assert.throws(()=>publishSkill({...skill,variables:Array.from({length:51},(_,i)=>({name:`v${i}`,defaultValue:''}))},fields),/变量最多支持 50 项/);
  assert.throws(()=>publishSkill(skill,{...fields,examples:Array.from({length:11},()=> 'example')}),/示例问法最多支持 10 项/);
  const body='a'.repeat(60000);
  const result=publishSkill({...skill,prompt:body},fields);
  assert.equal(result.publication.snapshot.prompt,body);
});
