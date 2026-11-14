import type {Lesson} from './models';

export type LessonSeriesExceptions=Record<string,{excludedDates?:string[];cutoffDate?:string}>;
export type MissingLessonOccurrence={template:Lesson;date:string};

const dateKey=(date:Date)=>`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
const dateFromKey=(key:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return null;
 const[year,month,day]=key.split('-').map(Number);
 const date=new Date(Date.UTC(year,month-1,day));
 return dateKey(date)===key?date:null;
};
const addDays=(key:string,days:number)=>{
 const date=dateFromKey(key);
 if(!date)return null;
 date.setUTCDate(date.getUTCDate()+days);
 return dateKey(date);
};

export function calendarGridRange(month:Date){
 const first=new Date(month.getFullYear(),month.getMonth(),1);
 const offset=(first.getDay()+6)%7;
 const start=new Date(first);
 start.setDate(1-offset);
 const end=new Date(start);
 end.setDate(start.getDate()+41);
 return{fromDate:`${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`,toDate:`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`};
}

export function seriesOccurrenceDates(startDate:string,recurrence:Lesson['recurrence'],weekdays?:number[]){
 const start=dateFromKey(startDate);
 if(!start)return[];
 if(!recurrence)return[startDate];
 const selectedDays=weekdays?.length?weekdays:[start.getUTCDay()];
 const dates:string[]=[];
 for(let offset=0;offset<=83;offset++){
  const date=new Date(start);
  date.setUTCDate(date.getUTCDate()+offset);
  if(recurrence==='daily'||selectedDays.includes(date.getUTCDay()))dates.push(dateKey(date));
 }
 return dates;
}

export function missingSeriesOccurrences(
 lessons:Lesson[],
 fromDate:string,
 toDate:string,
 exceptions:LessonSeriesExceptions={},
):MissingLessonOccurrence[]{
 const from=dateFromKey(fromDate),to=dateFromKey(toDate);
 if(!from||!to||from>to)return[];
 const seriesIds=new Set(lessons.filter(lesson=>lesson.seriesId&&lesson.recurrence).map(lesson=>lesson.seriesId!));
 const missing:MissingLessonOccurrence[]=[];
 for(const seriesId of seriesIds){
  const records=lessons.filter(lesson=>lesson.seriesId===seriesId&&lesson.recurrence)
   .sort((a,b)=>(a.occurrenceDate||a.date).localeCompare(b.occurrenceDate||b.date));
  if(!records.length)continue;
  const firstDate=records[0].occurrenceDate||records[0].date;
  const protectedThrough=addDays(firstDate,83);
  const exception=exceptions[seriesId]||{};
  const excluded=new Set(exception.excludedDates||[]);
  const anchors=records.map(record=>({...record,date:record.occurrenceDate||record.date}));
  const knownDates=new Set(anchors.map(record=>record.date));
  for(let day=new Date(from);day<=to;day.setUTCDate(day.getUTCDate()+1)){
   const date=dateKey(day);
   if(date<firstDate||!protectedThrough||date<=protectedThrough||knownDates.has(date)||excluded.has(date))continue;
   if(exception.cutoffDate&&date>=exception.cutoffDate)continue;
   let anchor:Lesson|undefined;
   for(const candidate of anchors)if(candidate.date<=date&&(!anchor||(candidate.occurrenceDate||candidate.date)>(anchor.occurrenceDate||anchor.date)))anchor=candidate;
   if(!anchor)continue;
   const scheduled=anchor.recurrence==='daily'||
    anchor.recurrence==='weekly'&&(anchor.weekdays?.length?anchor.weekdays: [dateFromKey(anchor.occurrenceDate||anchor.date)?.getUTCDay()]).includes(day.getUTCDay());
   if(!scheduled)continue;
   missing.push({template:anchor,date});
   knownDates.add(date);
   anchors.push({...anchor,date,occurrenceDate:date});
  }
 }
 return missing;
}

export function excludeSeriesDate(exceptions:LessonSeriesExceptions,seriesId:string,date:string):LessonSeriesExceptions{
 const current=exceptions[seriesId]||{};
 return{...exceptions,[seriesId]:{...current,excludedDates:[...new Set([...(current.excludedDates||[]),date])]}};
}

export function truncateSeriesFromDate(exceptions:LessonSeriesExceptions,seriesId:string,date:string):LessonSeriesExceptions{
 return{...exceptions,[seriesId]:{...(exceptions[seriesId]||{}),cutoffDate:date}};
}

export function resumeSeriesFromDate(exceptions:LessonSeriesExceptions,seriesId:string):LessonSeriesExceptions{
 const current=exceptions[seriesId];
 if(!current?.cutoffDate)return exceptions;
 const next={...current};
 delete next.cutoffDate;
 if(!next.excludedDates?.length){const result={...exceptions};delete result[seriesId];return result;}
 return{...exceptions,[seriesId]:next};
}
