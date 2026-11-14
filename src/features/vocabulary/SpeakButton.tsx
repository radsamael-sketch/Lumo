import {useEffect,useState} from 'react';
import {Volume2} from 'lucide-react';
import {speechAvailability,speakEnglish,type SpeechAvailability} from '../../domain/speech';

type Props={text:string;lang:'ru'|'en'};

export function SpeakButton({text,lang}:Props){
 const [availability,setAvailability]=useState<SpeechAvailability>(speechAvailability),[error,setError]=useState(false);
 const ru=lang==='ru';

 useEffect(()=>{
  if(typeof window==='undefined'||typeof window.speechSynthesis==='undefined')return;
  const synthesis=window.speechSynthesis;
  const updateAvailability=()=>setAvailability(speechAvailability());
  synthesis.addEventListener('voiceschanged',updateAvailability);
  updateAvailability();
  return()=>synthesis.removeEventListener('voiceschanged',updateAvailability);
 },[]);

 if(availability==='unsupported'||!text.trim())return null;
 const disabled=availability!=='ready';
 const title=availability==='no-english-voice'
   ?ru?'В браузере нет английского голоса':'No English voice is available'
   :availability==='error'
    ?ru?'Озвучивание недоступно':'Speech is unavailable'
    :ru?`Произнести: ${text}`:`Speak: ${text}`;

 const speak=()=>{
  setError(false);
  const result=speakEnglish(text,()=>setError(true));
  if(result==='unsupported')setAvailability('unsupported');
  else if(result==='no-english-voice')setAvailability('no-english-voice');
  else if(result==='error')setError(true);
 };

 return <span className="speech-control">
  <button type="button" className="icon-button speech-button" disabled={disabled} title={title} aria-label={title} onClick={event=>{event.stopPropagation();speak();}}>
   <Volume2 size={15} aria-hidden="true"/>
  </button>
  {error&&<small className="speech-feedback" role="status">{ru?'Не удалось воспроизвести произношение.':'Could not play pronunciation.'}</small>}
 </span>;
}
