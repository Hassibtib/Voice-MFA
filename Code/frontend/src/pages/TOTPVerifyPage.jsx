import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { verifyTotp, verifyBackupCode } from "../api/client";
import "./AuthPages.css";

export default function TOTPVerifyPage() {
  const { preAuthToken, isInMfaFlow, onTotpVerified, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const inputRefs = useRef([]);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
    else if (!isInMfaFlow) navigate("/login", { replace: true });
  }, [isAuthenticated, isInMfaFlow, navigate]);

  useEffect(() => {
    if (inputRefs.current[0]) inputRefs.current[0].focus();
  }, []);

  const handleDigit = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (value && index === 5 && next.every((d) => d)) {
      handleSubmit(next.join(""));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split("");
      setCode(digits);
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (otp) => {
    setError(null);
    setLoading(true);
    try {
      const res = await verifyTotp(preAuthToken, otp);
      if (res.success && res.token) {
        onTotpVerified(res.token);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.detail || "Invalid code");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await verifyBackupCode(preAuthToken, backupCode);
      if (res.success && res.token) {
        onTotpVerified(res.token);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.detail || "Invalid backup code");
    }
  };

  if (!preAuthToken) return null;

  return (
    <div className="page-center">
      <div className="mfa-container animate-scale-in" style={{ maxWidth: 420 }}>
        <div className="auth-header">
          <div className="auth-icon">🔑</div>
          <h1 className="auth-title">Two-Factor Auth</h1>
          <p className="auth-subtitle">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {error && (
          <div className="alert alert-error animate-slide-in">
            <span>⚠</span> {error}
          </div>
        )}

        {!showBackup ? (
          <>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                margin: "24px 0",
              }}
              onPaste={handlePaste}
            >
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  className="input"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={loading}
                  id={`totp-digit-${i}`}
                  style={{
                    width: 48,
                    height: 56,
                    textAlign: "center",
                    fontSize: "1.4rem",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                  }}
                />
              ))}
            </div>

            {loading && (
              <div className="text-center">
                <div className="spinner" />
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleBackup} style={{ margin: "24px 0" }}>
            <div className="input-group">
              <label htmlFor="backup-input">Backup Code</label>
              <input
                id="backup-input"
                className="input text-mono"
                type="text"
                placeholder="e.g. A1B2C3D4"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary mt-2"
              style={{ width: "100%" }}
              id="backup-submit"
            >
              Verify Backup Code
            </button>
          </form>
        )}

        <div className="backup-option">
          <button onClick={() => setShowBackup(!showBackup)}>
            {showBackup ? "Use authenticator app" : "Use a backup code instead"}
          </button>
        </div>
      </div>
    </div>
  );
}
