import {useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,Clock3,ExternalLink,Pause,Play,RotateCcw,Save,X} from 'lucide-react';
import {db} from '../../data/database';
import type {Lesson,Source} from '../../domain/models';
import {repo} from '../../data/repository';
import {lessonElapsedSeconds,pauseLessonTimer} from '../../domain/lessonTime';
type Props={lesson:Lesson;sources:Source[];lang:'ru'|'en';onClose:()=>void;refresh:()=>Promise<void>};
const format=(seconds:number)=>`${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
export function LessonDetail({lesson,sources,lang,onClose,refresh}:Props){
 const ru=lang==='ru',t=(a:string,b:string)=>ru?a:b;
 const [notes,setNotes]=useState(lesson.notes||''),[description,setDescription]=useState(lesson.description||''),[sourceId,setSourceId]=useState(lesson.sourceId||''),[url,setUrl]=useState(lesson.url||''),[saving,setSaving]=useState(false),[actionError,setActionError]=useState(''),[tick,setTick]=useState(Date.now());
 const actionLock=useRef(false);
 const lessonDate=new Date(`${lesson.date}T12:00:00`).toLocaleDateString(ru?'ru-RU':'en-US',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 const started=lesson.timerStartedAt?new Date(lesson.timerStartedAt).getTime():0;
 const elapsed=lessonElapsedSeconds(lesson,tick);
 useEffect(()=>{setNotes(lesson.notes||'');setDescription(lesson.description||'');setUrl(lesson.url||'');},[lesson.id]);
 useEffect(()=>{setSourceId(lesson.sourceId||'');},[lesson.id,lesson.sourceId]);
 useEffect(()=>{if(!started)return;const id=window.setInterval(()=>setTick(Date.now()),1000);return()=>clearInterval(id);},[started]);
 const source=useMemo(()=>sources.find(s=>s.id===sourceId),[sources,sourceId]);
 const runAction=async(action:()=>Promise<void>)=>{
  if(actionLock.current)return;
  actionLock.current=true;setSaving(true);setActionError('');
  try{await action();}
  catch(error){setActionError(error instanceof Error?error.message:t('Не удалось сохранить изменения занятия.','Could not save lesson changes.'));}
  finally{actionLock.current=false;setSaving(false);}
 };
 const save=()=>runAction(async()=>{const current=await db.lessons.get(lesson.id);await repo.lessons.save({...lesson,...current,notes,description,sourceId:sourceId||undefined,url:url.trim()||undefined});await refresh();});
 const toggle=()=>runAction(async()=>{if(started){await repo.lessons.save({...pauseLessonTimer(lesson),status:lesson.status==='planned'?'in-progress':lesson.status});}else{await repo.lessons.save({...lesson,timerStartedAt:new Date().toISOString(),status:lesson.status==='planned'?'in-progress':lesson.status});}await refresh();});
 const reset=()=>runAction(async()=>{if(!window.confirm(t('Сбросить всё фактическое время этого занятия?','Reset all tracked time for this lesson?')))return;await repo.lessons.save({...lesson,actualSeconds:0,actualDuration:0,timerStartedAt:undefined});await refresh();});
 const markCompleted=()=>runAction(async()=>{const updated=started?pauseLessonTimer(lesson):lesson;await repo.lessons.save({...updated,status:'completed'});await refresh();});
 return <section className="panel lesson-detail"><div className="panel-heading"><div><p className="eyebrow">{t('ЗАНЯТИЕ','LESSON')}</p><h2>{lesson.title}</h2><p className="lesson-detail-meta">{lessonDate}{lesson.time?` · ${lesson.time}`:''} · {lesson.duration} {t('мин. по плану','min planned')}</p></div><button className="icon-button" onClick={onClose} aria-label={t('Закрыть','Close')}><X size={17}/></button></div>
 <div className="lesson-detail-grid"><div className="lesson-timer"><p className="eyebrow">{t('ФАКТИЧЕСКОЕ ВРЕМЯ','ACTUAL STUDY TIME')}</p><strong>{format(elapsed)}</strong><small>{started?t('Таймер запущен','Timer running'):t('Время сохранено','Time saved')}</small><div className="timer-actions"><button className="primary" disabled={saving} onClick={()=>void toggle()}>{started?<Pause size={16}/>:<Play size={16}/>} {started?t('Пауза','Pause'):t('Начать','Start')}</button><button className="icon-button" disabled={saving} onClick={()=>void reset()} title={t('Сбросить время','Reset time')} aria-label={t('Сбросить время','Reset time')}><RotateCcw size={16}/></button></div><button className="text-button" disabled={saving} onClick={()=>void markCompleted()}>{t('Отметить занятие завершённым','Mark lesson as completed')}</button></div>
 <div className="lesson-material"><label>{t('Учебный материал','Learning material')}<select value={sourceId} onChange={e=>setSourceId(e.target.value)}><option value="">{t('Не выбран','None selected')}</option>{sources.map(s=><option value={s.id} key={s.id}>{s.title}</option>)}</select></label>{source?.url&&<a href={source.url} target="_blank" rel="noopener noreferrer"><BookOpen size={15}/>{t('Открыть материал','Open material')} <ExternalLink size={13}/></a>}<label>{t('Ссылка / English Flow','URL / English Flow')}<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></label>{url&&/^https?:\/\//i.test(url)&&<a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>{t('Открыть ссылку','Open link')}</a>}<label>{t('Описание и задачи','Description & goals')}<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3}/></label></div></div>
 {actionError&&<p className="library-error" role="alert">{actionError}</p>}<label className="lesson-notes-label">{t('Заметки по занятию','Lesson notes')}<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={5} placeholder={t('Что разобрали, что было сложно, что повторить…','What you covered, what was difficult, what to revisit…')}/></label><div className="lesson-detail-footer"><span><Clock3 size={14}/> {Math.floor(elapsed/60)} {t('минут учтено','minutes tracked')}</span><button className="primary" disabled={saving} onClick={()=>void save()}><Save size={15}/>{saving?t('Сохранение…','Saving…'):t('Сохранить изменения','Save changes')}</button></div></section>;
}
