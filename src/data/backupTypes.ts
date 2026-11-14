import type {AppSetting,Exercise,ExerciseAttempt,GrammarTopic,Lesson,Note,PackRecord,Review,Source,TestSession,Word} from '../domain/models';
export interface LumoBackupTables {
  lessons: Lesson[]; sources: Source[]; words: Word[]; reviews: Review[];
  grammarTopics: GrammarTopic[]; exercises: Exercise[]; attempts: ExerciseAttempt[];
  tests: TestSession[]; notes: Note[]; settings: AppSetting[]; packs: PackRecord[];
}
