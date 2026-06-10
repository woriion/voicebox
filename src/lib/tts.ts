// Tiny wrapper around the browser's built-in speech synthesis.
// No network call, no API key — runs entirely in the browser.

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  } catch {
    // Silently fail — TTS is non-critical.
  }
}
