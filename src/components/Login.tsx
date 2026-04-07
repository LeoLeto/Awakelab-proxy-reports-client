import { useState, type FormEvent } from "react";
import "./Login.css";
import backgroundImg from "../assets/BACK-REPROXY-8.png";
import reproxyLogoBlue from "../assets/REPROXY-logo-blue.png";
import poweredByImg from "../assets/AWAKELAB-POWERED-BY-01-8.png";

interface LoginProps {
  onLogin: (token: string, username: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      const response = await fetch(`${apiUrl}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.ok && data.token) {
        onLogin(data.token, data.username);
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-container"
      style={{ backgroundImage: `url(${backgroundImg})` }}
    >
      <div className="login-box">
        <div className="login-logo">
          <img src={reproxyLogoBlue} alt="Reproxy" />
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Nombre Usuario</label>
            <input
              id="username"
              type="text"
              placeholder="User name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
        <hr className="login-separator" />
        <p className="login-contact">Contacta a tu administrador para acceder</p>
      </div>

      <div className="login-powered-by">
        <img src={poweredByImg} alt="Powered by Awakelab" />
      </div>
    </div>
  );
}
