import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAuditLogs, getEnrollmentStatus } from "../api/client";
import "./DashboardPage.css";

export default function DashboardPage() {
  const { user, sessionToken, refreshUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    Promise.all([
      getAuditLogs(sessionToken, 20).catch(() => ({ logs: [], total: 0 })),
      getEnrollmentStatus(sessionToken).catch(() => null),
    ]).then(([auditData, enrollData]) => {
      setLogs(auditData.logs || []);
      setEnrollment(enrollData);
      setLoading(false);
    });
  }, [sessionToken]);

  const eventIcon = (type) => {
    const map = {
      REGISTER: "📝",
      LOGIN_PASSWORD: "🔑",
      VOICE_VERIFY_SUCCESS: "✅",
      VOICE_VERIFY_FAILED: "❌",
      TOTP_VERIFY_SUCCESS: "🔐",
      VOICE_SAMPLE_UPLOADED: "🎤",
      VOICE_ENROLLMENT_COMPLETE: "🎙",
      VOICE_ENROLLMENT_DELETED: "🗑",
      TOTP_ENABLED: "✅",
      TOTP_DISABLED: "⛔",
      TOTP_SETUP_STARTED: "⚙️",
      ACCOUNT_LOCKED: "🔒",
      BACKUP_CODE_USED: "🔓",
    };
    return map[type] || "📋";
  };

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div className="page animate-fade-in">
      <div className="dashboard">
        <div className="dash-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              Welcome back, <strong>{user?.username}</strong>
            </p>
          </div>
        </div>

        <div className="dash-grid">
          <div className="card dash-card">
            <div className="dash-card-header">
              <span className="dash-card-icon">🎙</span>
              <h3>Voice Biometric</h3>
            </div>
            <div className="dash-card-body">
              {user?.is_voice_enrolled ? (
                <>
                  <span className="badge badge-success">✓ Enrolled</span>
                  <p>
                    {enrollment?.samples_count || "–"} voice sample(s) on file
                  </p>
                </>
              ) : (
                <>
                  <span className="badge badge-warning">Not Enrolled</span>
                  <p>Set up voice authentication for stronger security</p>
                </>
              )}
            </div>
            <Link
              to="/enroll"
              className="btn btn-primary btn-sm"
              id="dash-enroll-link"
            >
              {user?.is_voice_enrolled ? "Manage" : "Enroll Now"}
            </Link>
          </div>

          <div className="card dash-card">
            <div className="dash-card-header">
              <span className="dash-card-icon">🔑</span>
              <h3>TOTP Authenticator</h3>
            </div>
            <div className="dash-card-body">
              {user?.is_totp_enabled ? (
                <>
                  <span className="badge badge-success">✓ Enabled</span>
                  <p>Authenticator app is linked</p>
                </>
              ) : (
                <>
                  <span className="badge badge-warning">Not Set Up</span>
                  <p>Add a second factor with your authenticator app</p>
                </>
              )}
            </div>
            <Link
              to="/totp-setup"
              className="btn btn-primary btn-sm"
              id="dash-totp-link"
            >
              {user?.is_totp_enabled ? "Manage" : "Set Up"}
            </Link>
          </div>

          <div className="card dash-card">
            <div className="dash-card-header">
              <span className="dash-card-icon">🛡</span>
              <h3>Security Level</h3>
            </div>
            <div className="dash-card-body">
              {user?.is_voice_enrolled && user?.is_totp_enabled ? (
                <>
                  <span className="badge badge-success">Maximum</span>
                  <p>Password + Voice + TOTP = 3 factors active</p>
                </>
              ) : user?.is_voice_enrolled || user?.is_totp_enabled ? (
                <>
                  <span className="badge badge-info">Good</span>
                  <p>
                    2 factors active. Enable{" "}
                    {!user?.is_voice_enrolled ? "voice" : "TOTP"} for maximum
                    security.
                  </p>
                </>
              ) : (
                <>
                  <span className="badge badge-error">Basic</span>
                  <p>Password only. Enable MFA for better protection.</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card dash-audit">
          <h3 style={{ marginBottom: 16 }}>
            <span style={{ marginRight: 8 }}>📋</span>
            Recent Activity
          </h3>
          {logs.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No activity yet.</p>
          ) : (
            <div className="audit-table-wrapper">
              <table className="audit-table" id="audit-log-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Event</th>
                    <th>Details</th>
                    <th>IP</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{eventIcon(log.event_type)}</td>
                      <td>
                        <span className="text-mono" style={{ fontSize: "0.8rem" }}>
                          {log.event_type}
                        </span>
                      </td>
                      <td style={{ maxWidth: 200, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {log.details?.score
                          ? `score: ${log.details.score}`
                          : log.details?.samples
                          ? `${log.details.samples} samples`
                          : log.details?.failed_attempts
                          ? `${log.details.failed_attempts} failed`
                          : "—"}
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {log.ip_address || "—"}
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
