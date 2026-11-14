export type SpeechAvailability = 'unsupported' | 'ready' | 'no-english-voice' | 'error';
export type SpeechResult = 'started' | 'unsupported' | 'no-english-voice' | 'error';

let latestRequest = 0;

export function selectEnglishVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const englishVoices = voices.filter(voice => /^en(?:-|$)/i.test(voice.lang.replace(/_/g, '-')));
  return englishVoices.find(voice => voice.lang.replace(/_/g, '-').toLowerCase().startsWith('en-us')) ??
    englishVoices[0] ??
    null;
}

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined' ||
      typeof window.speechSynthesis === 'undefined') return null;
  return window.speechSynthesis;
}

export function speechAvailability(): SpeechAvailability {
  const synthesis = getSpeechSynthesis();
  if (!synthesis) return 'unsupported';
  try {
    const voices = synthesis.getVoices();
    return selectEnglishVoice(voices) ? 'ready' : 'no-english-voice';
  } catch {
    return 'error';
  }
}

export function speakEnglish(text: string, onError?: () => void): SpeechResult {
  const synthesis = getSpeechSynthesis();
  if (!synthesis) return 'unsupported';

  const request = ++latestRequest;
  let voice: SpeechSynthesisVoice | null;
  try {
    synthesis.cancel();
    voice = selectEnglishVoice(synthesis.getVoices());
  } catch {
    onError?.();
    return 'error';
  }
  if (!voice) return 'no-english-voice';

  try {
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.voice = voice;
    utterance.lang = voice.lang || 'en-US';
    utterance.onerror = () => {
      if (request === latestRequest) onError?.();
    };
    synthesis.speak(utterance);
    return 'started';
  } catch {
    onError?.();
    return 'error';
  }
}
