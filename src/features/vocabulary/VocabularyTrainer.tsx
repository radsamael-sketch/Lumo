import {useRef,useState} from 'react';
import {Check,ChevronRight,RotateCcw,Shuffle} from 'lucide-react';
import type {Word} from '../../domain/models';
import {repo,uid} from '../../data/repository';
import {isTranslationCorrect,makeClozeSentence,shuffleWords,vocabularyQueue,type VocabularyMode,type VocabularyQueueKind} from '../../domain/vocabulary';
import {SpeakButton} from './SpeakButton';

type Props={words:Word[];lang:'ru'|'en';refresh:()=>Promise<void>};
type Score={known:number;again:number};
const emptyScore:Score={known:0,again:0};

export function VocabularyTrainer({words,lang,refresh}:Props){
 const ru=lang==='ru',t=(a:string,b:string)=>ru?a:b;
 const [mode,setMode]=useState<VocabularyMode>('cards'),[session,setSession]=useState<Word[]|null>(null),[index,setIndex]=useState(0),[revealed,setRevealed]=useState(false),[answer,setAnswer]=useState(''),[checked,setChecked]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[score,setScore]=useState<Score>(emptyScore),[summary,setSummary]=useState<{score:Score;total:number}|null>(null);
 const lock=useRef(false),reviewId=useRef('');
 const due=vocabularyQueue(words,mode,'due'),newWords=vocabularyQueue(words,mode,'new'),current=session?.[index];
 const start=(kind:VocabularyQueueKind)=>{const queue=shuffleWords(vocabularyQueue(words,mode,kind));if(!queue.length)return;lock.current=false;reviewId.current=uid();setSession(queue);setIndex(0);setRevealed(false);setAnswer('');setChecked(null);setBusy(false);setError('');setScore(emptyScore);setSummary(null);};
 const finish=(result=score,total=session?.length||0)=>{setSession(null);setSummary({score:result,total});setChecked(null);setBusy(false);};
 const advance=(result=score)=>{if(!session)return;if(index+1<session.length){setIndex(index+1);setRevealed(false);setAnswer('');setChecked(null);reviewId.current=uid();}else finish(result,session.length);};
 const recordAnswer=async(word:Word,known:boolean)=>{
  if(lock.current||checked!==null)return;
  lock.current=true;setBusy(true);setError('');
  try{
   await repo.words.review(word,known,reviewId.current||uid());
   const result={known:score.known+(known?1:0),again:score.again+(known?0:1)};
   setScore(result);await refresh();
   if(mode==='cards')advance(result);else setChecked(known);
  }catch(e){setError(e instanceof Error?e.message:t('Не удалось сохранить результат.','Could not save the result.'));}
  finally{lock.current=false;setBusy(false);}
 };
 const checkInput=()=>{if(!current||checked!==null||!answer.trim())return;const expected=mode==='context'?current.term:current.translation;void recordAnswer(current,isTranslationCorrect(answer,expected));};
 const startMode=(value:VocabularyMode)=>{if(session)return;setMode(value);setSummary(null);setError('');};
 const activeCloze=current?makeClozeSentence(current.example,current.term):null;
 return <section className="panel vocabulary-trainer">
  <div className="panel-heading"><div><p className="eyebrow">{t('ТРЕНИРОВКА СЛОВ','VOCABULARY PRACTICE')}</p><h2>{t('Выбери режим','Choose a mode')}</h2></div>{session&&<button className="text-button" onClick={()=>finish()} disabled={busy}>{t('Завершить','Finish')}</button>}</div>
  <div className="vocab-mode-tabs">{([
   ['cards',t('Карточки','Cards')],
   ['translation',t('Ввод перевода','Type translation')],
   ['context',t('По контексту','Context')],
  ] as [VocabularyMode,string][]).map(([id,label])=><button key={id} className={mode===id?'active':''} disabled={!!session} onClick={()=>startMode(id)}>{label}</button>)}</div>
  {!session&&<div className="vocab-queue-controls"><div><b>{t('Очередь','Queue')}</b><small>{t('Слова без нужного перевода или примера не включаются в соответствующий режим.','Words without a required translation or example are excluded from that mode.')}</small></div><div className="vocab-queue-actions"><div className="vocab-queue-buttons"><button className="primary" disabled={!due.length} onClick={()=>start('due')}><RotateCcw size={15}/>{t('Повторить','Review')} · {due.length}</button><button className="small-secondary" disabled={!newWords.length} onClick={()=>start('new')}>{t('Новые','New')} · {newWords.length}</button></div>{(!due.length||!newWords.length)&&<div className="vocab-queue-empty" role="status">{!due.length&&<span>{t('Слов на повторение пока нет.','No words are due for review.')}</span>}{!newWords.length&&<span>{mode==='context'?t('Нет новых слов с примером, подходящим для задания по контексту.','No new words have an example suitable for a context question.'):t('Новых слов в этой очереди пока нет.','No new words in this queue yet.')}</span>}</div>}</div></div>}
  {session&&current&&<div className="vocab-session">
   <div className="vocab-session-top"><span className="eyebrow">{t('КАРТОЧКА','CARD')} {index+1} / {session.length}</span><span>{score.known+score.again} {t('ответов','answered')}</span><button className="icon-button" title={t('Перемешать оставшиеся','Shuffle remaining')} aria-label={t('Перемешать оставшиеся','Shuffle remaining')} onClick={()=>setSession(items=>items? [...items.slice(0,index+1),...shuffleWords(items.slice(index+1))]:items)}><Shuffle size={15}/></button></div>
   <div className="vocab-session-progress"><i style={{width:`${(index+1)/session.length*100}%`}}/></div>
   {mode==='cards'&&<div className={`vocab-flashcard ${revealed?'revealed':''}`}>
    {!revealed?<div className="vocab-card-face" onClick={()=>setRevealed(true)}><small>{t('АНГЛИЙСКОЕ СЛОВО','ENGLISH WORD')}</small><div className="vocab-term-row"><strong>{current.term}</strong><SpeakButton text={current.term} lang={lang}/></div><button className="vocab-card-reveal" onClick={()=>setRevealed(true)}>{t('Нажми, чтобы перевернуть','Tap to reveal')}</button></div>:<div className="vocab-card-back"><div><small>{t('ПЕРЕВОД','TRANSLATION')}</small><strong>{current.translation}</strong></div>{current.transcription&&<p className="transcription">{current.transcription}</p>}{current.example&&<p className="vocab-example">{current.example}</p>}{current.context&&<small className="context">{current.context}</small>}</div>}
   </div>}
   {mode==='translation'&&<div className="vocab-answer-panel"><div className="vocab-prompt-title"><label htmlFor="vocab-translation-answer">{t('Введи перевод слова','Type the translation for')} <b>{current.term}</b></label><SpeakButton text={current.term} lang={lang}/></div><input id="vocab-translation-answer" value={answer} disabled={checked!==null||busy} onChange={event=>setAnswer(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&checked===null)checkInput();}} placeholder={t('Твой перевод','Your translation')}/></div>}
   {mode==='context'&&<div className="vocab-answer-panel"><p className="vocab-cloze">{activeCloze}</p><label>{t('Впиши пропущенное слово','Type the missing word')}<input value={answer} disabled={checked!==null||busy} onChange={event=>setAnswer(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&checked===null)checkInput();}} placeholder={t('Английское слово','English word')}/></label></div>}
   {mode!=='cards'&&checked===null&&<button className="primary vocab-check" disabled={!answer.trim()||busy} onClick={checkInput}><Check size={15}/>{t('Проверить','Check')}</button>}
   {mode!=='cards'&&checked!==null&&<div className={`vocab-feedback ${checked?'correct':'incorrect'}`}><b>{checked?t('Верно!','Correct!'):t('Правильный ответ','Correct answer')}</b><div className="vocab-feedback-term"><strong>{current.term} — {current.translation}</strong><SpeakButton text={current.term} lang={lang}/></div>{current.transcription&&<small className="transcription">{current.transcription}</small>}{current.example&&<small>{current.example}</small>}<button className="primary" onClick={()=>advance()}>{index+1===session.length?t('Завершить','Finish'):t('Следующее слово','Next word')} <ChevronRight size={15}/></button></div>}
   {mode==='cards'&&revealed&&<div className="vocab-rating"><button className="small-secondary" disabled={busy} onClick={()=>void recordAnswer(current,false)}>{t('Повторить','Again')}</button><button className="primary" disabled={busy} onClick={()=>void recordAnswer(current,true)}>{t('Знаю','Know')} <ChevronRight size={15}/></button></div>}
   {error&&<p className="vocab-error" role="alert">{error}</p>}
  </div>}
  {summary&&<div className="vocab-summary-result"><p className="eyebrow">{t('ТРЕНИРОВКА ЗАВЕРШЕНА','SESSION COMPLETE')}</p><h3>{t('Результат','Result')}</h3><p>{summary.score.known} {t('знаю','known')} · {summary.score.again} {t('повторить','again')}</p><small>{t('Отвечено','Answered')} {summary.score.known+summary.score.again} / {summary.total}</small></div>}
 </section>;
}
