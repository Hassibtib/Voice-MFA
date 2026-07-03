const BASE = "/api";

class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request(method, path, { body, token, isForm } = {}) {
  const headers = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!isForm && body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  let data;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = { detail: await res.text() };
  }

  if (!res.ok) {
    throw new ApiError(res.status, data.detail || "Something went wrong");
  }

  return data;
}

export function register(username, email, password) {
  return request("POST", "/auth/register", {
    body: { username, email, password },
  });
}

export function login(username, password) {
  return request("POST", "/auth/login", {
    body: { username, password },
  });
}

export function verifyVoice(token, challengeId, audioBlob) {
  const form = new FormData();
  form.append("challenge_id", challengeId);
  form.append("audio", audioBlob, "recording.wav");
  return request("POST", "/auth/verify-voice", {
    token,
    body: form,
    isForm: true,
  });
}

export function verifyTotp(token, code) {
  return request("POST", "/auth/verify-totp", {
    token,
    body: { code },
  });
}

export function verifyBackupCode(token, code) {
  return request("POST", "/auth/verify-backup-code", {
    token,
    body: { code },
  });
}

export function getMe(token) {
  return request("GET", "/auth/me", { token });
}

export function getChallenge(token) {
  return request("GET", "/challenge", { token });
}

export function getEnrollmentStatus(token) {
  return request("GET", "/enrollment/voice/status", { token });
}

export function uploadVoiceSample(token, audioBlob) {
  const form = new FormData();
  form.append("audio", audioBlob, "sample.wav");
  return request("POST", "/enrollment/voice/sample", {
    token,
    body: form,
    isForm: true,
  });
}

export function completeEnrollment(token) {
  return request("POST", "/enrollment/voice/complete", { token });
}

export function deleteEnrollment(token) {
  return request("DELETE", "/enrollment/voice", { token });
}

export function totpSetup(token) {
  return request("POST", "/totp/setup", { token });
}

export function totpVerifySetup(token, code) {
  return request("POST", "/totp/verify-setup", { token, body: { code } });
}

export function totpDisable(token) {
  return request("POST", "/totp/disable", { token });
}

export function getAuditLogs(token, limit = 50) {
  return request("GET", `/audit/logs?limit=${limit}`, { token });
}

export function healthCheck() {
  return request("GET", "/health");
}
