import React, { useState, useEffect } from "react";
import { X, Mail, KeyRound, User, Building, ArrowRight, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { authApi } from "../lib/api";

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [step, setStep] = useState(1); // 1 = Email, 2 = OTP + Details
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [devOtp, setDevOtp] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((t) => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  if (!isOpen) return null;

  // Step 1: Send OTP
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await authApi.sendOtp(email.trim());
      setIsExistingUser(Boolean(res.isExistingUser));
      if (res.devOtp) {
        setDevOtp(res.devOtp);
      }
      setSuccessMsg(res.message);
      setStep(2);
      setResendTimer(60);
    } catch (err) {
      setError(err.message || "Failed to send verification code. Please check your network.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otp || otp.trim().length < 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (!isExistingUser && (!name || name.trim().length < 2)) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await authApi.verifyOtp({
        email: email.trim(),
        otp: otp.trim(),
        name: name.trim(),
        company: company.trim(),
      });

      if (onAuthSuccess) {
        onAuthSuccess(res.user, res.token);
      }

      onClose();
    } catch (err) {
      setError(err.message || "Verification failed. Please check the code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetToEmail = () => {
    setStep(1);
    setOtp("");
    setError("");
    setSuccessMsg("");
    setDevOtp(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-zinc-900 dark:text-zinc-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-xl mx-auto flex items-center justify-center mb-3">
            <KeyRound size={24} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {step === 1
              ? "Sign In / Register"
              : isExistingUser
              ? "Welcome Back!"
              : "Create Your Account"}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {step === 1
              ? "Access your isolated personal whiteboards across any device"
              : isExistingUser
              ? `Enter the 6-digit code sent to ${email}`
              : "Set up your profile to activate your personal cloud canvas"}
          </p>
        </div>

        {/* Alert / Error Banners */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Dev Mode OTP Quick Fill Banner */}
        {devOtp && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
            <div>
              <span className="font-semibold block">⚡ Development Mode OTP:</span>
              <span className="font-mono text-sm tracking-widest">{devOtp}</span>
            </div>
            <button
              type="button"
              onClick={() => setOtp(devOtp)}
              className="px-2.5 py-1 bg-amber-200 dark:bg-amber-800/60 hover:bg-amber-300 rounded text-amber-900 dark:text-amber-100 font-medium transition cursor-pointer"
            >
              Fill Code
            </button>
          </div>
        )}

        {/* ================= STEP 1: ENTER EMAIL ================= */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Sending Code…</span>
                </>
              ) : (
                <>
                  <span>Continue with OTP</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ================= STEP 2: VERIFY OTP + PROFILE ================= */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {/* Email summary pill */}
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs">
              <span className="text-zinc-600 dark:text-zinc-300 truncate font-mono">{email}</span>
              <button
                type="button"
                onClick={handleResetToEmail}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium ml-2 cursor-pointer"
              >
                Change
              </button>
            </div>

            {/* 6-digit OTP Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                6-Digit Verification Code
              </label>
              <div className="relative">
                <KeyRound size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="w-full pl-10 pr-4 py-2.5 tracking-widest font-mono text-base font-semibold bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Additional Fields for New User Registration */}
            {!isExistingUser && (
              <div className="space-y-3 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    Company / Organization
                  </label>
                  <div className="relative">
                    <Building size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="e.g. Acme Inc. (optional)"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Verifying…</span>
                </>
              ) : isExistingUser ? (
                <>
                  <span>Sign In to My Whiteboard</span>
                  <CheckCircle2 size={18} />
                </>
              ) : (
                <>
                  <span>Create Account & Start Drawing</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* Resend timer */}
            <div className="text-center pt-2">
              {resendTimer > 0 ? (
                <span className="text-xs text-zinc-400">
                  Resend code in <span className="font-semibold">{resendTimer}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                >
                  Didn&apos;t receive code? Resend Code
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

