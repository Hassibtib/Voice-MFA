import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getChallenge, verifyVoice, verifyBackupCode } from "../api/client";
import useAudioRecorder from "../hooks/useAudioRecorder";
import AudioVisualizer from "../components/AudioVisualizer";
import "./AuthPages.css";

export default function VoiceVerifyPage() {
  const { preAuthToken, isInMfaFlow, mfaRequirements, onVoiceVerified, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | recording | processing | success | failed
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showBackupInput, setShowBackupInput] = useState(false);
  const [backupCode, setBackupCode] = useState("");

  const recorder = useAudioRecorder();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    } else if (!isInMfaFlow) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, isInMfaFlow, navigate]);

  const fetchChallenge = async () => {
    setError(null);
    setResult(null);
    setStatus("loading");
    recorder.reset();
    try {
      const c = await getChallenge(preAuthToken);
      setChallenge(c);
      setStatus("idle");
    } catch (err) {
      setError(err.detail || "Failed to get challenge");
      setStatus("idle");
    }
  };

  useEffect(() => {
    if (preAuthToken) fetchChallenge();
  }, [preAuthToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recorder.audioBlob && status === "recording") {
      handleSubmit(recorder.audioBlob);
    }
  }, [recorder.audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecord = () => {
    setError(null);
    setResult(null);
    setStatus("recording");
    recorder.startRecording(6);
  };

  const handleSubmit = async (blob) => {
    setStatus("processing");
    try {
      const res = await verifyVoice(preAuthToken, challenge.challenge_id, blob);
      setResult(res);

      if (res.success) {
        setStatus("success");
        setTimeout(() => {
          if (res.token) {
            onVoiceVerified(res.token);
            navigate("/dashboard");
          } else if (mfaRequirements.requires_totp) {
            onVoiceVerified(null);
            navigate("/verify-totp");
          }
        }, 1500);
      } else {
        setStatus("failed");
        setTimeout(() => fetchChallenge(), 2000);
      }
    } catch (err) {
      setError(err.detail || "Verification failed");
      setStatus("failed");
      setTimeout(() => fetchChallenge(), 2000);
    }
  };

  const handleBackupCode = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await verifyBackupCode(preAuthToken, backupCode);
      if (res.success && res.token) {
        onVoiceVerified(res.token);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.detail || "Invalid backup code");
    }
  };

  if (!preAuthToken) return null;

  return (
    <div className="page-center">
      <div className="mfa-container animate-scale-in">
        <div className="auth-header">
          <div className="auth-icon">🎙</div>
          <h1 className="auth-title">Voice Verification</h1>
          <p className="auth-subtitle">
            Read the challenge phrase aloud to verify your identity
          </p>
        </div>

        {error && (
          <div className="alert alert-error animate-slide-in">
            <span>⚠</span> {error}
          </div>
        )}

        {challenge && status !== "success" && (
          <div className="challenge-phrase animate-fade-in">
            <div className="challenge-label">📢 Please say:</div>
            <div className="challenge-text">{challenge.phrase}</div>
          </div>
        )}

        <div className="recording-area">
          {status === "recording" && (
            <>
              <AudioVisualizer level={recorder.audioLevel} isRecording />
              {recorder.countdown !== null && (
                <div className="countdown-text">{recorder.countdown}s remaining</div>
              )}
            </>
          )}

          {status === "processing" && (
            <div style={{ textAlign: "center" }}>
              <div className="spinner" style={{ width: 40, height: 40 }} />
              <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
                Analyzing voice...
              </p>
            </div>
          )}

          {status === "success" && result && (
            <div className="score-display animate-scale-in" style={{ background: "var(--success-bg)" }}>
              <div className="score-value" style={{ color: "var(--success)" }}>
                ✓ {result.score ? `${(result.score * 100).toFixed(1)}%` : "Verified"}
              </div>
              <div className="score-label">Voice identity confirmed</div>
            </div>
          )}

          {status === "failed" && result && (
            <div className="score-display animate-scale-in" style={{ background: "var(--error-bg)" }}>
              <div className="score-value" style={{ color: "var(--error)" }}>
                ✗ {result.score ? `${(result.score * 100).toFixed(1)}%` : "Failed"}
              </div>
              <div className="score-label">{result.message}</div>
            </div>
          )}

          {(status === "idle" || status === "failed") && challenge && (
            <button
              className={`record-btn ${status === "recording" ? "record-btn--recording" : ""}`}
              onClick={handleRecord}
              disabled={status === "loading"}
              id="record-button"
            >
              🎤
            </button>
          )}

          {status === "idle" && challenge && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Click the microphone and read the phrase above
            </p>
          )}
        </div>

        {recorder.error && (
          <div className="alert alert-error animate-slide-in">
            <span>⚠</span> {recorder.error}
          </div>
        )}

        <div className="backup-option">
          {!showBackupInput ? (
            <button onClick={() => setShowBackupInput(true)}>
              Use a backup code instead
            </button>
          ) : (
            <form onSubmit={handleBackupCode} style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                type="text"
                placeholder="Enter backup code"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                style={{ flex: 1 }}
                id="backup-code-input"
              />
              <button type="submit" className="btn btn-secondary btn-sm" id="backup-code-submit">
                Verify
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
