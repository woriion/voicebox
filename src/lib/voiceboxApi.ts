export type VoiceBoxMode = "Dysphonia" | "Aphonia";

export type VoiceBoxToken = {
  word: string | null;
  alternatives: string[];
};

export type VoiceBoxPrediction = {
  tokens: VoiceBoxToken[];
  text: string;
  rawText?: string;
  ranked?: Array<{ text?: string; score?: number }>;
};

export type VoiceBoxStatus = {
  status: string;
  mode: VoiceBoxMode;
  listening: boolean;
  generating: boolean;
  generation_progress: number;
  window_seconds: number;
  window_remaining: number;
  camera_running: boolean;
  capture_fps: number;
  visual_frames: number;
  last_result?: VoiceBoxGenerateResponse | null;
  history?: VoiceBoxGenerateResponse[];
  tts?: unknown;
};

export type VoiceBoxGenerateResponse = {
  final_text?: string;
  raw_chaplin_text?: string;
  ranked?: Array<{ text?: string; score?: number }>;
  created_at?: string;
  mode?: VoiceBoxMode;
};

export type VoiceBoxSpeakResponse = {
  spoken: boolean;
  text: string;
  message: string;
};

const DEFAULT_API_BASE = "http://127.0.0.1:8765";

function resolveVoiceBoxApiBase() {
  const configured = (import.meta.env.VITE_VOICEBOX_API_URL as string | undefined)?.replace(/\/$/, "");
  if (configured) return configured;

  if (typeof window === "undefined") return DEFAULT_API_BASE;

  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return DEFAULT_API_BASE;
  return `http://${hostname}:8765`;
}

export const voiceboxApiBase = resolveVoiceBoxApiBase();

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${voiceboxApiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || response.statusText);
  }
  return data as T;
}

function textToTokens(text: string, ranked: VoiceBoxGenerateResponse["ranked"] = []): VoiceBoxToken[] {
  const rankedWords = ranked
    .flatMap((item) => String(item.text ?? "").split(/\s+/))
    .map((word) => word.replace(/[^\w']/g, ""))
    .filter(Boolean);
  const fallbackAlternatives = Array.from(new Set(rankedWords)).slice(0, 6);

  return text
    .replace(/\s+([,.!?])/g, "$1")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({
      word,
      alternatives: fallbackAlternatives.filter((alt) => alt.toLowerCase() !== word.toLowerCase()),
    }));
}

export function resultToPrediction(result: VoiceBoxGenerateResponse): VoiceBoxPrediction {
  const text = String(result.final_text ?? "").trim();
  return {
    text,
    rawText: result.raw_chaplin_text,
    ranked: result.ranked,
    tokens: textToTokens(text, result.ranked),
  };
}

export const voiceboxApi = {
  videoUrl: `${voiceboxApiBase}/video.mjpg`,

  status() {
    return requestJson<VoiceBoxStatus>("/api/status", { method: "GET" });
  },

  start(mode: VoiceBoxMode = "Dysphonia", cameraIndex = 0) {
    return requestJson<VoiceBoxStatus>("/api/start", {
      method: "POST",
      body: JSON.stringify({ mode, camera_index: cameraIndex }),
    });
  },

  listen() {
    return requestJson<VoiceBoxStatus>("/api/listen", { method: "POST", body: "{}" });
  },

  generate() {
    return requestJson<VoiceBoxGenerateResponse>("/api/generate", {
      method: "POST",
      body: "{}",
    });
  },

  stop() {
    return requestJson<VoiceBoxStatus>("/api/stop", { method: "POST", body: "{}" });
  },

  speak(text: string) {
    return requestJson<VoiceBoxSpeakResponse>("/api/speak", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
};
