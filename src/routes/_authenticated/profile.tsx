import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, LogOut, Sparkles, Mic, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "Your profile — SpeakEasy" }],
  }),
  component: ProfilePage,
});

type Phrase = {
  id: string;
  text: string;
  last_used_at: string;
};

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string>("");
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name ?? ""));

    supabase
      .from("phrases")
      .select("id, text, last_used_at", { count: "exact" })
      .order("last_used_at", { ascending: false })
      .then(({ data, count: c }) => {
        setPhrases((data ?? []) as Phrase[]);
        setCount(c ?? 0);
      });
  }, [user.id]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast("Signed out");
    navigate({ to: "/", replace: true });
  }

  const strengthPct = Math.min(100, Math.round((count / 50) * 100));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6">
        <header className="flex items-center justify-between pt-7">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <ArrowLeft className="size-4" /> Back to speak
          </Link>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-medium ring-1 ring-border"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </header>

        <main className="flex-1 space-y-6 py-8">
          <section>
            <h1 className="text-3xl font-semibold tracking-tight">
              {displayName || "Welcome"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </section>

          {/* Personalization progress */}
          <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-xl bg-warm p-2.5">
                <Sparkles className="size-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Personalization profile</h2>
                <p className="text-sm text-muted-foreground">
                  {count} {count === 1 ? "sentence" : "sentences"} spoken. The more
                  you use VoiceBox, the more the model adapts to you.
                </p>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${strengthPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Profile strength: {strengthPct}%
            </p>
          </section>

          {/* Register mouth movements shortcut */}
          <Link
            to="/calibrate"
            className="flex items-center gap-4 rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm transition hover:opacity-95"
          >
            <div className="rounded-xl bg-primary-foreground/15 p-2.5">
              <Mic className="size-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">Register mouth movements</h2>
              <p className="text-sm opacity-80">
                Record the alphabet, then optionally common words, to personalize predictions.
              </p>
            </div>
            <ChevronRight className="size-5 opacity-80" />
          </Link>

          {/* Sentence history */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Sentence history
            </h2>
            {phrases.length === 0 ? (
              <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground ring-1 ring-border">
                No sentences yet. Everything you speak through VoiceBox will show up here.
              </p>
            ) : (
              <ul className="space-y-2">
                {phrases.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-border"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {p.text}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(p.last_used_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

