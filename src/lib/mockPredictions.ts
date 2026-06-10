// MOCKUP DATA — Replace this module with your real model output.
// The model predicts a whole sentence. Some tokens may be "blanks"
// (the model heard mouth movement but couldn't lock a word). Each
// token carries a list of similar candidate words the user may have
// intended.

export type SentenceToken = {
  // The model's best guess. `null` means the model couldn't decide
  // (render as a fill-in-the-blank that the user can resolve).
  word: string | null;
  // Other words the user may have intended for this slot.
  alternatives: string[];
};

export type SentencePrediction = {
  tokens: SentenceToken[];
};

export const MOCK_SENTENCES: SentencePrediction[] = [
  {
    tokens: [
      { word: "I",      alternatives: ["I'd", "I'll", "I've"] },
      { word: "need",   alternatives: ["want", "knead", "kneed"] },
      { word: null,     alternatives: ["some", "more", "a", "the"] },
      { word: "water",  alternatives: ["waiter", "winter", "wider"] },
      { word: "please", alternatives: ["peace", "pleas", "police"] },
    ],
  },
  {
    tokens: [
      { word: "Can",    alternatives: ["Could", "Cans", "Kan"] },
      { word: "you",    alternatives: ["yo", "ya", "u"] },
      { word: "help",   alternatives: ["hold", "held", "hope"] },
      { word: "me",     alternatives: ["my", "mean", "may"] },
      { word: null,     alternatives: ["please", "now", "today"] },
    ],
  },
  {
    tokens: [
      { word: "Thanks", alternatives: ["Thank", "Tanks", "Thinks"] },
      { word: "for",   alternatives: ["four", "fore", "far"] },
      { word: "your",  alternatives: ["you", "you're", "yore"] },
      { word: null,    alternatives: ["help", "time", "patience"] },
    ],
  },
];

export function getSentenceAt(index: number): SentencePrediction {
  return MOCK_SENTENCES[index % MOCK_SENTENCES.length];
}

// Frequently-used words for the Quick Selection panel.
// Later, derive this from per-user usage counts.
export const QUICK_SELECTION: string[] = [
  "Yes",
  "No",
  "Thanks",
  "Help",
  "Water",
  "More",
  "Please",
  "Stop",
];
