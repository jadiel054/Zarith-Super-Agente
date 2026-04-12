import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { TerminalSquare, Shield, ArrowRight, Loader2, Mail, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useSendOtp, useVerifyOtp } from "@workspace/api-client-react";
import { writeAuthStorage } from "@/hooks/use-auth";

const SESSION_EMAIL_KEY = "zarith_login_email";
const SESSION_STEP_KEY = "zarith_login_step";

export default function Login() {
  const [, setLocation] = useLocation();

  // Restore email + step from sessionStorage so mobile minimise doesn't wipe the form
  const [step, setStep] = useState<"email" | "otp">(() => {
    const saved = sessionStorage.getItem(SESSION_STEP_KEY);
    return saved === "otp" ? "otp" : "email";
  });
  const [email, setEmail] = useState(() => {
    return sessionStorage.getItem(SESSION_EMAIL_KEY) ?? "";
  });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  // Keep sessionStorage in sync
  useEffect(() => {
    sessionStorage.setItem(SESSION_EMAIL_KEY, email);
  }, [email]);

  useEffect(() => {
    sessionStorage.setItem(SESSION_STEP_KEY, step);
  }, [step]);

  const extractError = (err: unknown): string => {
    if (!err) return "Unknown error";
    const e = err as any;
    const serverMsg = e?.data?.message ?? e?.data?.error ?? null;
    if (serverMsg) return serverMsg;
    return e?.message ?? String(err);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    sendOtp.mutate({ data: { email } }, {
      onSuccess: (res) => {
        if (res.success) {
          setStep("otp");
        } else {
          setError(res.message ?? "OTP send failed.");
        }
      },
      onError: (err) => {
        console.error("[login] send-otp error:", err);
        setError(extractError(err));
      },
    });
  };

  const handleOtpComplete = (value: string) => {
    if (value.length !== 6 || verifyOtp.isPending) return;
    setError(null);
    verifyOtp.mutate({ data: { email, token: value } }, {
      onSuccess: (res) => {
        if (res.success) {
          writeAuthStorage(email, res.accessToken ?? null);
          // Clear session state — login complete
          sessionStorage.removeItem(SESSION_EMAIL_KEY);
          sessionStorage.removeItem(SESSION_STEP_KEY);
          setLocation("/dashboard");
        } else {
          setError(res.message ?? "Authorization code rejected.");
          setOtp("");
        }
      },
      onError: (err) => {
        console.error("[login] verify-otp error:", err);
        setError(extractError(err));
        setOtp("");
      },
    });
  };

  const handleAbort = () => {
    setStep("email");
    setError(null);
    setOtp("");
    sessionStorage.removeItem(SESSION_STEP_KEY);
  };

  const isPending = sendOtp.isPending || verifyOtp.isPending;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden scan-lines px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,255,0.05)_0%,rgba(0,0,0,0)_70%)]" />

      <div className="absolute top-6 left-6 opacity-20 font-mono text-xs text-primary space-y-1 select-none pointer-events-none hidden sm:block">
        <p>INIT_SEQUENCE_0x992</p>
        <p>CONNECTING_SECURE_RELAY...</p>
        <p>HANDSHAKE_ESTABLISHED</p>
        <p className="animate-pulse">AWAITING_CREDENTIALS</p>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-6 sm:p-8 bg-black border border-primary/20 shadow-[0_0_30px_rgba(0,255,255,0.05)] relative z-10 rounded-sm"
      >
        {/* Corner brackets */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary" />

        <div className="flex flex-col items-center mb-8 text-center">
          <TerminalSquare className="w-12 h-12 text-primary mb-4" />
          <h1 className="font-mono text-3xl font-bold tracking-[0.2em] text-primary">ZARITH</h1>
          <p className="text-muted-foreground font-mono text-xs mt-2 uppercase tracking-widest">
            Executive AI Super-Agent
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === "email" ? (
            <motion.form
              key="email-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleEmailSubmit}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-xs font-mono text-primary uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-3 h-3" />
                  Operator Identity
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@command.net"
                  disabled={isPending}
                  data-testid="input-email"
                  className="bg-black/50 border-primary/30 font-mono text-primary placeholder:text-primary/20 focus-visible:ring-primary focus-visible:border-primary h-12"
                />
              </div>

              {error && (
                <p className="text-xs font-mono text-destructive text-center break-all">{error}</p>
              )}

              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-submit-email"
                className="w-full h-12 font-mono uppercase tracking-widest bg-primary/10 text-primary border border-primary/50 hover:bg-primary hover:text-black transition-all"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Transmitting...</>
                ) : (
                  <>Initialize Sequence <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </motion.form>
          ) : (
            <motion.div
              key="otp-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 flex flex-col items-center"
            >
              <div className="text-center space-y-2 w-full">
                <label className="text-xs font-mono text-primary uppercase tracking-wider flex items-center justify-center gap-2">
                  <Mail className="w-3 h-3" />
                  Authorization Code
                </label>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Code transmitted to{" "}
                  <span className="text-primary break-all">{email}</span>
                </p>
                <p className="text-[10px] font-mono text-primary/50 mt-1">
                  [ Local mode: check the API Server console log ]
                </p>
              </div>

              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                onComplete={handleOtpComplete}
                disabled={isPending}
                data-testid="input-otp"
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="w-11 h-14 sm:w-12 sm:h-14 bg-black border-primary/30 text-primary font-mono text-xl focus:border-primary rounded-sm"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              {isPending && (
                <div className="flex items-center gap-2 text-primary font-mono text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Verifying authorization...
                </div>
              )}

              {error && (
                <p className="text-xs font-mono text-destructive text-center break-all">{error}</p>
              )}

              <Button
                variant="ghost"
                onClick={handleAbort}
                disabled={isPending}
                className="text-xs font-mono text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Abort &amp; Retry
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
