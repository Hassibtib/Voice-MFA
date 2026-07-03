import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../context/AuthContext";
import { totpSetup, totpVerifySetup, totpDisable } from "../api/client";
import "./TOTPSetupPage.css";

export default function TOTPSetupPage() {
  const { user, sessionToken, refreshUser } = useAuth();

  const [step, setStep] = useState("initial"); // initial | setup | verify | done | manage
  const [secret, setSecret] = useState(null);
  const [uri, setUri] = useState(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await totpSetup(sessionToken);
      setSecret(res.secret);
      setUri(res.provisioning_uri);
      setStep("setup");
    } catch (err) {
      setError(err.detail || "Setup failed");
    }
    setLoading(false);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await totpVerifySetup(sessionToken, code);
      if (res.success) {
        setBackupCodes(res.backup_codes);
        setStep("done");
        refreshUser();
      }
    } catch (err) {
      setError(err.detail || "Invalid code");
      setCode("");
    }
    setLoading(false);
  };

  const handleDisable = async () => {
    if (!window.confirm("Disable TOTP? You will no longer need a code to log in.")) return;
    setError(null);
    try {
      await totpDisable(sessionToken);
      setStep("initial");
      setSecret(null);
      setUri(null);
      setBackupCodes(null);
      refreshUser();
    } catch (err) {
      setError(err.detail || "Failed to disable");
    }
  };

  const isEnabled = user?.is_totp_enabled;

  return (
    <div className="page animate-fade-in">
      <div className="totp-container">
        <div className="auth-header">
          <div className="auth-icon">🔐</div>
          <h1 className="page-title">TOTP Authenticator</h1>
          <p className="page-subtitle">
            {isEnabled
              ? "Your authenticator app is linked"
              : "Add time-based one-time passwords for extra security"}
          </p>
        </div>

        {error && (
          <div className="alert alert-error animate-slide-in mb-2">
            <span>⚠</span> {error}
          </div>
        )}

        {isEnabled && step === "initial" && (
          <div className="card totp-card text-center">
            <span className="badge badge-success" style={{ fontSize: "0.9rem" }}>
              ✓ TOTP is enabled
            </span>
            <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
              A 6-digit code from your authenticator app is required during
              login.
            </p>
            <button
              className="btn btn-danger btn-sm mt-2"
              onClick={handleDisable}
              id="totp-disable-btn"
            >
              Disable TOTP
            </button>
          </div>
        )}

        {!isEnabled && step === "initial" && (
          <div className="card totp-card text-center">
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Link an authenticator app like Google Authenticator, Authy, or
              1Password to generate login codes.
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSetup}
              disabled={loading}
              id="totp-setup-btn"
            >
              {loading ? <span className="spinner" /> : "Begin Setup"}
            </button>
          </div>
        )}

        {step === "setup" && (
          <div className="card totp-card animate-scale-in">
            <h3 className="mb-2">1. Scan this QR code</h3>
            <div className="qr-wrapper">
              {uri && (
                <QRCodeSVG
                  value={uri}
                  size={200}
                  bgColor="transparent"
                  fgColor="#e2e8f0"
                  level="M"
                  id="totp-qr-code"
                />
              )}
            </div>

            <div className="secret-display">
              <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                Or enter manually:
              </span>
              <code className="secret-code" id="totp-secret-display">{secret}</code>
            </div>

            <h3 className="mt-3 mb-1">2. Enter verification code</h3>
            <form onSubmit={handleVerify} className="totp-verify-form">
              <input
                className="input text-mono"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                style={{ textAlign: "center", fontSize: "1.3rem", letterSpacing: "0.3em" }}
                id="totp-verify-input"
                autoFocus
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={code.length !== 6 || loading}
                id="totp-verify-btn"
              >
                {loading ? <span className="spinner" /> : "Verify & Enable"}
              </button>
            </form>
          </div>
        )}

        {step === "done" && backupCodes && (
          <div className="card totp-card animate-scale-in">
            <div className="alert alert-success mb-2">
              <span>✓</span> TOTP is now enabled!
            </div>

            <h3 className="mb-1">🔑 Backup Codes</h3>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
                marginBottom: 16,
              }}
            >
              Save these codes somewhere safe. Each can be used once if you lose
              access to your authenticator app.
            </p>

            <div className="backup-codes-grid" id="backup-codes-list">
              {backupCodes.map((code, i) => (
                <code key={i} className="backup-code">
                  {code}
                </code>
              ))}
            </div>

            <button
              className="btn btn-secondary mt-3"
              onClick={() => {
                navigator.clipboard.writeText(backupCodes.join("\n"));
                alert("Backup codes copied to clipboard!");
              }}
              id="copy-backup-codes"
            >
              📋 Copy All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
