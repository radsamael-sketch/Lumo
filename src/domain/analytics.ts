import type {ExerciseAttempt,Lesson,Review,Word} from './models';

export function completedLessonCount(lessons:Lesson[]){
 return lessons.filter(lesson=>lesson.status==='completed').length;
}

export function learnedWordCount(words:Word[]){
 return words.filter(word=>word.status==='learned').length;
}

export function attemptAccuracy(attempts:ExerciseAttempt[]):number|null{
 return attempts.length?Math.round(attempts.filter(attempt=>attempt.correct).length/attempts.length*100):null;
}

const dayKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const timestampDayKey=(value:string)=>{
 const date=new Date(value);
 return Number.isNaN(date.getTime())?null:dayKey(date);
};

export function activityForLastDays(lessons:Lesson[],reviews:Review[],attempts:ExerciseAttempt[],today=new Date(),days=7){
 return Array.from({length:days},(_,index)=>{
  const date=new Date(today);
  date.setHours(12,0,0,0);
  date.setDate(date.getDate()-(days-1-index));
  const key=dayKey(date);
  const lesson=lessons.filter(item=>item.status==='completed'&&item.date===key).length;
  const review=reviews.filter(item=>timestampDayKey(item.reviewedAt)===key).length;
  const practice=attempts.filter(item=>timestampDayKey(item.createdAt)===key).length;
  return{key,date,lesson,review,practice,total:lesson+review+practice};
 });
}
