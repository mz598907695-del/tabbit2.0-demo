import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssistedSkillDraft, normalizeSkillDraft, parseSkillImport, SKILL_HOME_PATTERN, SKILL_IMPORT_LIMIT, skillEditorDraft, skillVariableReferences, validSkillWebsite, validateSkillDraft } from '../../src/personalized-home-2-0/ai-workspace/skill-editor-utils.js';

test('prompt variables retain defaults on save and require referenced variable definitions', () => {
  const draft=skillEditorDraft({title:'总结',prompt:'用 {{语气}} 总结 {{内容}}；再检查 {{语气}}',variables:[{name:'语气',defaultValue:'自然'},{name:'内容',defaultValue:''}]});
  assert.deepEqual(skillVariableReferences(draft.prompt),['语气','内容']);
  assert.equal(validateSkillDraft(draft),'');
  const saved=normalizeSkillDraft(draft,{id:'custom-one',type:'custom',enabled:false,publication:{version:'1.0'}});
  assert.equal(saved.enabled,false);
  assert.equal(saved.publication.version,'1.0');
  assert.equal(saved.variables[0].defaultValue,'自然');
  assert.match(validateSkillDraft({...draft,variables:draft.variables.slice(0,1)}),/内容/);
  assert.match(validateSkillDraft({...draft,variables:[{name:'x',defaultValue:''},{name:'x',defaultValue:''}]}),/重复/);
  assert.match(validateSkillDraft({...draft,variables:[{name:' ',defaultValue:''}]}),/不能为空/);
});

test('plain prompt imports detect references; imports are inert and require confirmation by caller', () => {
  const imported=parseSkillImport('prompt.md','\ufeff请概括 {{资料}}，采用 {{风格}}。');
  assert.deepEqual(imported.variables,[{name:'资料',defaultValue:''},{name:'风格',defaultValue:''}]);
  assert.equal(imported.skillType,'prompt');
  assert.equal(parseSkillImport('task.md','# Task\n\nSteps','task').skillMarkdown,'# Task\n\nSteps');
  assert.equal(parseSkillImport('source.js','window.test = true','prompt').code,'window.test = true');
  assert.throws(()=>parseSkillImport('x.json','['),/JSON/);
  assert.throws(()=>parseSkillImport('x.json','{}'),/正文/);
  assert.throws(()=>parseSkillImport('x.png','pixels'),/上传/);
  assert.throws(()=>parseSkillImport('x.txt',''),/为空/);
  assert.throws(()=>parseSkillImport('x.txt','x'.repeat(SKILL_IMPORT_LIMIT+1)),/太大/);
});

test('JSON import keeps editable fields without importing identity or publication state', () => {
  const imported=parseSkillImport('task.json',JSON.stringify({id:'overwrite',title:'研究',skillType:'task',taskDescription:'遇到研究请求时',skillMarkdown:'# 研究\n1. 搜索',websites:['https://*.example.com/*'],author:'other',type:'official',enabled:false,publication:{status:'published'}}));
  assert.equal(imported.skillType,'task');
  assert.equal(imported.taskDescription,'遇到研究请求时');
  for (const key of ['id','author','type','publication','enabled']) assert.equal(imported[key],undefined);
  const roundtrip=parseSkillImport('roundtrip.json',JSON.stringify(imported));
  assert.deepEqual(roundtrip,imported);
});

test('script and task form requirements stay distinct and URL rules are validated', () => {
  for(const site of ['*://*/*','https://*.example.com/*','http://localhost:1420/*',SKILL_HOME_PATTERN])assert.ok(validSkillWebsite(site),site);
  for(const site of ['javascript:alert(1)','https://','not a url','https://bad domain/*'])assert.equal(validSkillWebsite(site),false);
  const script=skillEditorDraft({title:'提取',skillType:'script',code:'return document.title',runMode:'auto',websites:['https://*.example.com/*']});
  assert.equal(validateSkillDraft(script),'');
  assert.equal(normalizeSkillDraft({...script,websites:[' https://example.com/* ','']}).websites[0],'https://example.com/*');
  assert.match(validateSkillDraft({...script,code:''}),/代码/);
  const task=skillEditorDraft({title:'研究',skillType:'task',skillMarkdown:'# 研究'});
  assert.match(validateSkillDraft(task),/调用描述/);
  assert.equal(validateSkillDraft({...task,taskDescription:'需要研究时'}),'');
  assert.equal(skillEditorDraft({skillType:'task',prompt:'旧任务正文'}).skillMarkdown,'旧任务正文');
});

test('assisted draft can be edited and saved as the selected skill type', () => {
  const requirement='整理最近的研究资料';
  const markdown=createAssistedSkillDraft('task',requirement,'研究助手');
  const task=skillEditorDraft({title:'研究助手',skillType:'task',taskDescription:requirement,skillMarkdown:markdown});
  assert.match(markdown,/整理最近的研究资料/);
  assert.equal(normalizeSkillDraft(task).skillMarkdown,markdown);
  const script=createAssistedSkillDraft('script','提取网页\n链接','网页摘录');
  assert.match(script,/需求：提取网页 链接/);
  assert.throws(()=>createAssistedSkillDraft('task',''),/描述/);
});

test('import categories use the shared whitelist and unknown categories fall back to tools', () => {
  const source={title:'分类测试',prompt:'整理材料'};
  for(const category of ['missing','学习研究',{},null]) {
    const draft=parseSkillImport('category.json',JSON.stringify({...source,category}));
    assert.equal(draft.category,'tools');
    assert.equal(normalizeSkillDraft(draft).category,'tools');
  }
  assert.equal(parseSkillImport('category.json',JSON.stringify({...source,category:'study'})).category,'study');
  assert.equal(normalizeSkillDraft({...skillEditorDraft(source),category:'unknown'}).category,'tools');
});

test('JSON names only fall back when missing or blank; malformed fields are reported', () => {
  assert.equal(parseSkillImport('fallback.json',JSON.stringify({prompt:'正文'})).title,'fallback');
  assert.equal(parseSkillImport('fallback.json',JSON.stringify({title:' ',name:' 有效名称 ',prompt:'正文'})).title,'有效名称');
  for(const value of [null,42,{},[]]) assert.throws(()=>parseSkillImport('fallback.json',JSON.stringify({title:value,name:'不应覆盖错误',prompt:'正文'})),/title 必须是文本/);
  for(const patch of [{websites:'https://example.com/*'},{websites:[42]},{variables:[null]},{variables:[{name:'内容',defaultValue:1}]},{autoSend:'false'},{runMode:'automatic'},{skillType:''}]) {
    assert.throws(()=>parseSkillImport('bad.json',JSON.stringify({title:'test',prompt:'正文',...patch})),/JSON/);
  }
});
