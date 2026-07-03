import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getMe } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [preAuthToken, setPreAuthToken] = useState(null);
  const [sessionToken, setSessionToken] = useState(
    () => localStorage.getItem("voicemfa_token") || null
  );
  const [mfaRequirements, setMfaRequirements] = useState({
    requires_voice: false,
    requires_totp: false,
  });
  const [voiceVerified, setVoiceVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionToken) {
      getMe(sessionToken)
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem("voicemfa_token");
          setSessionToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loginStep1 = useCallback((token, requirements) => {
    if (!requirements.requires_voice && !requirements.requires_totp) {
      setSessionToken(token);
      localStorage.setItem("voicemfa_token", token);
      getMe(token).then(setUser).catch(console.error);
    } else {
      setPreAuthToken(token);
      setMfaRequirements(requirements);
      setVoiceVerified(false);
    }
  }, []);

  const onVoiceVerified = useCallback(
    (fullToken) => {
      setVoiceVerified(true);
      if (fullToken) {
        setSessionToken(fullToken);
        setPreAuthToken(null);
        localStorage.setItem("voicemfa_token", fullToken);
        getMe(fullToken).then(setUser).catch(console.error);
      }
    },
    []
  );

  const onTotpVerified = useCallback((fullToken) => {
    setSessionToken(fullToken);
    setPreAuthToken(null);
    localStorage.setItem("voicemfa_token", fullToken);
    getMe(fullToken).then(setUser).catch(console.error);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setPreAuthToken(null);
    setSessionToken(null);
    setMfaRequirements({ requires_voice: false, requires_totp: false });
    setVoiceVerified(false);
    localStorage.removeItem("voicemfa_token");
  }, []);

  const refreshUser = useCallback(async () => {
    if (sessionToken) {
      try {
        const u = await getMe(sessionToken);
        setUser(u);
      } catch {
        // ignore
      }
    }
  }, [sessionToken]);

  const value = {
    user,
    preAuthToken,
    sessionToken,
    mfaRequirements,
    voiceVerified,
    loading,
    isAuthenticated: !!sessionToken && !!user,
    isInMfaFlow: !!preAuthToken && !sessionToken,
    loginStep1,
    onVoiceVerified,
    onTotpVerified,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
