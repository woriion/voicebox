import { useCallback, useEffect, useRef, useState } from "react";
import {
  resultToPrediction,
  voiceboxApi,
  type VoiceBoxMode,
  type VoiceBoxPrediction,
  type VoiceBoxStatus,
} from "@/lib/voiceboxApi";

export type VoiceBoxPhase = "idle" | "preparing" | "ready" | "tracking" | "predicting";

type BackendState = {
  phase: VoiceBoxPhase;
  status: VoiceBoxStatus | null;
  prediction: VoiceBoxPrediction | null;
  error: string | null;
  isBackendAvailable: boolean;
};

export function useVoiceBoxBackend() {
  const [state, setState] = useState<BackendState>({
    phase: "idle",
    status: null,
    prediction: null,
    error: null,
    isBackendAvailable: true,
  });
  const generatingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const status = await voiceboxApi.status();
      setState((current) => ({
        ...current,
        status,
        error: null,
        isBackendAvailable: true,
      }));
      return status;
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "VoiceBox backend is unavailable",
        isBackendAvailable: false,
      }));
      return null;
    }
  }, []);

  const prepare = useCallback(
    async (mode: VoiceBoxMode = "Dysphonia") => {
      setState((current) => ({
        ...current,
        phase: "preparing",
        prediction: null,
        error: null,
      }));
      try {
        await voiceboxApi.start(mode);
        setState((current) => ({
          ...current,
          phase: "ready",
          error: null,
        }));
        await refresh();
      } catch (error) {
        setState((current) => ({
          ...current,
          phase: "idle",
          error: error instanceof Error ? error.message : "Preparation failed",
        }));
        throw error;
      }
    },
    [refresh],
  );

  const startRecording = useCallback(async () => {
    setState((current) => ({
      ...current,
      phase: "tracking",
      prediction: null,
      error: null,
    }));
    await voiceboxApi.listen();
    await refresh();
  }, [refresh]);

  const generatePrediction = useCallback(async () => {
    if (generatingRef.current) return null;
    generatingRef.current = true;
    setState((current) => ({ ...current, phase: "predicting", error: null }));
    try {
      const result = await voiceboxApi.generate();
      const prediction = resultToPrediction(result);
      setState((current) => ({
        ...current,
        phase: "predicting",
        prediction,
        error: null,
        isBackendAvailable: true,
      }));
      await refresh();
      return prediction;
    } catch (error) {
      setState((current) => ({
        ...current,
        phase: "idle",
        error: error instanceof Error ? error.message : "Prediction failed",
        isBackendAvailable: false,
      }));
      return null;
    } finally {
      generatingRef.current = false;
    }
  }, [refresh]);

  const stop = useCallback(async () => {
    setState((current) => ({ ...current, phase: "idle", prediction: null }));
    await voiceboxApi.stop().catch(() => null);
    await refresh();
  }, [refresh]);

  const speak = useCallback(async (text: string) => {
    return voiceboxApi.speak(text);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (state.phase === "idle") return;
    const timer = window.setInterval(async () => {
      const status = await refresh();
      if (
        state.phase === "tracking" &&
        status?.listening &&
        Number(status.window_remaining || 0) <= 0.1 &&
        !status.generating
      ) {
        generatePrediction();
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [generatePrediction, refresh, state.phase]);

  return {
    ...state,
    cameraUrl: voiceboxApi.videoUrl,
    prepare,
    startRecording,
    generatePrediction,
    stop,
    speak,
  };
}
