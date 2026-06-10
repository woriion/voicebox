import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  UserPlus,
  Sparkles,
  User as UserIcon,
  Globe,
  Play,
  Square,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import {
  getSentenceAt,
  type SentenceToken,
} from "@/lib/mockPredictions";
import { speak } from "@/lib/tts";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { ConsentModal } from "@/components/ConsentModal";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VoiceBox — Speak with your mouth movements" },
      {
        name: "description",
        content:
          "Tap to speak a whole sentence VoiceBox predicted from your mouth movements, or fill in any blanks.",
      },
    ],
  }),
  component: SpeakPage,
});

type Phase = "idle" | "tracking" | "predicting";

function tokensToText(tokens: SentenceToken[]): string {
  return tokens
    .map((t) => t.word ?? "___")
    .join(" ")
    .replace(/\s+([,.!?])/g, "$1");
}

function SpeakPage() {
  const { user } = useCurrentUser();
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [showCard, setShowCard] = useState(false);
  const [tokens, setTokens] = useState<SentenceToken[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase machine — driven only by explicit user actions now.
  useEffect(() => {
    const clearAll = () => {
      if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
    };

    if (phase === "idle") {
      clearAll();
      setShowCard(false);
      setEditingIdx(null);
      setTokens([]);
      return;
    }

    if (phase === "tracking") {
      // Reading mouth — no card yet, no sentence finalized.
      setShowCard(false);
      setEditingIdx(null);
      setTokens([]);
      return;
    }

    if (phase === "predicting") {
      // Lock in the candidate sentence after a short buffer.
      const next = getSentenceAt(sentenceIdx);
      setTokens(next.tokens);
      finalizeTimerRef.current = setTimeout(() => setShowCard(true), 1200);
      return () => clearAll();
    }
  }, [phase, sentenceIdx]);

  function pushRecent(text: string) {
    setRecent((r) => [text, ...r.filter((w) => w !== text)].slice(0, 6));
  }

  function endSession() {
    setPhase("idle");
    setSentenceIdx((i) => i + 1);
  }

  function handleSpeakSentence() {
    const text = tokensToText(tokens).replace(/___/g, "").replace(/\s+/g, " ").trim();
    if (!text) {
      toast("Fill in the blanks before speaking.");
      return;
    }
    speak(text);
    pushRecent(text);
    if (user) {
      supabase
        .from("phrases")
        .insert({ user_id: user.id, text, last_used_at: new Date().toISOString() })
        .then(() => {});
    }
    endSession();
  }


  function handlePickAlternative(idx: number, alt: string) {
    setTokens((prev) => prev.map((t, i) => (i === idx ? { ...t, word: alt } : t)));
    setEditingIdx(null);
  }


  const isActive = phase !== "idle";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ConsentModal />
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 pb-3 pt-7">
          <Link to="/" className="flex items-center gap-2 hover:opacity-70">
            <span className="text-lg font-semibold tracking-tight">VoiceBox</span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {user ? "Personalized" : "Guest"}
            </span>
          </Link>
          {user ? (
            <Link
              to="/profile"
              className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm ring-1 ring-border"
            >
              <UserIcon className="size-3.5" />
              Profile
            </Link>
          ) : (
            <Link
              to="/auth"
              className="rounded-full bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm ring-1 ring-border"
            >
              Log in
            </Link>
          )}
        </header>

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-2 px-6 pb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground ring-1 ring-border">
            <Globe className="size-3" /> Language: English
          </span>
        </div>

        <main className="flex flex-1 flex-col gap-5 px-6">
          {/* Camera */}
          <section>
            <div className="relative aspect-square w-full">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-surface ring-1 ring-border">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  {phase === "tracking" && <Mic className="size-12 text-accent" />}
                  {phase === "predicting" && (
                    <Loader2 className="size-12 animate-spin text-accent" />
                  )}
                  {phase === "idle" && <MicOff className="size-12" />}
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em]">
                    {phase === "tracking" && "Reading mouth"}
                    {phase === "predicting" && "Predicting…"}
                    {phase === "idle" && "Camera paused"}
                  </span>
                </div>
              </div>
              {phase === "tracking" && (
                <div className="pointer-events-none absolute inset-0 m-8 rounded-2xl border-2 border-dashed border-accent/40">
                  <div className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/40" />
                </div>
              )}
              {phase === "predicting" && (
                <div className="pointer-events-none absolute inset-0 m-8 rounded-2xl border-2 border-accent/60" />
              )}

              {/* Phase button */}
              <button
                onClick={() => {
                  if (phase === "idle") setPhase("tracking");
                  else if (phase === "tracking") setPhase("predicting");
                  // In "predicting", the button is hidden — only speaking ends the session.
                }}
                disabled={phase === "predicting"}
                className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg ring-1 ring-border/50 disabled:opacity-60"
              >
                {phase === "idle" && (
                  <>
                    <Play className="size-3.5" /> Start tracking
                  </>
                )}
                {phase === "tracking" && (
                  <>
                    <Square className="size-3.5" /> Stop
                  </>
                )}
                {phase === "predicting" && (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Predicting…
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Predicted sentence card */}
          {showCard && tokens.length > 0 && (
            <section className="text-center">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Predicted sentence
              </span>
              <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {tokens.map((t, i) => {
                    const isBlank = t.word === null;
                    return (
                      <button
                        key={i}
                        onClick={() => setEditingIdx(editingIdx === i ? null : i)}
                        className={
                          isBlank
                            ? "rounded-lg border-2 border-dashed border-accent/60 px-3 py-1.5 text-2xl font-semibold text-accent transition-colors hover:bg-accent/10"
                            : "rounded-lg px-2 py-1 text-3xl font-semibold tracking-tight text-foreground transition-colors hover:bg-surface"
                        }
                      >
                        {t.word ?? "___"}
                      </button>
                    );
                  })}
                </div>

                {/* Alternatives popover for the tapped token */}
                {editingIdx !== null && (
                  <div className="mt-4 rounded-2xl bg-surface p-3 ring-1 ring-border">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {tokens[editingIdx].word === null
                          ? "Fill in the blank"
                          : "Did you mean…"}
                      </span>
                      <button
                        onClick={() => setEditingIdx(null)}
                        className="rounded-full p-1 text-muted-foreground hover:bg-card"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tokens[editingIdx].alternatives.map((alt) => (
                        <button
                          key={alt}
                          onClick={() => handlePickAlternative(editingIdx, alt)}
                          className="rounded-xl bg-card px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border transition-colors active:bg-muted"
                        >
                          {alt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSpeakSentence}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95"
                >
                  <Volume2 className="size-4" /> Tap to speak
                </button>
              </div>
            </section>
          )}


          {/* Recent phrases */}
          {recent.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Recent
                </span>
              </div>
              <div className="flex flex-wrap gap-2 rounded-2xl bg-surface p-3 ring-1 ring-border">
                {recent.map((w) => (
                  <button
                    key={w}
                    onClick={() => {
                      speak(w);
                      pushRecent(w);
                    }}
                    className="rounded-full bg-card px-3.5 py-1.5 text-sm text-foreground ring-1 ring-border shadow-sm transition-transform active:scale-95"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Quick phrases — give logged-in users something to do at a glance */}
          {!showCard && (
            <section>
              <div className="mb-2 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Quick phrases
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Yes",
                  "No",
                  "Thank you",
                  "Please help",
                  "Water, please",
                  "One moment",
                ].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      speak(p);
                      pushRecent(p);
                    }}
                    className="flex items-center justify-between gap-2 rounded-2xl bg-card px-4 py-3 text-left text-sm font-medium text-foreground ring-1 ring-border shadow-sm transition-transform active:scale-95"
                  >
                    <span>{p}</span>
                    <Volume2 className="size-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Personalization nudge for signed-in users */}
          {user && (
            <section className="pb-10 pt-2">
              <Link
                to="/calibrate"
                className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border transition-transform active:scale-[0.99]"
              >
                <div className="shrink-0 rounded-xl bg-secondary p-2.5">
                  <Mic className="size-4 text-secondary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Sharpen your model
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    A 60-second calibration pass makes predictions noticeably tighter.
                  </p>
                </div>
                <span className="text-xs font-semibold text-primary">Tune →</span>
              </Link>
            </section>
          )}



          {/* Guest personalization disclosure */}
          {!user && (
            <section className="pb-10 pt-2">
              <div className="space-y-4 rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 rounded-xl bg-warm p-2.5">
                    <Sparkles className="size-4 text-foreground" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-foreground">
                      Better accuracy for you
                    </h3>
                    <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                      In guest mode, VoiceBox uses a generic model. Create an
                      account and we'll store your mouth-movement data securely
                      to your profile, so predictions adapt to your unique
                      speech patterns over time.
                    </p>
                  </div>
                </div>
                <Link
                  to="/auth"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-semibold text-secondary-foreground transition-colors active:bg-muted"
                >
                  <UserPlus className="size-4" />
                  Create an account
                </Link>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
