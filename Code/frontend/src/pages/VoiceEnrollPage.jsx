import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getEnrollmentStatus,
  uploadVoiceSample,
  completeEnrollment,
  deleteEnrollment,
} from "../api/client";
import useAudioRecorder from "../hooks/useAudioRecorder";
import AudioVisualizer from "../components/AudioVisualizer";
import "./VoiceEnrollPage.css";

const PROMPTS = [
  "Hello, this is my voice registration.",
  "The weather today looks really nice outside.",
  "I am setting up secure voice authentication.",
  "My voice is my password, verify me please.",
  "Security and convenience go hand in hand.",
  "Open sesame, let me through the door.",
  "The quick brown fox jumps over the lazy dog.",
];

export default function VoiceEnrollPage() {
  const { sessionToken, refreshUser } = useAuth();
  const [enrollment, setEnrollment] = useState(null);
  const [step, setStep] = useState("idle"); // idle | recording | uploading | done
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const recorder = useAudioRecorder();

  const fetchStatus = async () => {
    try {
      const data = await getEnrollmentStatus(sessionToken);
      setEnrollment(data);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
  }, [sessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recorder.audioBlob && step === "recording") {
      handleUpload(recorder.audioBlob);
    }
  }, [recorder.audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecord = () => {
    setError(null);
    setSuccess(null);
    setStep("recording");
    recorder.startRecording(5);
  };

  const handleUpload = async (blob) => {
    setStep("uploading");
    try {
      const res = await uploadVoiceSample(sessionToken, blob);
      setSuccess(res.message);
      await fetchStatus();
      recorder.reset();
      setStep("idle");
    } catch (err) {
      setError(err.detail || "Upload failed");
      recorder.reset();
      setStep("idle");
    }
  };

  const handleComplete = async () => {
    setError(null);
    try {
      const res = await completeEnrollment(sessionToken);
      setSuccess(res.message);
      await fetchStatus();
      refreshUser();
    } catch (err) {
      setError(err.detail || "Could not complete enrollment");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete all voice samples and start over?")) return;
    setError(null);
    try {
      await deleteEnrollment(sessionToken);
      setSuccess("Enrollment deleted. You can re-enroll.");
      await fetchStatus();
      refreshUser();
    } catch (err) {
      setError(err.detail || "Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  const sampleIndex = enrollment?.samples_count || 0;
  const minReq = enrollment?.min_required || 3;
  const canComplete = sampleIndex >= minReq && !enrollment?.is_enrolled;

  return (
    <div className="page animate-fade-in">
      <div className="enroll-container">
        <div className="auth-header">
          <div className="auth-icon">🎤</div>
          <h1 className="page-title">Voice Enrollment</h1>
          <p className="page-subtitle">
            Record {minReq}+ voice samples to enable voice authentication
          </p>
        </div>

        {enrollment?.is_enrolled && (
          <div className="alert alert-success animate-slide-in mb-2">
            <span>✓</span> Voice enrollment is active with{" "}
            {enrollment.samples_count} sample(s).
          </div>
        )}

        {error && (
          <div className="alert alert-error animate-slide-in mb-2">
            <span>⚠</span> {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success animate-slide-in mb-2">
            <span>✓</span> {success}
          </div>
        )}

        <div className="enroll-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${Math.min((sampleIndex / minReq) * 100, 100)}%` }}
            />
          </div>
          <span className="progress-label">
            {sampleIndex} / {minReq} samples (min)
          </span>
        </div>

        {!enrollment?.is_enrolled && (
          <div className="enroll-prompt card">
            <div className="challenge-label">🗣 Say something like:</div>
            <div className="challenge-text" style={{ fontSize: "1.1rem" }}>
              &ldquo;{PROMPTS[sampleIndex % PROMPTS.length]}&rdquo;
            </div>
            <p
              style={{
                marginTop: 8,
                fontSize: "0.8rem",
                color: "var(--text-muted)",
              }}
            >
              Vary your sentences for best results. Speak naturally for ~5
              seconds.
            </p>
          </div>
        )}

        <div className="recording-area">
          {step === "recording" && (
            <>
              <AudioVisualizer level={recorder.audioLevel} isRecording />
              {recorder.countdown !== null && (
                <div className="countdown-text">{recorder.countdown}s</div>
              )}
            </>
          )}

          {step === "uploading" && (
            <div className="text-center">
              <div className="spinner" style={{ width: 36, height: 36 }} />
              <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
                Processing voice sample...
              </p>
            </div>
          )}

          {(step === "idle" || step === "done") && !enrollment?.is_enrolled && (
            <button
              className="record-btn"
              onClick={handleRecord}
              disabled={step !== "idle"}
              id="enroll-record-btn"
            >
              🎤
            </button>
          )}

          {step === "idle" && !enrollment?.is_enrolled && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Click to record sample {sampleIndex + 1}
            </p>
          )}
        </div>

        {recorder.error && (
          <div className="alert alert-error animate-slide-in">
            <span>⚠</span> {recorder.error}
          </div>
        )}

        <div className="enroll-actions">
          {canComplete && (
            <button
              className="btn btn-primary btn-lg"
              onClick={handleComplete}
              id="enroll-complete-btn"
            >
              ✓ Complete Enrollment
            </button>
          )}
          {enrollment?.samples_count > 0 && (
            <button
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              id="enroll-delete-btn"
            >
              🗑 Delete &amp; Start Over
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
