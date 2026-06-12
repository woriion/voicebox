// Tiny wrapper around the browser's built-in speech synthesis.
// No network call, no API key — runs entirely in the browser.

function pickVoice(voices: SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const preferredMaleNames = [
    "david",
    "mark",
    "guy",
    "george",
    "daniel",
    "james",
    "alex",
    "fred",
  ];

  return (
    englishVoices.find((voice) => {
      const name = voice.name.toLowerCase();
      return preferredMaleNames.some((preferred) => name.includes(preferred));
    }) ?? englishVoices[0]
  );
}

export function speak(text: string, onEnd?: () => void, onError?: () => void): boolean {
  if (!text.trim()) {
    onError?.();
    return false;
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onError?.();
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.volume = 1;
    const voice = pickVoice(window.speechSynthesis.getVoices());
    if (voice) utter.voice = voice;
    if (onEnd) {
      utter.onend = () => {
        onEnd();
      };
    }
    utter.onerror = () => {
      onError?.();
    };
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    onError?.();
    return false;
  }
}
