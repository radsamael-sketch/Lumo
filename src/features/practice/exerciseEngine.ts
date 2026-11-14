import type {Exercise} from '../../domain/models';

export type ExerciseKind='multiple-choice'|'fill-blanks'|'matching'|'word-ordering';
export type ChoicePayload={prompt:string;options:{id:string;text:string}[];correctOptionId:string};
export type BlankPayload={prompt:string;expected:string;accepted:string[]};
export type MatchingPayload={prompt:string;left:{id:string;text:string}[];right:{id:string;text:string}[];pairs:{leftId:string;rightId:string}[]};
export type OrderingPayload={prompt:string;tokens:{id:string;text:string}[];correctOrder:string[]};
export type ExercisePayload=ChoicePayload|BlankPayload|MatchingPayload|OrderingPayload;
export type ExerciseAnswer=string|Record<string,string>|string[];

export function checkAnswer(exercise:Exercise,answer:ExerciseAnswer):boolean{
 const p=exercise.payload as ExercisePayload;
 if(exercise.type==='multiple-choice')return typeof answer==='string'&&answer===(p as ChoicePayload).correctOptionId;
 if(exercise.type==='fill-blanks'){
  const a=String(answer??'').trim().replace(/[.!?]+$/,'').toLocaleLowerCase();
  const b=p as BlankPayload;return [b.expected,...b.accepted].some(x=>x.trim().replace(/[.!?]+$/,'').toLocaleLowerCase()===a);
 }
 if(exercise.type==='matching'){
  const a=answer as Record<string,string>;const b=p as MatchingPayload;
  return b.pairs.length===Object.keys(a||{}).length&&b.pairs.every(x=>a?.[x.leftId]===x.rightId);
 }
 const a=answer as string[];const b=p as OrderingPayload;
 return Array.isArray(a)&&a.length===b.correctOrder.length&&a.every((x,i)=>x===b.correctOrder[i]);
}
export function formatAnswer(exercise:Exercise,answer:ExerciseAnswer):string{
 const p=exercise.payload as ExercisePayload;
 if(exercise.type==='multiple-choice')return (p as ChoicePayload).options.find(x=>x.id===answer)?.text||'';
 if(exercise.type==='fill-blanks')return String(answer||'');
 if(exercise.type==='matching')return Object.entries(answer as Record<string,string>).map(([l,r])=>`${(p as MatchingPayload).left.find(x=>x.id===l)?.text} → ${(p as MatchingPayload).right.find(x=>x.id===r)?.text}`).join('; ');
 return (answer as string[]).map(id=>(p as OrderingPayload).tokens.find(x=>x.id===id)?.text||'').join(' ');
}
export function correctAnswerText(exercise:Exercise):string{
 const p=exercise.payload as ExercisePayload;
 if(exercise.type==='multiple-choice')return (p as ChoicePayload).options.find(x=>x.id===(p as ChoicePayload).correctOptionId)?.text||'';
 if(exercise.type==='fill-blanks')return (p as BlankPayload).expected;
 if(exercise.type==='matching')return (p as MatchingPayload).pairs.map(x=>`${(p as MatchingPayload).left.find(y=>y.id===x.leftId)?.text} → ${(p as MatchingPayload).right.find(y=>y.id===x.rightId)?.text}`).join('; ');
 return (p as OrderingPayload).correctOrder.map(id=>(p as OrderingPayload).tokens.find(x=>x.id===id)?.text||'').join(' ');
}
