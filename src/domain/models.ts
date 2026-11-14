export type LessonStatus='planned'|'in-progress'|'completed'|'skipped';
export interface Lesson {id:string;title:string;topic:string;date:string;time?:string;duration:number;actualDuration:number;actualSeconds?:number;timerStartedAt?:string;status:LessonStatus;sourceId?:string;url?:string;description?:string;notes?:string;result?:string;seriesId?:string;recurrence?:'daily'|'weekly';weekdays?:number[];occurrenceDate?:string;createdAt:string;updatedAt:string}
export interface Source {id:string;title:string;type:string;url?:string;description?:string;createdAt:string;updatedAt:string}
export interface Word {id:string;term:string;translation:string;transcription?:string;context?:string;example?:string;status:'new'|'learning'|'learned';reviewIntervalDays:number;nextReviewAt?:string;createdAt:string;updatedAt:string}
export interface Review {id:string;wordId:string;result:'known'|'again';reviewedAt:string;intervalDays:number}
export interface GrammarTopic {id:string;title:string;description?:string;theory?:string;examples?:string;notes?:string;createdAt:string;updatedAt:string}
export interface Exercise {id:string;topicId?:string;title:string;type:string;payload:unknown;explanation?:string;version:number;createdAt:string;updatedAt:string}
export interface ExerciseAttempt {id:string;exerciseId:string;correct:boolean;answer:unknown;snapshot:unknown;createdAt:string;testSessionId?:string}
export interface TestSession {id:string;title:string;exerciseIds:string[];startedAt:string;completedAt?:string;totalQuestions:number;correctAnswers:number}
export interface Note {id:string;title:string;text:string;topicId?:string;lessonId?:string;createdAt:string;updatedAt:string}
export interface AppSetting {key:string;value:unknown}
export interface PackRecord {id:string;packId:string;version:string;title:string;payload:unknown;importedAt:string}
