import test from 'node:test';
import assert from 'node:assert/strict';
import { getSkillCatalogue, getPublishedSkill, saveSkill, skillSections, sortSkillItems } from '../../src/personalized-home-2-0/ai-workspace/workspace-skills.js';

const custom = {id:'my-private',title:'Draft title',description:'Draft notes',author:'我',type:'custom',category:'study',skillType:'task',skillMarkdown:'# Private draft'};
const publication = {status:'published',visibility:'plaza',publishedAt:'2026-11-13T08:00:00.000Z',snapshot:{title:'Published title',description:'Published notes',author:'我',category:'office',skillType:'task',skillMarkdown:'# Released instructions'}};

test('installation stats never convert legacy use counts or strings', () => {
  const items = getSkillCatalogue([
    {id:'legacy-count',title:'Legacy',type:'community',usageCount:9999,used:'9.9K'},
    {id:'new-count',title:'New',type:'community',installCount:120,usageCount:9999},
    custom,
  ]);
  assert.equal(items.find(item=>item.id==='legacy-count').installCount,null);
  assert.equal(items.find(item=>item.id==='new-count').installCount,120);
  assert.equal(items.find(item=>item.id===custom.id).installCount,0);
  const examples=items.filter(item=>item.id.startsWith('skill-catalogue-'));
  assert.ok(examples.every(item=>Number.isFinite(item.installCount)));
  assert.deepEqual(sortSkillItems([{id:'uses',usageCount:9999,installCount:10},{id:'people',usageCount:1,installCount:20}],'hot').map(i=>i.id),['people','uses']);
});

test('all official records are always available, grouped once and excluded from installable discovery', () => {
  const items=getSkillCatalogue([{id:'new-official',title:'New official',type:'official',installed:false,enabled:false}]);
  const officials=items.filter(item=>item.type==='official');
  assert.ok(officials.length>14);
  assert.ok(officials.every(item=>item.installed && item.enabled));
  const mine=skillSections(items,{scope:'mine'});
  assert.equal(mine.find(s=>s.id==='official').items.length,officials.length);
  assert.ok(mine.find(s=>s.id==='installed').items.every(item=>item.type!=='official'));
  assert.ok(skillSections(items).every(s=>s.items.every(item=>item.type!=='official')));
  assert.deepEqual(saveSkill([],{id:'test',type:'official',installed:false,enabled:false})[0],{id:'test',type:'official',installed:true,enabled:true});
});

test('enabled is independent from installation and survives save/catalogue reconstruction', () => {
  const item={id:'saved-install',title:'Installed',type:'installed',installed:true,enabled:false};
  let saved=saveSkill([],item);
  let result=getSkillCatalogue(saved).find(i=>i.id===item.id);
  assert.equal(result.installed,true);assert.equal(result.enabled,false);
  saved=saveSkill(saved,{...result,enabled:true});
  result=getSkillCatalogue(saved).find(i=>i.id===item.id);
  assert.equal(result.installed,true);assert.equal(result.enabled,true);
});

test('public discovery uses released snapshots, excluding private and withdrawn records', () => {
  const source={...custom,publication};
  const projected=getPublishedSkill(source);
  assert.equal(projected.title,'Published title');
  assert.equal(projected.skillMarkdown,'# Released instructions');
  assert.equal(projected._publicView,true);
  const discover=skillSections(getSkillCatalogue([source]));
  assert.ok(discover.some(s=>s.id==='office' && s.items.some(i=>i.id===custom.id)));
  assert.ok(discover.every(s=>s.items.every(i=>i.title!=='Draft title')));
  const privateItems=getSkillCatalogue([{...source,publication:{...publication,visibility:'link'}}]);
  assert.ok(skillSections(privateItems).every(s=>s.items.every(i=>i.id!==custom.id)));
  const withdrawnItems=getSkillCatalogue([{...source,publication:{...publication,status:'unpublished'}}]);
  assert.ok(skillSections(withdrawnItems).every(s=>s.items.every(i=>i.id!==custom.id)));
  assert.equal(skillSections(withdrawnItems,{scope:'mine'}).find(s=>s.id==='custom').items[0].title,'Draft title');
});

test('author catalogue combines published types and supports independent type filtering', () => {
  const items=getSkillCatalogue([{...custom,publication},{id:'unpublished',type:'custom',author:'我',title:'Hidden'}]);
  const mine=skillSections(items,{authorFilter:'我',kind:'task'})[0].items;
  assert.deepEqual(mine.map(i=>i.id),[custom.id]);
  assert.deepEqual(skillSections(items,{authorFilter:'我',kind:'prompt'})[0].items,[]);
  assert.ok(skillSections(items,{authorFilter:'Tabbit 官方'})[0].items.every(i=>i.type==='official'));
});

test('tombstones suppress seeded and custom skills after rebuilding catalogue', () => {
  const first=getSkillCatalogue()[0];
  const saved=saveSkill([{...custom,publication}],{...first,deleted:true});
  assert.ok(getSkillCatalogue(saved).every(i=>i.id!==first.id));
  assert.equal(getPublishedSkill({...custom,publication,deleted:true}),null);
});
