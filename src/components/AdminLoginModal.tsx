"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useConfig } from "@/context/ConfigContext";

export const AdminLoginModal: React.FC = () => {
  const { isAdminLoginModalOpen, closeAdminLoginModal, login } = useConfig();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Transition animations
  const [shouldRender, setShouldRender] = useState(isAdminLoginModalOpen);
  const [isVisible, setIsVisible] = useState(isAdminLoginModalOpen);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAdminLoginModalOpen) {
      setShouldRender(true);
      setIsVisible(true);
      setPassword("");
      setAuthError(null);
      setShowPassword(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setIsVisible(false);
      timer = setTimeout(() => {
        setShouldRender(false);
        setPassword("");
        setAuthError(null);
      }, 200);
    }
    return () => clearTimeout(timer);
  }, [isAdminLoginModalOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAdminLoginModalOpen && !isAuthenticating) {
        closeAdminLoginModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdminLoginModalOpen, isAuthenticating, closeAdminLoginModal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isAuthenticating) return;

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const res = await login(password);
      if (res.success) {
        closeAdminLoginModal();
      } else {
        setAuthError(res.error || "Authentication failed");
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Authentication error");
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!shouldRender) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-modal-title"
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#080808]/85 backdrop-blur-sm transition-opacity duration-200 ease-out ${
        isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isAuthenticating) closeAdminLoginModal();
      }}
    >
      <div
        className={`w-full max-w-[420px] bg-[#0E0E0D] border border-[#26261F] text-[#EDEDE8] shadow-2xl flex flex-col overflow-hidden font-sans transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] transform will-change-[transform,opacity] ${
          isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.97] translate-y-2"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#26261F] bg-[#121211] select-none">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-music-accent" />
            <h2
              id="admin-login-modal-title"
              className="font-mono text-[12px] tracking-[0.16em] text-[#EDEDE8] uppercase whitespace-nowrap"
            >
              [ ADMIN AUTHENTICATION ]
            </h2>
          </div>
          <button
            type="button"
            onClick={closeAdminLoginModal}
            disabled={isAuthenticating}
            title="Close (Esc)"
            className="text-[#6A6A64] hover:text-[#EDEDE8] p-1 cursor-pointer transition-colors focus:outline-none disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="admin-login-password"
              className="block font-mono text-[10px] tracking-[0.1em] text-[#6A6A64] uppercase"
            >
              MASTER PASSWORD
            </label>
            <div className="relative flex items-center bg-[#141413] border border-[#26261F] focus-within:border-music-accent transition-colors">
              <input
                ref={inputRef}
                id="admin-login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) setAuthError(null);
                }}
                placeholder="Enter admin password..."
                className="w-full bg-transparent border-0 text-[#EDEDE8] font-mono text-[12px] px-3 py-2 focus:outline-none placeholder:text-[#52524C]"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="px-2.5 text-[#6A6A64] hover:text-[#EDEDE8] cursor-pointer focus:outline-none"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {authError && (
            <div className="font-mono text-[10px] tracking-[0.06em] text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-1.5">
              [ {authError.toUpperCase()} ]
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isAuthenticating || !password.trim()}
              className="w-full py-2 px-4 bg-music-accent text-black font-mono text-[11px] font-bold uppercase tracking-[0.08em] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>AUTHENTICATING...</span>
                </>
              ) : (
                <span>UNLOCK</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
