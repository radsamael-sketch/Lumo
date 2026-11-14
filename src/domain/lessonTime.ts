import type {Lesson} from './models';

export function lessonElapsedSeconds(lesson:Lesson,now=Date.now()){
 const savedSeconds=typeof lesson.actualSeconds==='number'&&Number.isFinite(lesson.actualSeconds)
  ?Math.max(0,Math.floor(lesson.actualSeconds))
  :Math.max(0,Math.floor((lesson.actualDuration||0)*60));
 const startedAt=lesson.timerStartedAt?Date.parse(lesson.timerStartedAt):NaN;
 return savedSeconds+(Number.isFinite(startedAt)?Math.max(0,Math.floor((now-startedAt)/1000)):0);
}

export function pauseLessonTimer(lesson:Lesson,now=Date.now()):Lesson{
 const actualSeconds=lessonElapsedSeconds(lesson,now);
 return{...lesson,actualSeconds,actualDuration:Math.floor(actualSeconds/60),timerStartedAt:undefined};
}
