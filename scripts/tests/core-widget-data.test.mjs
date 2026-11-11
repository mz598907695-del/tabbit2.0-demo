import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateExpression, convertUnit, coreWidgetCatalog } from '../../src/personalized-home-2-0/board/core-widget-data.js';
test('arithmetic respects precedence, unary minus, parentheses and percentages',()=>{
 assert.equal(calculateExpression('2*(3+4)-10%'),'13.9');
 assert.equal(calculateExpression('-3 + 4 * 2'),'5');
 assert.equal(calculateExpression('0.1+0.2'),'0.3');
 assert.throws(()=>calculateExpression('7/0'),/零/);
 assert.throws(()=>calculateExpression('(3+2'),/括号/);
 assert.throws(()=>calculateExpression('3..2'));
 assert.throws(()=>calculateExpression('globalThis.alert(1)'));
});
test('unit conversion distinguishes affine temperature and multiplicative units',()=>{
 assert.equal(convertUnit(32,'temperature','f','c'),0);
 assert.equal(convertUnit(0,'temperature','c','k'),273.15);
 assert.equal(convertUnit(2,'length','m','cm'),200);
 assert.equal(convertUnit(1,'weight','lb','kg'),.45359237);
 assert.equal(convertUnit('','length','m','cm'),null);
 assert.equal(convertUnit(1,'length','invalid','m'),null);
});
test('the core catalog contains 14 unique widgets and no invented quota defaults',()=>{
 assert.equal(coreWidgetCatalog.length,14);
 assert.equal(new Set(coreWidgetCatalog.map(x=>x.kind)).size,14);
 assert.equal(coreWidgetCatalog.find(x=>x.kind==='codex-usage').defaultConfig.usedPercent,null);
});
