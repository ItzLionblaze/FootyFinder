"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";

export default function Providers({ children }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  if (!clientId) {
    return (
      <AuthProvider>
        <div className="bg-yellow-50 px-4 py-2 text-center text-sm text-yellow-900">
          Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to frontend/.env.local to enable Google
          sign-in.
        </div>
        {children}
      </AuthProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>{children}</AuthProvider>
    </GoogleOAuthProvider>
  );
}
