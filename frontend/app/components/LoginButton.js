"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";

export default function LoginButton() {
  const { user, authLoading, loginWithGoogle, logout } = useAuth();
  const hasGoogleClientId = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

  if (authLoading) {
    return (
      <span className="text-xs text-zinc-500">Loading account...</span>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {user.picture ? (
          <img
            src={user.picture}
            alt={`${user.first_name} profile`}
            className="h-8 w-8 rounded-full border border-zinc-200"
          />
        ) : null}
        <div className="hidden text-right sm:block">
          <p className="text-xs font-medium text-zinc-900">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-xs text-zinc-500">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (!hasGoogleClientId) {
    return null;
  }

  return (
    <GoogleLogin
      onSuccess={async (response) => {
        try {
          await loginWithGoogle(response.credential);
        } catch (error) {
          alert(error.message);
        }
      }}
      onError={() => {
        alert("Google sign-in failed. Please try again.");
      }}
      theme="outline"
      size="medium"
      text="signin_with"
      shape="rectangular"
    />
  );
}
