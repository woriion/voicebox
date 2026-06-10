import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — VoiceBox" },
      {
        name: "description",
        content:
          "Create an account or sign in to load your personalized VoiceBox speech history.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  // If already signed in, bounce home.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created! Welcome to VoiceBox.");
        navigate({ to: "/", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6">
        <header className="pt-7">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
          >
            <ArrowLeft className="size-4" /> Continue as guest
          </Link>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10">
          <div className="mb-8 text-center flex flex-col items-center">
            <img src="/logo.png" className="size-16 object-contain mb-4" alt="VoiceBox Logo" />
            <h1 className="text-3xl font-semibold tracking-tight">Welcome to VoiceBox</h1>
            <p className="mt-2 text-pretty text-sm text-muted-foreground">
              {mode === "signup"
                ? "Create an account to load predictions and sync speech history corrections."
                : "Sign in to load your speech profile history."}
            </p>
          </div>

          {/* Disclosure */}
          <div className="mb-6 flex items-start gap-3 rounded-2xl bg-warm/60 p-4 ring-1 ring-border">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-foreground" />
            <p className="text-xs leading-relaxed text-foreground/80">
              We store your spoken phrases and corrections privately to your account.
              This history is used to suggest smart word corrections and adapt predictions
              for you over time.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Display name (optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-2xl bg-card px-4 py-4 text-sm ring-1 ring-border focus:outline-none focus:ring-ring"
              />
            )}
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl bg-card px-4 py-4 text-sm ring-1 ring-border focus:outline-none focus:ring-ring"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl bg-card px-4 py-4 text-sm ring-1 ring-border focus:outline-none focus:ring-ring"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            className="mt-6 text-center text-sm text-muted-foreground"
          >
            {mode === "signin" ? (
              <>New here? <span className="font-medium text-foreground">Create an account</span></>
            ) : (
              <>Already have an account? <span className="font-medium text-foreground">Sign in</span></>
            )}
          </button>
        </main>
      </div>
    </div>
  );
}
