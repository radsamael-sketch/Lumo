import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function loadTypeScript(path){
 const source=await readFile(new URL(path,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

const series=await loadTypeScript('../src/domain/lessonSeries.ts');
const time=await loadTypeScript('../src/domain/lessonTime.ts');
const analytics=await loadTypeScript('../src/domain/analytics.ts');
const start='2026-11-14';
const lesson=(date,overrides={})=>({
 id:`lesson-${date}`,title:'Study',topic:'',date,occurrenceDate:date,duration:30,actualDuration:0,status:'planned',
 seriesId:'series-1',recurrence:'daily',createdAt:'2026-11-14T09:00:00.000Z',updatedAt:'2026-11-14T09:00:00.000Z',...overrides,
});

test('calendar grids span month and year boundaries with unique local date keys',()=>{
 const range=series.calendarGridRange(new Date(2027,0,1));
 assert.deepEqual(range,{fromDate:'2026-12-28',toDate:'2027-02-07'});
});

test('new daily and weekly series generate unique dates across month and year boundaries',()=>{
 const daily=series.seriesOccurrenceDates('2026-12-30','daily');
 assert.equal(daily.length,84);
 assert.deepEqual(daily.slice(0,4),['2026-12-30','2026-12-31','2027-01-01','2027-01-02']);
 assert.equal(new Set(daily).size,daily.length);
 const weekly=series.seriesOccurrenceDates('2026-12-30','weekly',[1,3]);
 assert.ok(weekly.every(date=>[1,3].includes(new Date(`${date}T12:00:00Z`).getUTCDay())));
 assert.equal(weekly[0],'2026-12-30');
});

test('extends old daily and weekly series into future calendar months without duplicating dates',()=>{
 const existing=Array.from({length:84},(_,index)=>{
  const date=new Date(`${start}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate()+index);
  return lesson(date.toISOString().slice(0,10));
 });
 const daily=series.missingSeriesOccurrences(existing,'2027-02-01','2027-02-28');
 assert.equal(daily.length,23);
 assert.equal(new Set(daily.map(item=>item.date)).size,23);
 const weekly=existing.map(item=>({...item,recurrence:'weekly',weekdays:[1,3]}));
 const dates=series.missingSeriesOccurrences(weekly,'2027-02-01','2027-02-28').map(item=>item.date);
 assert.ok(dates.length>0);
 assert.ok(dates.every(date=>[1,3].includes(new Date(`${date}T12:00:00Z`).getUTCDay())));
 const materialized=daily.map(({template,date})=>({...template,id:`extended-${date}`,date,occurrenceDate:date}));
 assert.equal(series.missingSeriesOccurrences([...weekly,...materialized],'2027-02-01','2027-02-28').length,0);
});

test('series exclusions and cutoffs prevent deleted occurrences from returning',()=>{
 const existing=Array.from({length:84},(_,index)=>{
  const date=new Date(`${start}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate()+index);
  return lesson(date.toISOString().slice(0,10));
 });
 const exceptions={ 'series-1':{excludedDates:['2027-02-02'],cutoffDate:'2027-02-10'} };
 const dates=series.missingSeriesOccurrences(existing,'2027-02-01','2027-02-28',exceptions).map(item=>item.date);
 assert.equal(dates.includes('2027-02-02'),false);
 assert.equal(dates.some(date=>date>='2027-02-10'),false);
});

test('one-off edits stay excluded and future edits clear a previous cutoff',()=>{
 const edited=series.excludeSeriesDate({},'series-1','2027-02-02');
 const deletedFuture=series.truncateSeriesFromDate(edited,'series-1','2027-02-10');
 const resumed=series.resumeSeriesFromDate(deletedFuture,'series-1');
 assert.deepEqual(resumed['series-1'],{excludedDates:['2027-02-02']});
});

test('lesson timer restores persisted duration, includes sleep, and cannot accrue twice after pause',()=>{
 const running=lesson(start,{actualSeconds:120,timerStartedAt:'2026-11-14T09:00:00.000Z'});
 const now=Date.parse('2026-11-14T10:00:00.000Z');
 assert.equal(time.lessonElapsedSeconds(running,now),3720);
 const paused=time.pauseLessonTimer(running,now);
 assert.equal(paused.actualSeconds,3720);
 assert.equal(paused.actualDuration,62);
 assert.equal(time.lessonElapsedSeconds(paused,now+3600_000),3720);
 const legacy=lesson(start,{actualSeconds:undefined,actualDuration:15,timerStartedAt:'2026-11-14T09:59:00.000Z'});
 assert.equal(time.lessonElapsedSeconds(legacy,now),960);
});

test('progress metrics use event counts and leave accuracy unset without attempts',()=>{
 const today=new Date('2026-11-14T12:00:00');
 const lessons=[lesson('2026-11-14',{status:'completed',actualSeconds:900})];
 const reviews=[{id:'review-1',wordId:'word-1',result:'known',reviewedAt:'2026-11-14T12:00:00.000Z',intervalDays:1}];
 const attempts=[{id:'attempt-1',exerciseId:'exercise-1',correct:true,answer:'ok',snapshot:{},createdAt:'2026-11-14T12:00:00.000Z'}];
 assert.equal(analytics.completedLessonCount(lessons),1);
 assert.equal(analytics.attemptAccuracy([]),null);
 assert.equal(analytics.attemptAccuracy(attempts),100);
 assert.equal(analytics.activityForLastDays(lessons,reviews,attempts,today).at(-1).total,3);
 assert.equal(analytics.activityForLastDays([],[],[],today).at(-1).total,0);
});
