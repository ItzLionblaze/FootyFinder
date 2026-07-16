"use client";

import { createContext, useContext, useEffect, useState } from "react";

const API_URL = "http://localhost:8000";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  async function loginWithGoogle(googleToken) {
    const response = await fetch(`${API_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: googleToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Google sign-in failed");
    }

    const data = await response.json();
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setAccessToken(data.access_token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setAccessToken(null);
    setUser(null);
  }

  useEffect(() => {
    async function restoreSession() {
      const savedToken = localStorage.getItem("access_token");
      const savedUser = localStorage.getItem("user");

      if (!savedToken || !savedUser) {
        setAuthLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const freshUser = await response.json();
        setAccessToken(savedToken);
        setUser(freshUser);
        localStorage.setItem("user", JSON.stringify(freshUser));
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
      } finally {
        setAuthLoading(false);
      }
    }

    restoreSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, authLoading, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
