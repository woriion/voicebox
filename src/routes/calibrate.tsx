import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Check, ArrowRight, ArrowLeft, Sparkles, Square, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/calibrate")({
  head: () => ({
    meta: [
      { title: "Calibrate — VoiceBox" },
      {
        name: "description",
        content:
          "Record a few mouth-movement samples so VoiceBox can personalize predictions to you.",
      },
    ],
  }),
  component: CalibratePage,
});

// Step 1 — a compact set of words chosen to cover the major viseme groups
// (lip-rounding, bilabials, fricatives, dentals, velars, open vowels, etc.).
// Mouthing these gives the model broad coverage without slogging through
// every single letter.
const CORE_WORDS = [
  "Pop",      // bilabial /p/, rounded vowel
  "Five",     // labiodental /f/, /v/, long /aɪ/
  "Thanks",   // dental /θ/, nasal, /æ/
  "Shoe",     // postalveolar /ʃ/, rounded /uː/
  "Light",    // lateral /l/, diphthong /aɪ/, /t/
  "Cake",     // velar /k/, mid /eɪ/
  "Red",      // rhotic /r/, /ɛ/, /d/
  "Mom",      // bilabial nasal /m/, open /ɒ/
];

// Letters whose visemes are easily confused / commonly need a second pass.
// We mock "low-confidence" detection by surfacing a subset after step 1.
const TRICKY_LETTERS = ["B", "P", "M", "F", "V", "S", "Z", "T", "D", "N"];

type Phase = "core" | "decide" | "letters" | "done";

function CalibratePage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("core");
  const [index, setIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<string[]>([]);
  const [unclearLetters, setUnclearLetters] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const items = useMemo(
    () => (phase === "letters" ? unclearLetters : CORE_WORDS),
    [phase, unclearLetters],
  );
  const current = items[index];

  useEffect(() => {
    if (recording) {
      setElapsed(0);
      tickRef.current = setInterval(() => setElapsed((e) => e + 0.1), 100);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [recording]);

  function startRecording() {
    setRecording(true);
  }

  function stopRecording() {
    setRecording(false);
    setRecorded((r) => [...r, `${phase}:${current}`]);
    if (index < items.length - 1) {
      setIndex((i) => i + 1);
    } else {
      if (phase === "core") {
        const pool = [...TRICKY_LETTERS].sort(() => Math.random() - 0.5);
        setUnclearLetters(pool.slice(0, 5));
        setPhase("decide");
      } else if (phase === "letters") {
        setPhase("done");
      }
    }
  }

  function goBack() {
    if (recording) setRecording(false);
    if (index > 0) {
      setIndex((i) => i - 1);
      // Drop the last recorded sample for this phase so retake feels clean.
      setRecorded((r) => r.slice(0, -1));
    }
  }

  function startLetters() {
    setPhase("letters");
    setIndex(0);
  }

  function finish(message: string) {
    toast.success(message);
    navigate({ to: "/profile", replace: true });
  }

  const stepLabel =
    phase === "core"
      ? `Step 1 · Core words ${index + 1}/${CORE_WORDS.length}`
      : phase === "letters"
      ? `Step 2 · Letter follow-up ${index + 1}/${unclearLetters.length}`
      : phase === "decide"
      ? "Step 1 complete"
      : "All done";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6">
        <header className="flex items-center justify-between pt-7">
          <Link to="/" className="text-sm font-semibold tracking-tight hover:opacity-70">
            VoiceBox
          </Link>
          <Link to="/profile" className="text-sm font-medium text-muted-foreground">
            Exit
          </Link>
        </header>

        <main className="flex flex-1 flex-col py-8">
          <div className="mb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {stepLabel}
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {phase === "core" && "Mouth a few core words"}
              {phase === "decide" && "A few letters to clean up"}
              {phase === "letters" && "Mouth these letters"}
              {phase === "done" && "You're all set"}
            </h1>
            <p className="mt-2 text-pretty text-sm text-muted-foreground">
              {phase === "core" &&
                "Just a handful of words — they're chosen to cover most of the mouth shapes VoiceBox needs to learn you."}
              {phase === "decide" &&
                "From step 1, a few letters came through with low confidence. Record just those so the model can tell them apart."}
              {phase === "letters" &&
                "Say each letter naturally. These are the ones the model wasn't sure about."}
              {phase === "done" &&
                "Your samples are saved. VoiceBox will use them to personalize predictions."}
            </p>
          </div>

          {phase !== "decide" && phase !== "done" && (
            <>
              {/* Progress */}
              <div className="mb-6 flex gap-1.5">
                {items.map((w, i) => (
                  <div
                    key={w + i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i <= index - 1 || (i === index && recording)
                        ? "bg-primary"
                        : "bg-surface"
                    }`}
                  />
                ))}
              </div>

              {/* Camera frame */}
              <div className="relative mx-auto aspect-square w-full">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-surface ring-1 ring-border">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Mic className={`size-10 ${recording ? "text-accent" : ""}`} />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.15em]">
                      {recording ? `Recording… ${elapsed.toFixed(1)}s` : "Ready"}
                    </span>
                  </div>
                </div>
                <div
                  className={`pointer-events-none absolute inset-0 m-8 rounded-2xl border-2 ${
                    recording ? "border-accent" : "border-dashed border-accent/40"
                  }`}
                />
              </div>

              {/* Word / letter to say */}
              <div className="mt-6 rounded-3xl bg-card p-6 text-center shadow-sm ring-1 ring-border">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {phase === "core" ? "Mouth this word" : "Mouth this letter"}
                </span>
                <p className="mt-2 text-5xl font-semibold tracking-tight">{current}</p>
              </div>

              <div className="mt-auto flex gap-2 pt-6">
                <button
                  onClick={goBack}
                  disabled={index === 0 || recording}
                  className="flex items-center justify-center gap-1.5 rounded-2xl bg-card px-4 py-4 text-sm font-semibold ring-1 ring-border disabled:opacity-40"
                  aria-label="Retry previous"
                >
                  <ArrowLeft className="size-4" />
                </button>
                {recording ? (
                  <button
                    onClick={stopRecording}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-sm font-semibold text-accent-foreground shadow-sm"
                  >
                    <Square className="size-4 fill-current" /> Stop &amp; save
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-sm"
                  >
                    <Play className="size-4 fill-current" /> Record "{current}"
                  </button>
                )}
              </div>
            </>
          )}

          {phase === "decide" && (
            <div className="mt-2 space-y-4">
              <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
                <div className="mb-3 flex items-start gap-3">
                  <div className="rounded-xl bg-warm p-2.5">
                    <Sparkles className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">
                      Step 2 · {unclearLetters.length} letters flagged
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      VoiceBox couldn't fully tell these apart from your core words. A quick pass will sharpen letter-level predictions.
                    </p>
                  </div>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {unclearLetters.map((l) => (
                    <span
                      key={l}
                      className="rounded-lg bg-surface px-3 py-1.5 text-sm font-semibold ring-1 ring-border"
                    >
                      {l}
                    </span>
                  ))}
                </div>
                <button
                  onClick={startLetters}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-sm"
                >
                  Record these letters <ArrowRight className="size-4" />
                </button>
              </div>
              <button
                onClick={() => finish("Core profile saved.")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card py-4 text-sm font-semibold ring-1 ring-border"
              >
                <Check className="size-4" /> Save core only
              </button>
            </div>
          )}

          {phase === "done" && (
            <div className="mt-auto pt-6">
              <button
                onClick={() => finish("Personalization profile saved.")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-sm"
              >
                <Check className="size-4" /> Back to profile
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
