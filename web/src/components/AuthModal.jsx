import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  X,
  Mail,
  KeyRound,
  User,
  Building,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { authClient } from "../lib/api";
import { signInFormSchema, registrationFormSchema, otpFormSchema } from "../lib/validations";

const RESEND_COOLDOWN_SECONDS = 60;

const ERROR_MESSAGES = {
  INVALID_OTP: "Incorrect verification code. Please check the code and try again.",
  OTP_EXPIRED: "This verification code has expired. Please request a new code.",
  TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Please request a new code.",
};

// Better Auth client calls resolve to { data, error }; turn errors into throws for TanStack Query
const unwrap = async (request) => {
  const { data, error } = await request;
  if (error) {
    const err = new Error(
      ERROR_MESSAGES[error.code] ||
        (error.status === 429 && !error.message
          ? "Too many requests. Please wait a minute and try again."
          : error.status >= 500 || !error.message
          ? "Something went wrong. Please try again."
          : error.message)
    );
    err.code = error.code;
    throw err;
  }
  return data;
};

const inputClass = (hasError, extra = "text-sm") =>
  `w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/70 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition ${extra} ${
    hasError ? "border-red-500 focus:ring-red-500" : "border-zinc-200 dark:border-zinc-700 focus:ring-indigo-500"
  }`;

const labelClass = "block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5";

const submitClass =
  "w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer";

