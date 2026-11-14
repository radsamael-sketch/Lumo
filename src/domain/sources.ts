import type {Lesson,Source} from './models';

export const SOURCE_TYPE_OPTIONS=['website','video','article','document','book','podcast','course','other'] as const;

const sourceTypeLabels:Record<string,[string,string]>={
 website:['Сайт','Website'],
 video:['Видео','Video'],
 article:['Статья','Article'],
 document:['Документ','Document'],
 book:['Книга','Book'],
 podcast:['Подкаст','Podcast'],
 course:['Курс','Course'],
 other:['Другое','Other'],
};

export function normalizeSourceDraft(draft:Pick<Source,'title'|'type'|'url'|'description'>){
 const title=draft.title.trim();
 const type=draft.type.trim();
 const url=draft.url?.trim()||'';
 const description=draft.description?.trim()||'';
 if(!title)throw new Error('TITLE_REQUIRED');
 if(!type)throw new Error('TYPE_REQUIRED');
 if(url){
  let parsed:URL;
  try{parsed=new URL(url);}catch{throw new Error('URL_INVALID');}
  if((parsed.protocol!=='http:'&&parsed.protocol!=='https:')||!parsed.hostname)throw new Error('URL_INVALID');
 }
 return {title,type,url:url||undefined,description:description||undefined};
}

export function sourceTypeLabel(type:string,lang:'ru'|'en'):string{
 return sourceTypeLabels[type.trim().toLowerCase()]?.[lang==='ru'?0:1]||type;
}

export function sourceMatches(source:Source,query:string,typeFilter=''):boolean{
 const term=query.trim().toLocaleLowerCase();
 const matchesQuery=!term||[source.title,source.type,source.description,source.url].some(value=>value?.toLocaleLowerCase().includes(term));
 return matchesQuery&&(!typeFilter||source.type===typeFilter);
}

export function detachSourceReference(lesson:Lesson,sourceId:string):Lesson{
 return lesson.sourceId===sourceId?{...lesson,sourceId:undefined}:lesson;
}
