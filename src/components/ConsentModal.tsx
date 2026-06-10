import { useEffect, useState } from "react";
import { Camera, Shield, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "kane.consent.session";
// In-memory flag — resets on hard refresh, persists across client-side nav
let dismissedThisLoad = false;

export function ConsentModal() {
  const [open, setOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    function evaluate(authed: boolean) {
      if (!mounted) return;
      setIsAuthed(authed);
      if (dismissedThisLoad) {
        setOpen(false);
        return;
      }
      if (authed) {
        // Signed in: show once per session (login → logout cycle)
        const accepted = window.sessionStorage.getItem(SESSION_KEY);
        setOpen(!accepted);
      } else {
        // Guest: show on every hard refresh, but not on client-side nav
        window.sessionStorage.removeItem(SESSION_KEY);
        setOpen(true);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      evaluate(!!data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        window.sessionStorage.removeItem(SESSION_KEY);
      }
      evaluate(!!session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function accept() {
    dismissedThisLoad = true;
    if (isAuthed) {
      window.sessionStorage.setItem(SESSION_KEY, "accepted");
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-xl ring-1 ring-border">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-warm">
            <Shield className="size-4 text-foreground" />
          </span>
          <h2 className="text-lg font-semibold tracking-tight">Before you start</h2>
        </div>

        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          VoiceBox uses your device camera to read mouth movements and predict
          words. Nothing is uploaded in guest mode — everything stays on your
          device.
        </p>

        <ul className="my-5 space-y-3 text-sm text-foreground">
          <li className="flex items-start gap-3">
            <Camera className="mt-0.5 size-4 text-muted-foreground" />
            <span>Camera access is required to detect mouth movements.</span>
          </li>
          <li className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 text-muted-foreground" />
            <span>
              With an account, your samples are saved privately to improve
              predictions just for you.
            </span>
          </li>
        </ul>

        <button
          onClick={accept}
          className="w-full rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-sm"
        >
          I understand, continue
        </button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          By continuing you agree to our processing of camera data for this purpose.
        </p>
      </div>
    </div>
  );
}
