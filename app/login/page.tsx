"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Gavel, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [authError, setAuthError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function validateForm() {
    const errors: typeof fieldErrors = {};
    if (isRegistering && !name.trim()) {
      errors.name = "Please enter your name.";
    }
    if (!username.trim()) {
      errors.username = "Please enter your username.";
    }
    if (isRegistering && !email.trim()) {
      errors.email = "Please enter your email.";
    }
    if (!password) {
      errors.password = "Please enter your password.";
    } else if (isRegistering && password.length < 8) {
      errors.password = "Use at least 8 characters.";
    }
    if (isRegistering && password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(isRegistering ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegistering
            ? { name: name.trim(), username: username.trim(), email: email.trim(), password }
            : { username: username.trim(), password }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to sign in. Please try again.");
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      setAuthError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-lg shadow-slate-100 p-8 sm:p-10 transition-all">
      {/* Brand Icon & Heading */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-200/80">
          <Gavel className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {isRegistering ? "Create Your Account" : "Welcome Back"}
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          {isRegistering
            ? "Register to bid on and list campus items."
            : "Sign in to your Campus Auction account to continue."}
        </p>
      </div>

      {/* Authentication Error Banner */}
      {authError && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span className="font-medium leading-relaxed">{authError}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {isRegistering && (
          <>
            <div>
              <label htmlFor="name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                disabled={isLoading}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {fieldErrors.name && <p className="text-xs text-red-600 mt-1.5">{fieldErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                disabled={isLoading}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {fieldErrors.email && <p className="text-xs text-red-600 mt-1.5">{fieldErrors.email}</p>}
            </div>
          </>
        )}

        {/* Username Field */}
        <div>
          <label
            htmlFor="username"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="Enter your username"
            value={username}
            disabled={isLoading}
            onChange={(e) => {
              setUsername(e.target.value);
              if (fieldErrors.username) {
                setFieldErrors((prev) => ({ ...prev, username: undefined }));
              }
              if (authError) setAuthError("");
            }}
            className={`w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
              fieldErrors.username
                ? "border-red-300 focus:ring-red-400 focus:border-red-400 bg-red-50/20"
                : "border-slate-200 hover:border-slate-300 focus:ring-blue-500 focus:border-transparent bg-white"
            }`}
          />
          {fieldErrors.username && (
            <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5 inline" />
              {fieldErrors.username}
            </p>
          )}
          {isRegistering && (
            <p className="text-[11px] text-slate-500 mt-1">3–24 characters: letters, numbers, and underscores.</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isRegistering ? "new-password" : "current-password"}
              placeholder="Enter your password"
              value={password}
              disabled={isLoading}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
                if (authError) setAuthError("");
              }}
              className={`w-full pl-4 pr-11 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
                fieldErrors.password
                  ? "border-red-300 focus:ring-red-400 focus:border-red-400 bg-red-50/20"
                  : "border-slate-200 hover:border-slate-300 focus:ring-blue-500 focus:border-transparent bg-white"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-md transition"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-slate-600" />
              ) : (
                <Eye className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5 inline" />
              {fieldErrors.password}
            </p>
          )}
        </div>

        {isRegistering && (
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              disabled={isLoading}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-red-600 mt-1.5">{fieldErrors.confirmPassword}</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm tracking-wide shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isRegistering ? "Creating account..." : "Signing in..."}</span>
            </>
          ) : (
            <span>{isRegistering ? "Create Account" : "Sign In"}</span>
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-500 leading-relaxed">
          {isRegistering ? "Already have an account?" : "Don’t have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setFieldErrors({});
              setAuthError("");
            }}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            {isRegistering ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-xs text-slate-500 mt-2">Loading...</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
