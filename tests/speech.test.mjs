import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/domain/speech.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022},
}).outputText;
const speech = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const voice = (lang, name=lang) => ({lang, name, default:false, voiceURI:name, localService:true});

test('prefers en-US and falls back to another English voice', () => {
  const gb = voice('en-GB');
  const us = voice('en-US');
  assert.equal(speech.selectEnglishVoice([voice('fr-FR'), gb, us]), us);
  assert.equal(speech.selectEnglishVoice([voice('fr-FR'), gb]), gb);
  assert.equal(speech.selectEnglishVoice([voice('fr-FR')]), null);
});

test('cancels the previous utterance and ignores its interruption error', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalUtterance = Object.getOwnPropertyDescriptor(globalThis, 'SpeechSynthesisUtterance');
  const utterances = [];
  const calls = [];
  const englishVoice = voice('en-US');
  class FakeUtterance {
    constructor(text) { this.text = text; utterances.push(this); }
  }
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {value:FakeUtterance, configurable:true});
  Object.defineProperty(globalThis, 'window', {value:{speechSynthesis:{
    getVoices:()=>[englishVoice],
    cancel:()=>calls.push('cancel'),
    speak:()=>{ calls.push('speak'); },
  }}, configurable:true});

  try {
    const errors = [];
    assert.equal(speech.speakEnglish('  hello  ', ()=>errors.push('first')), 'started');
    assert.equal(speech.speakEnglish('world', ()=>errors.push('second')), 'started');
    assert.deepEqual(calls, ['cancel','speak','cancel','speak']);
    assert.equal(utterances[0].text, 'hello');
    assert.equal(utterances[0].lang, 'en-US');
    assert.equal(utterances[0].voice, englishVoice);
    utterances[0].onerror();
    assert.deepEqual(errors, []);
    utterances[1].onerror();
    assert.deepEqual(errors, ['second']);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
    if (originalUtterance) Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', originalUtterance);
    else delete globalThis.SpeechSynthesisUtterance;
  }
});

test('reports unavailable speech when the API or an English voice is missing', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalUtterance = Object.getOwnPropertyDescriptor(globalThis, 'SpeechSynthesisUtterance');
  class FakeUtterance {}
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {value:FakeUtterance, configurable:true});
  Object.defineProperty(globalThis, 'window', {value:{speechSynthesis:{
    getVoices:()=>[],
    cancel:()=>{},
    speak:()=>{},
  }}, configurable:true});
  try {
    assert.equal(speech.speechAvailability(), 'no-english-voice');
    assert.equal(speech.speakEnglish('hello'), 'no-english-voice');
    Object.defineProperty(globalThis, 'window', {value:{}, configurable:true});
    assert.equal(speech.speechAvailability(), 'unsupported');
    assert.equal(speech.speakEnglish('hello'), 'unsupported');
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
    if (originalUtterance) Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', originalUtterance);
    else delete globalThis.SpeechSynthesisUtterance;
  }
});