function FieldError({ error }) {
  if (!error) return null;
  return (
    <p className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
      <AlertCircle size={13} /> {error.message}
    </p>
  );
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState("sign-in"); // "sign-in" | "register"
  const [step, setStep] = useState("details"); // "details" | "verify"
  const [pending, setPending] = useState(null); // { email, name?, company? } awaiting OTP
  const [resendTimer, setResendTimer] = useState(0);
  const [serverError, setServerError] = useState("");
  const [serverSuccess, setServerSuccess] = useState("");

  // Countdown timer for resend OTP
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((t) => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const signInForm = useForm({
    resolver: zodResolver(signInFormSchema),
    defaultValues: { email: "" },
  });

  const registerForm = useForm({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: { name: "", company: "", email: "" },
  });

  const otpForm = useForm({
    resolver: zodResolver(otpFormSchema),
    defaultValues: { otp: "" },
  });

  // Send (or resend) a sign-in code. The response is identical whether or not the email has an account.
  const sendOtpMutation = useMutation({
    mutationFn: (details) =>
      unwrap(authClient.emailOtp.sendVerificationOtp({ email: details.email, type: "sign-in" })),
    onSuccess: (_data, details) => {
      setPending(details);
      setServerSuccess(`We sent a 6-digit verification code to ${details.email}. It expires in 10 minutes.`);
      setServerError("");
      setStep("verify");
      setResendTimer(RESEND_COOLDOWN_SECONDS);
      otpForm.reset();
    },
    onError: (err) => {
      setServerError(err.message);
      setServerSuccess("");
    },
  });

  // Verify the code; Better Auth creates the account on first sign-in when registration details are sent
  const verifyOtpMutation = useMutation({
    mutationFn: ({ otp }) =>
      unwrap(
        authClient.signIn.emailOtp({
          email: pending.email,
          otp,
          ...(mode === "register" && { name: pending.name, company: pending.company || "" }),
        })
      ),
    onSuccess: (data) => {
      onAuthSuccess?.(data.user);
      handleModalClose();
    },
    onError: (err) => {
      setServerSuccess("");
      if (err.code === "REGISTRATION_DETAILS_REQUIRED") {
        // The code proved ownership of an email with no account yet: continue as registration
        registerForm.reset({ name: "", company: "", email: pending.email });
        setMode("register");
        setStep("details");
      }
      setServerError(err.message);
    },
  });

  if (!isOpen) return null;

  const handleModalClose = () => {
    setMode("sign-in");
    setStep("details");
    setPending(null);
    setServerError("");
    setServerSuccess("");
    signInForm.reset();
    registerForm.reset();
    otpForm.reset();
    onClose();
  };

  const switchMode = (next) => {
    if (next === mode) return;
    setMode(next);
    setServerError("");
    setServerSuccess("");
  };

  const sendCode = (values) => {
    setServerError("");
    setServerSuccess("");
    sendOtpMutation.mutate({ ...values, email: values.email.trim().toLowerCase() });
  };

  const handleResend = () => {
    if (resendTimer > 0 || !pending) return;
    sendCode(pending);
  };

  const isPending = sendOtpMutation.isPending || verifyOtpMutation.isPending;
  const isRegister = mode === "register";

  const { errors: signInErrors } = signInForm.formState;
  const { errors: registerErrors } = registerForm.formState;
  const { errors: otpErrors } = otpForm.formState;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-zinc-900 dark:text-zinc-100">
        {/* Close Button */}
        <button
          onClick={handleModalClose}
          className="absolute right-4 top-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-xl mx-auto flex items-center justify-center mb-3 shadow-inner">
            <KeyRound size={24} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {step === "verify" ? "Check Your Inbox" : isRegister ? "Create Your Account" : "Welcome Back"}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {step === "verify"
              ? "Enter the 6-digit verification code we emailed you"
              : isRegister
              ? "Set up your profile to activate your personal cloud canvas"
              : "Access your isolated personal whiteboards across any device"}
          </p>
        </div>

        {/* Sign In / Create Account Tabs */}
        {step === "details" && (
          <div className="grid grid-cols-2 gap-1 p-1 mb-5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm font-semibold" role="tablist">
            {[
              ["sign-in", "Sign In"],
              ["register", "Create Account"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => switchMode(value)}
                className={`py-2 rounded-lg transition cursor-pointer ${
                  mode === value
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Server Alert Banners */}
        {serverError && (
          <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2.5 text-sm text-red-600 dark:text-red-400 animate-in fade-in duration-150">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span className="leading-snug">{serverError}</span>
          </div>
        )}

        {serverSuccess && step === "verify" && (
          <div role="status" className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-start gap-2.5 text-sm text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-150">
            <Inbox size={18} className="shrink-0 mt-0.5" />
            <span className="leading-snug">{serverSuccess}</span>
          </div>
        )}

        {/* ================= SIGN IN: EMAIL ================= */}
        {step === "details" && !isRegister && (
          <form onSubmit={signInForm.handleSubmit(sendCode)} className="space-y-4" noValidate>
            <div>
              <label className={labelClass}>Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus
                  {...signInForm.register("email")}
                  className={inputClass(signInErrors.email)}
                />
              </div>
              <FieldError error={signInErrors.email} />
            </div>

            <button type="submit" disabled={isPending} className={submitClass}>
              {isPending ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Sending Verification Code…</span>
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ================= CREATE ACCOUNT: DETAILS ================= */}
        {step === "details" && isRegister && (
          <form onSubmit={registerForm.handleSubmit(sendCode)} className="space-y-4" noValidate>
            <div>
              <label className={labelClass}>
                Your Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="e.g. Rakkesh Kumar"
                  autoComplete="name"
                  autoFocus
                  {...registerForm.register("name")}
                  className={inputClass(registerErrors.name)}
                />
              </div>
              <FieldError error={registerErrors.name} />
            </div>

            <div>
              <label className={labelClass}>
                Company / Organization <span className="text-zinc-400 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative">
                <Building size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="e.g. Vairaa Studio"
                  autoComplete="organization"
                  {...registerForm.register("company")}
                  className={inputClass(registerErrors.company)}
                />
              </div>
              <FieldError error={registerErrors.company} />
            </div>

            <div>
              <label className={labelClass}>
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  {...registerForm.register("email")}
                  className={inputClass(registerErrors.email)}
                />
              </div>
              <FieldError error={registerErrors.email} />
            </div>

            <button type="submit" disabled={isPending} className={submitClass}>
              {isPending ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Sending Verification Code…</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ================= VERIFY CODE ================= */}
        {step === "verify" && pending && (
          <form onSubmit={otpForm.handleSubmit((values) => verifyOtpMutation.mutate(values))} className="space-y-4" noValidate>
            {/* Active Email Chip */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs">
              <span className="text-zinc-700 dark:text-zinc-300 truncate font-mono">{pending.email}</span>
              <button
                type="button"
                onClick={() => {
                  setStep("details");
                  setServerError("");
                  setServerSuccess("");
                }}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold ml-2 cursor-pointer"
              >
                Change
              </button>
            </div>

            {/* 6-Digit OTP Input */}
            <div>
              <label className={labelClass}>6-Digit Verification Code</label>
              <div className="relative">
                <KeyRound size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  placeholder="• • • • • •"
                  {...otpForm.register("otp")}
                  className={inputClass(otpErrors.otp, "tracking-widest font-mono text-lg font-bold text-center")}
                />
              </div>
              <FieldError error={otpErrors.otp} />
            </div>

            <button type="submit" disabled={isPending} className={submitClass}>
              {verifyOtpMutation.isPending ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>{isRegister ? "Creating Account…" : "Verifying Code…"}</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? "Create Account & Start Drawing" : "Sign In to My Whiteboard"}</span>
                  <CheckCircle2 size={18} />
                </>
              )}
            </button>

            {/* Resend Code Section */}
            <div className="text-center pt-2">
              {resendTimer > 0 ? (
                <span className="text-xs text-zinc-400">
                  Resend code in <strong className="font-semibold text-zinc-600 dark:text-zinc-300">{resendTimer}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isPending}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer disabled:opacity-50"
                >
                  {sendOtpMutation.isPending ? "Sending…" : "Didn't receive code? Resend Email"}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
