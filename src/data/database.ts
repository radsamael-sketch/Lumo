
import Dexie, { type Table } from 'dexie';

import type {
    AppSetting,
    Exercise,
    ExerciseAttempt,
    GrammarTopic,
    Lesson,
    Note,
    PackRecord,
    Review,
    Source,
    TestSession,
    Word
} from '../domain/models';

class LumoDatabase extends Dexie {
  lessons!: Table<Lesson, string>;
  sources!: Table<Source, string>;
  words!: Table<Word, string>;
  reviews!: Table<Review, string>;
  grammarTopics!: Table<GrammarTopic, string>;
  exercises!: Table<Exercise, string>;
  attempts!: Table<ExerciseAttempt, string>;
  tests!: Table<TestSession, string>;
  notes!: Table<Note, string>;
  settings!: Table<AppSetting, string>;
  packs!: Table<PackRecord, string>;

  constructor() {
    super('lumo-local');

    this.version(1).stores({
      lessons: 'id,date,status,updatedAt',
      sources: 'id,title,type',
      words: 'id,term,translation,status,nextReviewAt',
      reviews: 'id,wordId,reviewedAt',
      grammarTopics: 'id,title,updatedAt',
      exercises: 'id,topicId,type,updatedAt',
      attempts: 'id,exerciseId,createdAt,testSessionId',
      tests: 'id,startedAt,completedAt',
      notes: 'id,title,topicId,lessonId',
      settings: 'key',
      packs: 'id,packId,version'
    });

    // Version 2: restore missing vocabulary defaults.
    // Existing review dates and learning progress are preserved.
    this.version(2)
      .stores({
        lessons: 'id,date,status,updatedAt',
        sources: 'id,title,type',
        words: 'id,term,translation,status,nextReviewAt',
        reviews: 'id,wordId,reviewedAt',
        grammarTopics: 'id,title,updatedAt',
        exercises: 'id,topicId,type,updatedAt',
        attempts: 'id,exerciseId,createdAt,testSessionId',
        tests: 'id,startedAt,completedAt',
        notes: 'id,title,topicId,lessonId',
        settings: 'key',
        packs: 'id,packId,version'
      })
      .upgrade(async transaction => {
        await transaction
          .table('words')
          .toCollection()
          .modify((word: Word) => {
            if (!word.status) {
              word.status = 'new';
            }

            if (
              typeof word.reviewIntervalDays !== 'number' ||
              !Number.isFinite(word.reviewIntervalDays)
            ) {
              word.reviewIntervalDays = 0;
            }
          });
      });
  }
}

export const db = new LumoDatabase();
