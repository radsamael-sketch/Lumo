import Dexie, {type Table} from 'dexie';
import type {Lesson,Source,Word,Review,GrammarTopic,Exercise,ExerciseAttempt,TestSession,Note,AppSetting,PackRecord} from '../domain/models';
class LumoDatabase extends Dexie {
 lessons!:Table<Lesson,string>; sources!:Table<Source,string>; words!:Table<Word,string>; reviews!:Table<Review,string>; grammarTopics!:Table<GrammarTopic,string>; exercises!:Table<Exercise,string>; attempts!:Table<ExerciseAttempt,string>; tests!:Table<TestSession,string>; notes!:Table<Note,string>; settings!:Table<AppSetting,string>; packs!:Table<PackRecord,string>;
 constructor(){super('lumo-local');this.version(1).stores({lessons:'id,date,status,updatedAt',sources:'id,title,type',words:'id,term,translation,status,nextReviewAt',reviews:'id,wordId,reviewedAt',grammarTopics:'id,title,updatedAt',exercises:'id,topicId,type,updatedAt',attempts:'id,exerciseId,createdAt,testSessionId',tests:'id,startedAt,completedAt',notes:'id,title,topicId,lessonId',settings:'key',packs:'id,packId,version'});}
}
export const db=new LumoDatabase();
