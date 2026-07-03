// ============================================================
//  hooks/useAudioRecorder.js — WAV capture at 16kHz mono
// ============================================================
//
//  Uses Web Audio API (AudioContext + ScriptProcessor) to
//  record raw PCM at 16 kHz, then encodes it into a proper
//  WAV blob ready for upload.
// ============================================================

import { useState, useRef, useCallback } from "react";

const SAMPLE_RATE = 16000;

// ── WAV encoder ─────────────────────────────────────────────

function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);           // PCM chunk size
  view.setUint16(20, 1, true);            // PCM format
  view.setUint16(22, 1, true);            // mono
  view.setUint32(24, sampleRate, true);   // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);            // block align
  view.setUint16(34, 16, true);           // bits per sample
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function mergeChunks(chunks) {
  let length = 0;
  for (const c of chunks) length += c.length;
  const result = new Float32Array(length);
  let off = 0;
  for (const c of chunks) {
    result.set(c, off);
    off += c.length;
  }
  return result;
}

// ── Hook ────────────────────────────────────────────────────

export default function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const contextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (contextRef.current && contextRef.current.state !== "closed") {
      contextRef.current.close().catch(() => {});
    }
  }, []);

  const stopRecording = useCallback(() => {
    cleanup();

    const pcm = mergeChunks(chunksRef.current);
    if (pcm.length > 0) {
      const wav = encodeWAV(pcm, SAMPLE_RATE);
      setAudioBlob(wav);
    }

    setIsRecording(false);
    setAudioLevel(0);
    setCountdown(null);
  }, [cleanup]);

  const startRecording = useCallback(
    async (duration = 6) => {
      setError(null);
      setAudioBlob(null);
      chunksRef.current = [];

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: { ideal: SAMPLE_RATE },
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        const context = new AudioContext({ sampleRate: SAMPLE_RATE });
        const source = context.createMediaStreamSource(stream);
        const processor = context.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          const data = new Float32Array(e.inputBuffer.getChannelData(0));
          chunksRef.current.push(data);

          // RMS level for visualization
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
          setAudioLevel(Math.sqrt(sum / data.length));
        };

        source.connect(processor);
        processor.connect(context.destination);

        contextRef.current = context;
        streamRef.current = stream;
        processorRef.current = processor;

        setIsRecording(true);
        setCountdown(duration);

        // Countdown timer
        let remaining = duration;
        countdownRef.current = setInterval(() => {
          remaining -= 1;
          setCountdown(remaining);
          if (remaining <= 0) clearInterval(countdownRef.current);
        }, 1000);

        // Auto-stop
        timerRef.current = setTimeout(() => {
          stopRecording();
        }, duration * 1000);
      } catch (err) {
        setError(
          err.name === "NotAllowedError"
            ? "Microphone access denied. Please allow microphone access."
            : `Microphone error: ${err.message}`
        );
      }
    },
    [stopRecording]
  );

  const reset = useCallback(() => {
    cleanup();
    setAudioBlob(null);
    setAudioLevel(0);
    setError(null);
    setIsRecording(false);
    setCountdown(null);
    chunksRef.current = [];
  }, [cleanup]);

  return {
    isRecording,
    audioBlob,
    audioLevel,
    error,
    countdown,
    startRecording,
    stopRecording,
    reset,
  };
}
