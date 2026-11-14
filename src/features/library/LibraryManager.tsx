import {useMemo,useState,type FormEvent} from 'react';
import {BookMarked,ExternalLink,Edit3,Plus,Search,Trash2,X} from 'lucide-react';
import type {Lesson,Source} from '../../domain/models';
import {repo} from '../../data/repository';
import {normalizeSourceDraft,SOURCE_TYPE_OPTIONS,sourceMatches,sourceTypeLabel} from '../../domain/sources';
import '../../styles/library.css';

type Props={sources:Source[];lessons:Lesson[];lang:'ru'|'en';refresh:()=>Promise<void>};
type SourceForm={id?:string;title:string;type:string;url:string;description:string};

const emptyForm:SourceForm={title:'',type:'website',url:'',description:''};

export function LibraryManager({sources,lessons,lang,refresh}:Props){
 const ru=lang==='ru',t=(a:string,b:string)=>ru?a:b;
 const [form,setForm]=useState<SourceForm|null>(null),[query,setQuery]=useState(''),[typeFilter,setTypeFilter]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const types=useMemo(()=>[...new Set(sources.map(source=>source.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,ru?'ru':'en')),[sources,ru]);
 const filtered=useMemo(()=>sources.filter(source=>sourceMatches(source,query,typeFilter)),[sources,query,typeFilter]);
 const edit=(source?:Source)=>{setForm(source?{id:source.id,title:source.title,type:source.type,url:source.url||'',description:source.description||''}:{...emptyForm});setError('');setNotice('');};
 const save=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(!form||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const fields=normalizeSourceDraft(form);
   await repo.sources.save({...fields,id:form.id});
   await refresh();setForm(null);setNotice(t('Материал сохранён.','Material saved.'));
  }catch(reason){
   const message=reason instanceof Error?reason.message:'';
   setError(message==='TITLE_REQUIRED'?t('Укажи название материала.','Enter a material title.'):message==='TYPE_REQUIRED'?t('Укажи тип материала.','Enter a material type.'):message==='URL_INVALID'?t('Ссылка должна быть корректным адресом HTTP или HTTPS.','Enter a valid HTTP or HTTPS URL.'):t('Не удалось сохранить материал.','Could not save the material.'));
  }finally{setBusy(false);}
 };
 const remove=async(source:Source)=>{
  const linked=lessons.filter(lesson=>lesson.sourceId===source.id);
  const message=linked.length
   ?t(`Удалить «${source.title}»? Ссылка будет снята с ${linked.length} урок(ов); сами уроки и их история останутся.`,`Delete “${source.title}”? Its link will be removed from ${linked.length} lesson(s); the lessons and their history will remain.`)
   :t(`Удалить материал «${source.title}»?`,`Delete “${source.title}”?`);
  if(!window.confirm(message))return;
  setError('');setNotice('');
  try{
   const detached=await repo.sources.remove(source.id);
   await refresh();
   setNotice(detached?t(`Материал удалён; ссылка снята с ${detached} урок(ов).`,`Material deleted; its link was removed from ${detached} lesson(s).`):t('Материал удалён.','Material deleted.'));
  }catch(reason){setError((reason instanceof Error?reason.message:'')||t('Не удалось удалить материал.','Could not delete the material.'));}
 };
 return <section className="panel library-panel">
  <div className="panel-heading"><div><p className="eyebrow">{t('УЧЕБНЫЕ МАТЕРИАЛЫ','LEARNING MATERIALS')}</p><h2>{t('Библиотека материалов','Learning library')}</h2></div><button className="small-primary" onClick={()=>edit()}><Plus size={15}/>{t('Добавить материал','Add material')}</button></div>
  {notice&&<p className="library-notice" role="status">{notice}</p>}
  {error&&<p className="library-error" role="alert">{error}</p>}
  {form&&<form className="library-form" onSubmit={event=>void save(event)}>
   <div className="library-form-heading"><b>{form.id?t('Редактировать материал','Edit material'):t('Новый материал','New material')}</b><button type="button" className="icon-button" aria-label={t('Закрыть форму','Close form')} onClick={()=>{setForm(null);setError('')}}><X size={15}/></button></div>
   <label>{t('Название','Title')}<input autoFocus required value={form.title} onChange={event=>setForm({...form,title:event.target.value})} placeholder={t('Например, English Flow','For example, English Flow')}/></label>
   <div className="library-form-grid">
    <label>{t('Тип материала','Material type')}<input list="library-source-types" required value={form.type} onChange={event=>setForm({...form,type:event.target.value})} placeholder={t('Выбери или введи тип','Choose or enter a type')}/><datalist id="library-source-types">{SOURCE_TYPE_OPTIONS.map(type=><option key={type} value={type}/>)}</datalist></label>
    <label>{t('Ссылка','Link')}<input inputMode="url" value={form.url} onChange={event=>setForm({...form,url:event.target.value})} placeholder="https://…"/></label>
   </div>
   <label>{t('Тема / описание','Topic / description')}<textarea rows={2} value={form.description} onChange={event=>setForm({...form,description:event.target.value})} placeholder={t('Тема, заметка или краткое описание','Topic, note, or short description')}/></label>
   <p className="library-form-hint">{t('English Flow остаётся внешним ресурсом: добавь ссылку вручную — она откроется в новой вкладке.','English Flow remains an external resource: add its link manually and it will open in a new tab.')}</p>
   <div className="library-form-actions"><button type="button" className="small-secondary" disabled={busy} onClick={()=>{setForm(null);setError('')}}>{t('Отмена','Cancel')}</button><button type="submit" className="primary" disabled={busy}>{busy?t('Сохранение…','Saving…'):t('Сохранить','Save')}</button></div>
  </form>}
  <div className="library-controls">
   <label className="library-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={t('Поиск по названию, типу, теме или ссылке','Search title, type, topic, or link')}/></label>
   <label className="library-type-filter">{t('Тип','Type')}<select value={typeFilter} onChange={event=>setTypeFilter(event.target.value)}><option value="">{t('Все типы','All types')}</option>{types.map(type=><option key={type} value={type}>{sourceTypeLabel(type,lang)}</option>)}</select></label>
  </div>
  <div className="library-list">
   {filtered.map(source=><article className="library-item" key={source.id}>
    <BookMarked size={18} className="library-icon"/>
    <div className="library-item-content"><div className="library-item-title"><b>{source.title}</b><span>{sourceTypeLabel(source.type,lang)}</span></div>{source.description&&<small>{source.description}</small>}{source.url&&<a href={source.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>{t('Открыть','Open')}</a>}</div>
    <div className="library-item-actions"><button className="icon-button" title={t('Редактировать','Edit')} aria-label={t('Редактировать','Edit')} onClick={()=>edit(source)}><Edit3 size={15}/></button><button className="icon-button" title={t('Удалить','Delete')} aria-label={t('Удалить','Delete')} onClick={()=>void remove(source)}><Trash2 size={15}/></button></div>
   </article>)}
   {!sources.length&&<div className="empty-state"><p>{t('Добавь учебник, сайт, видео или другой источник.','Add a textbook, website, video or another resource.')}</p></div>}
   {!!sources.length&&!filtered.length&&<div className="empty-state"><p>{t('Материалы не найдены. Измени поиск или фильтр.','No materials found. Adjust your search or filter.')}</p></div>}
  </div>
 </section>;
}
