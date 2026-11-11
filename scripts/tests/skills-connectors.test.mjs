import test from 'node:test';
import assert from 'node:assert/strict';
import { getSkillCatalogue, skillSections } from '../../src/personalized-home-2-0/ai-workspace/workspace-skills.js';
import { CONNECTOR_EXAMPLES, connectorSections } from '../../src/personalized-home-2-0/ai-workspace/workspace-connectors.js';

test('preinstalled skills appear only in mine, including when searching', () => {
  const items = getSkillCatalogue();
  const mine = skillSections(items, { scope:'mine' });
  const official = mine.find(section => section.id === 'official').items;
  assert.ok(official.length > 0);
  const ids = new Set(official.map(item => item.id));
  const discover = skillSections(items);
  assert.ok(!discover.some(section => section.id === 'official'));
  assert.ok(discover.every(section => section.items.every(item => !ids.has(item.id))));
  const result = skillSections(items, { scope:'mine', query:official[0].title });
  assert.ok(result[0].items.some(item => item.id === official[0].id));
});

test('latest and hot order discovery and installed cards without mutating inputs', () => {
  const items = [
    {id:'older',title:'Older',description:'',author:'A',category:'study',type:'community',skillType:'prompt',installed:true,createdAt:10,usageCount:100},
    {id:'newer',title:'Newer',description:'',author:'A',category:'study',type:'community',skillType:'prompt',installed:true,createdAt:20,usageCount:1},
  ];
  for (const scope of ['discover','mine']) {
    const sectionId = scope === 'mine' ? 'installed' : 'all';
    assert.equal(skillSections(items,{scope}).find(section => section.id === sectionId).items[0].id,'newer');
    assert.equal(skillSections(items,{scope,sort:'hot'}).find(section => section.id === sectionId).items[0].id,'older');
  }
  assert.deepEqual(items.map(item => item.id),['older','newer']);
});

test('moving preinstalled cards preserves installed and custom ownership', () => {
  const items = getSkillCatalogue([
    {id:'mine-installed',title:'Installed',type:'installed',description:'',skillType:'prompt'},
    {id:'mine-custom',title:'Custom',type:'custom',description:'',skillType:'prompt'},
  ]);
  const mine = skillSections(items,{scope:'mine'});
  assert.ok(mine.find(section => section.id === 'installed').items.some(item => item.id === 'mine-installed'));
  assert.ok(mine.find(section => section.id === 'custom').items.some(item => item.id === 'mine-custom'));
});

test('connector catalogue supports sorting, search and the local collection independently', () => {
  assert.equal(connectorSections()[0].items.length,CONNECTOR_EXAMPLES.length);
  assert.equal(connectorSections()[0].items[0].id,'notion');
  assert.equal(connectorSections({sort:'hot'})[0].items[0].id,'github');
  assert.deepEqual(connectorSections({scope:'mine'})[0].items,[]);
  assert.deepEqual(connectorSections({scope:'mine',added:['notion','unknown']})[0].items.map(item => item.id),['notion']);
  assert.deepEqual(connectorSections({query:'GITHUB'})[0].items.map(item => item.id),['github']);
  assert.deepEqual(connectorSections({scope:'mine',added:['notion'],query:'GITHUB'})[0].items,[]);
});

test('connector categories filter both discovery and my collection with search and sort', () => {
  const all = connectorSections()[0].items;
  const connectors = connectorSections({category:'connector'})[0].items;
  const mcp = connectorSections({category:'mcp',sort:'hot'})[0].items;
  assert.equal(connectors.length,8);
  assert.equal(mcp.length,3);
  assert.equal(connectors.length+mcp.length,all.length);
  assert.ok(connectors.every(item => item.connectionType === 'connector'));
  assert.ok(mcp.every(item => item.connectionType === 'mcp'));
  assert.equal(mcp[0].id,'browser-mcp');
  assert.deepEqual(connectorSections({scope:'mine',category:'mcp',added:['github','filesystem-mcp']})[0].items.map(item=>item.id),['filesystem-mcp']);
  assert.deepEqual(connectorSections({category:'connector',query:'MCP'})[0].items,[]);
});
