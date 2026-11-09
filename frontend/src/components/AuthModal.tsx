import React, { useState } from "react";
import { X, Lock, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
  } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setErrorMsg("");
    setIsSubmitting(true);

    if (mode === "signin") {
      const res = await signInWithEmail(email, password);
      if (res.error) setErrorMsg(res.error);
    } else {
      const res = await signUpWithEmail(email, password);
      if (res.error) setErrorMsg(res.error);
    }

    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={closeAuthModal}
      />

      {/* Modal Dialog (Warm Beige Tactile Console Card) */}
      <div className="relative z-10 max-w-md w-full bg-[#FAF6F0] rounded-3xl border-2 border-beige-300 shadow-tactile-card p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-beige-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-beige-200 flex items-center justify-center border border-beige-300">
              <Lock className="w-4 h-4 text-terracotta-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-primary font-mono tracking-tight">
                {mode === "signin" ? "Sign In to Terminal" : "Create Account"}
              </h3>
              <p className="text-[11px] text-ink-muted">Access custom watchlists and model operations</p>
            </div>
          </div>

          <button
            onClick={closeAuthModal}
            className="p-1 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-beige-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-beige-200/70 p-1 rounded-2xl border border-beige-300 shadow-tactile-well mb-4 text-xs font-mono font-medium">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setErrorMsg("");
            }}
            className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
              mode === "signin"
                ? "bg-white text-terracotta-600 shadow-tactile-btn font-bold"
                : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setErrorMsg("");
            }}
            className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
              mode === "signup"
                ? "bg-white text-terracotta-600 shadow-tactile-btn font-bold"
                : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            type="button"
            onClick={() => signInWithOAuth("google")}
            className="tactile-pill flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-mono font-medium text-ink-primary cursor-pointer hover:bg-beige-100/60 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.1 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.2C.7 9.6 0 12.3 0 15.2s.7 5.6 1.9 8l3.7-2.9c-.2-.7-.4-1.4-.4-2.3z"
              />
              <path
                fill="#34A853"
                d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.1-6.4-5.3L1.9 16.4C3.7 20.2 7.5 23.5 12 23.5z"
              />
            </svg>
            Google
          </button>

          <button
            type="button"
            onClick={() => signInWithOAuth("github")}
            className="tactile-pill flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-mono font-medium text-ink-primary cursor-pointer hover:bg-beige-100/60 transition-colors"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-beige-300" />
          <span className="text-[10px] uppercase tracking-wider text-ink-muted font-mono">or with email</span>
          <div className="flex-1 h-px bg-beige-300" />
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-mono">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-mono font-medium text-ink-secondary mb-1">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                required
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-mono border border-beige-300 bg-beige-100/60 shadow-inner focus:bg-white focus:outline-none text-ink-primary"
              />
              <Mail className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-ink-secondary mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-mono border border-beige-300 bg-beige-100/60 shadow-inner focus:bg-white focus:outline-none text-ink-primary"
              />
              <Lock className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="console-glow-button w-full py-2.5 rounded-xl text-xs font-mono font-bold text-white tracking-wider cursor-pointer mt-2"
          >
            {isSubmitting ? "Authenticating..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
};
