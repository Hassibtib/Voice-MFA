import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import VoiceEnrollPage from "./pages/VoiceEnrollPage";
import VoiceVerifyPage from "./pages/VoiceVerifyPage";
import TOTPVerifyPage from "./pages/TOTPVerifyPage";
import TOTPSetupPage from "./pages/TOTPSetupPage";

export default function App() {
  const { isAuthenticated, isInMfaFlow, mfaRequirements, voiceVerified } = useAuth();

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/verify-voice" element={<VoiceVerifyPage />} />
        <Route path="/verify-totp" element={<TOTPVerifyPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/enroll"
          element={
            <ProtectedRoute>
              <VoiceEnrollPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/totp-setup"
          element={
            <ProtectedRoute>
              <TOTPSetupPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          }
        />
      </Routes>
    </>
  );
}
