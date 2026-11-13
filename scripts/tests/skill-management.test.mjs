import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateSkill, saveSkillDraft } from '../../src/personalized-home-2-0/ai-workspace/skill-management.js';

test('a duplicate owns an independent draft without inheriting publication or installation', () => {
  const original = { id:'a', title:'A', type:'custom', enabled:false, publication:{status:'published',snapshot:{prompt:'Published'}}, versions:[{version:'2.0'}], variables:[{name:'topic',defaultValue:'AI'}], installed:true, installCount:8 };
  const copy = duplicateSkill(original, 'b', 100);
  assert.equal(copy.id, 'b'); assert.equal(copy.title, 'A 副本');
  assert.equal(copy.publication, undefined); assert.equal(copy.versions, undefined);
  assert.equal(copy.enabled, true); assert.equal(copy.installed, false); assert.equal(copy.installCount, 0);
  copy.variables[0].defaultValue = 'UX';
  assert.equal(original.variables[0].defaultValue, 'AI');
});

test('editing a published draft preserves its released snapshot, versions and identity', () => {
  const original = { id:'a', title:'A', enabled:false, createdAt:5, installCount:3, version:'1.1', publication:{snapshot:{prompt:'Released'}}, versions:[{version:'1.1'}] };
  const edited = saveSkillDraft({ title:'Updated', prompt:'New draft', skillType:'prompt' }, original, 'wrong-id', 100);
  assert.equal(edited.id, 'a'); assert.equal(edited.enabled, false); assert.equal(edited.createdAt, 5);
  assert.equal(edited.publication.snapshot.prompt, 'Released'); assert.deepEqual(edited.versions, original.versions);
  assert.equal(edited.prompt, 'New draft'); assert.equal(edited.installCount, 3);
});
