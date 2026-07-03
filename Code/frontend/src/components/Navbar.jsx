import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar" id="main-navbar">
      <Link to="/" className="navbar-brand">
        <span className="navbar-icon">🎙</span>
        <span className="navbar-title">Voice MFA</span>
      </Link>

      <div className="navbar-links">
        {isAuthenticated ? (
          <>
            <Link to="/dashboard" className="navbar-link" id="nav-dashboard">
              Dashboard
            </Link>
            <Link to="/enroll" className="navbar-link" id="nav-enroll">
              Voice Enroll
            </Link>
            <Link to="/totp-setup" className="navbar-link" id="nav-totp">
              TOTP
            </Link>
            <div className="navbar-user">
              <span className="navbar-username">{user?.username}</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleLogout}
                id="nav-logout"
              >
                Logout
              </button>
            </div>
          </>
        ) : (
          <>
            <Link to="/login" className="navbar-link" id="nav-login">
              Login
            </Link>
            <Link to="/register" className="navbar-link" id="nav-register">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
