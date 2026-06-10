import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, Fragment } from "react";
import {
  Clock,
  Globe,
  Loader2,
  Mic,
  MicOff,
  Play,
  Plus,
  Sparkles,
  Square,
  Trash2,
  User as UserIcon,
  UserPlus,
  Volume2,
  X,
} from "lucide-react";
import { ConsentModal } from "@/components/ConsentModal";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useVoiceBoxBackend, type VoiceBoxPhase } from "@/hooks/use-voicebox-backend";
import { getSentenceAt, type SentenceToken } from "@/lib/mockPredictions";
import { speak as browserSpeak } from "@/lib/tts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VoiceBox - Speak with your mouth movements" },
      {
        name: "description",
        content:
          "Tap to speak a whole sentence VoiceBox predicted from your mouth movements, or fill in any blanks.",
      },
    ],
  }),
  component: SpeakPage,
});

function tokensToText(tokens: SentenceToken[]): string {
  return tokens
    .map((token) => token.word ?? "___")
    .join(" ")
    .replace(/\s+([,.!?])/g, "$1");
}

function normalizeWord(word: string | null, isFirst: boolean): string | null {
  if (!word) return word;
  const isAllCaps = word.toUpperCase() === word && /[A-Z]/.test(word);
  if (!isAllCaps) return word;

  const lower = word.toLowerCase();
  if (isFirst) {
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  if (lower === "i") {
    return "I";
  }
  return lower;
}

function normalizeTokens(tokens: SentenceToken[]): SentenceToken[] {
  return tokens.map((token, i) => {
    const word = normalizeWord(token.word, i === 0);
    const alternatives = (token.alternatives || []).map((alt) => {
      const normalizedAlt = normalizeWord(alt, false);
      return normalizedAlt ?? alt;
    });
    return {
      ...token,
      word,
      alternatives,
    };
  });
}

function SpeakPage() {
  const { user } = useCurrentUser();
  const backend = useVoiceBoxBackend();
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [phase, setPhase] = useState<VoiceBoxPhase>("idle");
  const [showCard, setShowCard] = useState(false);
  const [tokens, setTokens] = useState<SentenceToken[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const isCameraLive = Boolean(backend.status?.camera_running);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<"Dysphonia" | "Aphonia">("Dysphonia");

  const isCurrentlyPredicting = phase === "predicting" && !showCard;

  useEffect(() => {
    if (!isCurrentlyPredicting) {
      setProgress(0);
      return;
    }

    const intervalTime = backend.isBackendAvailable ? 150 : 50;
    const maxSimulated = backend.isBackendAvailable ? 95 : 90;
    
    if (backend.isBackendAvailable && backend.status?.generation_progress) {
      setProgress(Math.max(10, backend.status.generation_progress));
    } else {
      setProgress(10);
    }

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (backend.isBackendAvailable && backend.status?.generation_progress) {
          const backendProgress = backend.status.generation_progress;
          if (backendProgress > prev) {
            return Math.min(100, backendProgress);
          }
        }
        
        if (prev < maxSimulated) {
          const increment = backend.isBackendAvailable 
            ? Math.random() * 4 + 1 
            : 10;
          return Math.min(maxSimulated, prev + increment);
        }
        return prev;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isCurrentlyPredicting, backend.isBackendAvailable, backend.status?.generation_progress]);

  useEffect(() => {
    if (!backend.prediction?.tokens.length) return;
    setTokens(normalizeTokens(backend.prediction.tokens));
    setShowCard(true);
    setEditingIdx(null);
    setPhase("predicting");
  }, [backend.prediction]);

  useEffect(() => {
    if (backend.phase === "idle" && phase === "predicting" && !showCard) {
      return;
    }
    setPhase(backend.phase);
  }, [backend.phase, showCard, phase]);

  useEffect(() => {
    if (backend.status?.mode) {
      setMode(backend.status.mode);
    }
  }, [backend.status?.mode]);

  function pushRecent(text: string) {
    setRecent((items) => [text, ...items.filter((item) => item !== text)].slice(0, 6));
  }

  function resetSession() {
    setPhase("idle");
    setShowCard(false);
    setEditingIdx(null);
    setTokens([]);
    setSentenceIdx((index) => index + 1);
  }

  function handleInsertToken(idx: number) {
    const newToken: SentenceToken = { word: "", alternatives: [] };
    setTokens((prev) => {
      const next = [...prev];
      next.splice(idx, 0, newToken);
      return next;
    });
    setEditingIdx(idx);
    setShowCard(true);
  }

  async function handlePrepare() {
    setPhase("preparing");
    setShowCard(false);
    setTokens([]);
    try {
      await backend.prepare(mode);
    } catch (error) {
      toast("Backend unavailable. Using demo prediction.");
      console.warn(error);
      setPhase("ready");
    }
  }

  async function handleStartRecording() {
    setPhase("tracking");
    try {
      await backend.startRecording();
    } catch (error) {
      console.warn(error);
    }
  }

  async function handleReset() {
    try {
      await backend.stop();
    } catch (error) {
      console.warn(error);
    }
    resetSession();
  }

  async function handleStopTracking() {
    setPhase("predicting");
    setShowCard(false);
    setEditingIdx(null);
    try {
      const prediction = await backend.generatePrediction();
      if (prediction?.tokens.length) return;
      throw new Error("No backend prediction returned");
    } catch {
      const next = getSentenceAt(sentenceIdx);
      window.setTimeout(() => {
        setTokens(normalizeTokens(next.tokens));
        setShowCard(true);
      }, 700);
    }
  }

  async function handleSpeakSentence() {
    const text = tokensToText(tokens).replace(/___/g, "").replace(/\s+/g, " ").trim();
    if (!text) {
      toast("Fill in the blanks before speaking.");
      return;
    }

    try {
      await backend.speak(text);
    } catch {
      browserSpeak(text);
    }

    pushRecent(text);
    if (user) {
      supabase
        .from("phrases")
        .insert({ user_id: user.id, text, last_used_at: new Date().toISOString() })
        .then(() => {});
    }
    await backend.stop().catch(() => null);
    resetSession();
  }

  function handlePickAlternative(idx: number, alt: string) {
    setTokens((prev) => prev.map((token, i) => (i === idx ? { ...token, word: alt } : token)));
    setEditingIdx(null);
  }

  // Context-aware phase actions are handled directly by individual buttons.

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ConsentModal />
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
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

        <div className="flex flex-wrap items-center gap-2 px-6 pb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground ring-1 ring-border">
            <Globe className="size-3" /> Language: English
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground ring-1 ring-border">
            {backend.isBackendAvailable ? "Backend connected" : "Demo fallback"}
          </span>
        </div>

        <main className="flex flex-1 flex-col gap-5 px-6">
          {/* Segmented Speech Mode Control */}
          <div className="flex items-center justify-between rounded-2xl bg-card p-3 ring-1 ring-border shadow-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-foreground">Speech Mode</span>
              <span className="text-[10px] text-muted-foreground">Toggle microphone usage</span>
            </div>
            <div className="flex bg-surface rounded-xl p-1 gap-1">
              <button
                onClick={() => setMode("Dysphonia")}
                disabled={phase !== "idle"}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                  mode === "Dysphonia"
                    ? "bg-card text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                  phase !== "idle" && "opacity-50 cursor-not-allowed"
                )}
              >
                Voice + Mouth
              </button>
              <button
                onClick={() => setMode("Aphonia")}
                disabled={phase !== "idle"}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                  mode === "Aphonia"
                    ? "bg-card text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                  phase !== "idle" && "opacity-50 cursor-not-allowed"
                )}
              >
                Mouth Only
              </button>
            </div>
          </div>

          <section>
            <div className="relative aspect-square w-full">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-surface ring-1 ring-border">
                {isCameraLive && (phase === "ready" || phase === "tracking") ? (
                  <img
                    src={backend.cameraUrl}
                    alt="Live camera stream"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground p-6 text-center animate-in fade-in duration-300">
                    {phase === "preparing" && <Loader2 className="size-12 animate-spin text-accent" />}
                    {phase === "tracking" && <Mic className="size-12 text-accent animate-pulse" />}
                    {phase === "predicting" && (
                      <Loader2 className="size-12 animate-spin text-accent" />
                    )}
                    {phase === "idle" && <MicOff className="size-12" />}
                    {phase === "ready" && <Loader2 className="size-12 animate-spin text-muted-foreground" />}
                    
                    <span className="text-[11px] font-semibold uppercase tracking-[0.15em]">
                      {phase === "preparing" && "Starting camera..."}
                      {phase === "tracking" && "Reading mouth..."}
                      {phase === "predicting" && "Predicting..."}
                      {phase === "idle" && "Camera paused"}
                      {phase === "ready" && "Camera loading..."}
                    </span>
                  </div>
                )}
              </div>

              {/* Status indicators overlaid on the top left of the camera feed */}
              {(phase === "ready" || phase === "tracking" || phase === "preparing") && (
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 animate-in fade-in duration-300">
                  {/* Camera status */}
                  <div className="flex items-center gap-2 rounded-full bg-background/80 backdrop-blur-md px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-foreground ring-1 ring-border/50 shadow-sm">
                    <span
                      className={cn(
                        "size-2 rounded-full transition-colors duration-300",
                        backend.status?.camera_running ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                      )}
                    />
                    <span>Cam: {backend.status?.camera_running ? "Ready" : "Starting..."}</span>
                  </div>

                  {/* Audio status (only if voice mode is selected) */}
                  {mode === "Dysphonia" && (
                    <div className="flex items-center gap-2 rounded-full bg-background/80 backdrop-blur-md px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-foreground ring-1 ring-border/50 shadow-sm">
                      <span
                        className={cn(
                          "size-2 rounded-full transition-colors duration-300",
                          backend.status?.audio_backend?.ready ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                        )}
                      />
                      <span>Audio: {backend.status?.audio_backend?.ready ? "Ready" : "Loading ASR..."}</span>
                    </div>
                  )}
                </div>
              )}
              {isCurrentlyPredicting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-background/85 backdrop-blur-md p-6 text-center transition-all duration-300 animate-in fade-in">
                  <div className="relative mb-4">
                    {/* Glowing outer ring */}
                    <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl animate-pulse" />
                    <div className="relative rounded-2xl bg-card p-4 ring-1 ring-border/50 shadow-inner">
                      <Sparkles className="size-8 text-accent animate-pulse" />
                    </div>
                  </div>
                  
                  <h3 className="text-base font-semibold tracking-tight text-foreground mb-1">
                    {progress < 30 && "Analyzing lip movements..."}
                    {progress >= 30 && progress < 70 && "Running visual prediction..."}
                    {progress >= 70 && progress < 90 && "Fusing audio & visual cues..."}
                    {progress >= 90 && "Generating final text..."}
                  </h3>
                  
                  <p className="text-xs text-muted-foreground mb-6 max-w-[240px]">
                    {backend.isBackendAvailable 
                      ? `Processing pipeline...` 
                      : "Simulating prediction pipeline..."}
                  </p>

                  <div className="w-4/5 max-w-xs space-y-2">
                    <Progress value={progress} className="h-2 bg-muted/30" />
                    <div className="flex justify-between text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      <span>Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                  </div>
                </div>
              )}
              {phase === "tracking" && (
                <div className="pointer-events-none absolute inset-0 m-8 rounded-2xl border-2 border-dashed border-accent/40">
                  <div className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/40" />
                </div>
              )}
              {phase === "predicting" && (
                <div className="pointer-events-none absolute inset-0 m-8 rounded-2xl border-2 border-accent/60" />
              )}

              {/* Context-aware buttons */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-15 w-full max-w-[280px] flex justify-center px-4">
                {phase === "idle" && (
                  <button
                    onClick={handlePrepare}
                    className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary/90 px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg ring-1 ring-border/50 transition-all duration-150 active:scale-95"
                  >
                    <Play className="size-3.5" /> Prepare camera & audio
                  </button>
                )}

                {phase === "preparing" && (
                  <button
                    disabled
                    className="inline-flex items-center gap-2 rounded-full bg-primary/60 px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg ring-1 ring-border/50 cursor-wait animate-pulse"
                  >
                    <Loader2 className="size-3.5 animate-spin" /> Starting system...
                  </button>
                )}

                {phase === "ready" && (
                  <div className="flex items-center gap-2 animate-in fade-in duration-300">
                    <button
                      onClick={handleStartRecording}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-emerald-500/50 transition-all duration-150 active:scale-95"
                    >
                      <Mic className="size-3.5 animate-pulse text-white" /> Start recording
                    </button>
                    <button
                      onClick={handleReset}
                      className="inline-flex items-center gap-2 rounded-full bg-card hover:bg-surface border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground shadow-lg transition-all duration-150 active:scale-95"
                    >
                      Reset
                    </button>
                  </div>
                )}

                {phase === "tracking" && (
                  <button
                    onClick={handleStopTracking}
                    className="inline-flex items-center gap-2 rounded-full bg-destructive hover:bg-destructive/90 px-5 py-2.5 text-sm font-semibold text-destructive-foreground shadow-lg ring-1 ring-border/50 transition-all duration-150 active:scale-95 animate-pulse"
                  >
                    <Square className="size-3.5" /> Stop recording
                  </button>
                )}

                {phase === "predicting" && (
                  <button
                    disabled
                    className="inline-flex items-center gap-2 rounded-full bg-primary/60 px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg ring-1 ring-border/50 cursor-wait animate-pulse"
                  >
                    <Loader2 className="size-3.5 animate-spin" /> Predicting...
                  </button>
                )}
              </div>
            </div>
          </section>

          {backend.status?.listening && phase === "tracking" && (
            <div className="rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground ring-1 ring-border">
              Speaking window: {Number(backend.status.window_remaining || 0).toFixed(1)}s
            </div>
          )}

          {showCard && (
            <section className="text-center">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Predicted sentence
              </span>
              <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
                {tokens.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
                    <span className="text-sm">Sentence is empty</span>
                    <button
                      onClick={() => handleInsertToken(0)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10 border border-dashed border-accent/40 rounded-2xl transition-colors"
                    >
                      <Plus className="size-4" /> Add first word
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-3">
                    {/* Plus button at start */}
                    <button
                      onClick={() => handleInsertToken(0)}
                      className="size-7 inline-flex items-center justify-center rounded-full text-muted-foreground/40 hover:text-accent hover:bg-surface/50 transition-colors"
                      title="Insert word at start"
                    >
                      <Plus className="size-4" />
                    </button>

                    {tokens.map((token, i) => {
                      const isBlank = token.word === null || token.word === "";
                      return (
                        <Fragment key={`${token.word ?? "blank"}-${i}`}>
                          <button
                            onClick={() => setEditingIdx(editingIdx === i ? null : i)}
                            className={cn(
                              "transition-all duration-150 py-1.5 px-3 rounded-xl text-2xl font-semibold tracking-tight border",
                              isBlank
                                ? "border-dashed border-accent/40 text-accent bg-accent/5 hover:bg-accent/10"
                                : "border-transparent text-foreground hover:bg-surface",
                              editingIdx === i && "ring-2 ring-accent border-transparent bg-accent/5"
                            )}
                          >
                            {token.word || "___"}
                          </button>

                          {/* Plus button after word */}
                          <button
                            onClick={() => handleInsertToken(i + 1)}
                            className="size-7 inline-flex items-center justify-center rounded-full text-muted-foreground/40 hover:text-accent hover:bg-surface/50 transition-colors"
                            title={`Insert word after "${token.word ?? ''}"`}
                          >
                            <Plus className="size-4" />
                          </button>
                        </Fragment>
                      );
                    })}
                  </div>
                )}

                {editingIdx !== null && tokens[editingIdx] !== undefined && (
                  <div className="mt-4 rounded-2xl bg-surface p-4 ring-1 ring-border text-left">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {tokens[editingIdx].word === null || tokens[editingIdx].word === "" 
                          ? "Type or select word" 
                          : "Edit word"}
                      </span>
                      <button
                        onClick={() => setEditingIdx(null)}
                        className="rounded-full p-1 text-muted-foreground hover:bg-card"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Manual text input for direct editing */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Manual Edit
                        </span>
                        <input
                          type="text"
                          value={tokens[editingIdx].word ?? ""}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setTokens((prev) =>
                              prev.map((token, i) =>
                                i === editingIdx ? { ...token, word: newVal } : token
                              )
                            );
                          }}
                          placeholder="Type word..."
                          className="w-full px-3 py-2 text-base rounded-xl bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                          autoFocus
                        />
                      </div>

                      {/* Suggestions list */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Suggestions
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(tokens[editingIdx].alternatives.length
                            ? tokens[editingIdx].alternatives
                            : ["yes", "no", "please", "help"]
                          ).map((alt) => (
                            <button
                              key={alt}
                              onClick={() => handlePickAlternative(editingIdx, alt)}
                              className="rounded-lg bg-card px-2.5 py-1.5 text-xs font-medium text-foreground ring-1 ring-border hover:bg-muted transition-colors"
                            >
                              {alt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons (like Delete) */}
                      <div className="pt-3 border-t border-border flex justify-end">
                        <button
                          onClick={() => {
                            setTokens((prev) => prev.filter((_, i) => i !== editingIdx));
                            setEditingIdx(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                          Remove word
                        </button>
                      </div>
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

          {recent.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Recent
                </span>
              </div>
              <div className="flex flex-wrap gap-2 rounded-2xl bg-surface p-3 ring-1 ring-border">
                {recent.map((phrase) => (
                  <button
                    key={phrase}
                    onClick={async () => {
                      try {
                        await backend.speak(phrase);
                      } catch {
                        browserSpeak(phrase);
                      }
                      pushRecent(phrase);
                    }}
                    className="rounded-full bg-card px-3.5 py-1.5 text-sm text-foreground ring-1 ring-border shadow-sm transition-transform active:scale-95"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </section>
          )}

          {!showCard && (
            <section>
              <div className="mb-2 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Quick phrases
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {["Yes", "No", "Thank you", "Please help", "Water, please", "One moment"].map(
                  (phrase) => (
                    <button
                      key={phrase}
                      onClick={async () => {
                        try {
                          await backend.speak(phrase);
                        } catch {
                          browserSpeak(phrase);
                        }
                        pushRecent(phrase);
                      }}
                      className="flex items-center justify-between gap-2 rounded-2xl bg-card px-4 py-3 text-left text-sm font-medium text-foreground ring-1 ring-border shadow-sm transition-transform active:scale-95"
                    >
                      <span>{phrase}</span>
                      <Volume2 className="size-3.5 text-muted-foreground" />
                    </button>
                  ),
                )}
              </div>
            </section>
          )}

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
                  <h3 className="text-sm font-semibold text-foreground">Sharpen your model</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    A 60-second calibration pass makes predictions noticeably tighter.
                  </p>
                </div>
                <span className="text-xs font-semibold text-primary">Tune</span>
              </Link>
            </section>
          )}

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
                      In guest mode, VoiceBox uses a generic model. Create an account and we'll
                      store your mouth-movement data securely to your profile, so predictions adapt
                      to your unique speech patterns over time.
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
