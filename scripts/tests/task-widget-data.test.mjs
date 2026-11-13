import test from 'node:test';
import assert from 'node:assert/strict';
import { countdownState, parseLocalDate, timerState, startTimer, pauseTimer, completeTimer, randomChoice, calculateWithHistory, normalizeTasks, normalizeLessons, validateLesson, convertTaskValue } from '../../src/personalized-home-2-0/board/task-widget-data.js';
test('countdown validates dates and tracks calendar-day progress without time-of-day drift', () => {
  assert.equal(parseLocalDate('2026-02-30'), null);
  const config = {startDate:'2026-11-01', targetDate:'2026-11-11'};
  const state = countdownState(config, new Date(2026,10,6,23,59));
  assert.equal(state.days,5); assert.equal(state.progress,.5);
  assert.equal(countdownState(config,new Date(2026,10,12)).days,-1);
  assert.equal(countdownState({targetDate:'2026-11-11'},new Date(2026,10,6)).progress,null);
  const reversed=countdownState({startDate:'2026-11-15',targetDate:'2026-11-13'},new Date(2026,10,13));
  assert.equal(reversed.error,'order'); assert.equal(reversed.progress,null); assert.equal(reversed.days,0);
  assert.equal(countdownState({startDate:'2026-11-13',targetDate:'2026-11-13'}).error,null);
});
test('pomodoro stores a wall-clock deadline and transitions once after a background completion', () => {
  const config={minutes:25,remaining:1500,endAt:0};
  const started={...config,...startTimer(config,100000)};
  assert.equal(started.endAt,1600000);
  assert.equal(timerState(started,400000).remaining,1200);
  assert.deepEqual(pauseTimer(started,400000),{remaining:1200,endAt:0});
  assert.equal(completeTimer(started,1500000),null);
  const complete=completeTimer(started,1900000);
  assert.equal(complete.phase,'break'); assert.equal(complete.remaining,300); assert.equal(complete.completedSessions,1);
  assert.equal(completeTimer({...started,...complete},2000000),null);
  const rest={...started,...complete,...startTimer({...started,...complete},2000000)};
  const finishRest=completeTimer(rest,2400000);
  assert.equal(finishRest.phase,'focus'); assert.equal(finishRest.remaining,1500); assert.equal(finishRest.completedSessions,1);
});
test('random selection rejects out-of-range modulo samples and ignores blank options', () => {
  let calls=0;
  const picked=randomChoice(['a','','b','c'],a=>{a[0]=calls++===0?0xffffffff:2;});
  assert.deepEqual(picked,{value:'c',index:2}); assert.equal(calls,2);
  assert.equal(randomChoice([]),null);
});
test('calculator history records successful calculations and rejects executable input', () => {
  const value=calculateWithHistory('(12+8)*2',[],42);
  assert.equal(value.result,'40'); assert.deepEqual(value.history[0],{expression:'(12+8)*2',result:'40',at:42});
  assert.throws(()=>calculateWithHistory('globalThis.location',value.history));
});
test('legacy tasks and lessons remain usable while scheduling requires valid non-overlapping ranges', () => {
  assert.equal(normalizeTasks([{text:'A',done:1}])[0].done,true);
  const lessons=normalizeLessons([{name:'数学',day:0,time:'09:00',place:'A'}]);
  assert.equal(lessons[0].endTime,'10:00');
  assert.equal(validateLesson({name:'语文',day:0,time:'09:30',endTime:'10:30'},lessons),'overlap');
  assert.equal(validateLesson({name:'语文',day:0,time:'10:00',endTime:'11:00'},lessons),null);
  assert.equal(validateLesson({name:'语文',day:0,time:'25:00',endTime:'26:00'},lessons),'time');
  assert.equal(validateLesson({...lessons[0],time:'09:15'},lessons,lessons[0].id),null);
});
test('conversion supports accurate offset temperatures and added dimensions', () => {
  assert.equal(convertTaskValue(32,'temperature','f','c').result,0);
  assert.equal(convertTaskValue(-1,'temperature','k','c').error,'absolute');
  assert.equal(convertTaskValue(1,'volume','l','ml').result,1000);
  assert.equal(convertTaskValue(1,'area','ha','m2').result,10000);
  assert.equal(convertTaskValue('','time','h','s').result,null);
  assert.equal(convertTaskValue(1,'time','h','s').result,3600);
  assert.equal(convertTaskValue(1,'__proto__','h','s').error,'number');
});
test('conversion reports overflow and avoids overflowing safe intermediate calculations', () => {
  assert.deepEqual(convertTaskValue(1e308,'temperature','c','f'),{result:null,error:'range'});
  assert.deepEqual(convertTaskValue(1e308,'length','km','mm'),{result:null,error:'range'});
  assert.equal(convertTaskValue(1e308,'length','km','km').result,1e308);
  const fahrenheit=convertTaskValue(1e308,'temperature','f','c');
  assert.equal(fahrenheit.error,null); assert.ok(Number.isFinite(fahrenheit.result));
  assert.equal(fahrenheit.result,1e308*(5/9));
});
