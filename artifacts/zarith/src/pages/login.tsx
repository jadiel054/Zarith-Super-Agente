import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { TerminalSquare, Shield, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function Login() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes("@")) {
      setStep("otp");
    }
  };

  const handleOtpComplete = (value: string) => {
    if (value.length === 6) {
      // Simulate verification delay
      setTimeout(() => {
        localStorage.setItem("zarith_authenticated", "true");
        setLocation("/dashboard");
      }, 800);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden scan-lines">
      {/* Background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,255,0.05)_0%,rgba(0,0,0,0)_70%)]"></div>
      
      <div className="absolute top-10 left-10 opacity-20 font-mono text-xs text-primary space-y-1 select-none pointer-events-none hidden sm:block">
        <p>INIT_SEQUENCE_0x992</p>
        <p>CONNECTING_SECURE_RELAY...</p>
        <p>HANDSHAKE_ESTABLISHED</p>
        <p className="animate-pulse">AWAITING_CREDENTIALS</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 bg-black border border-primary/20 shadow-[0_0_30px_rgba(0,255,255,0.05)] relative z-10 rounded-sm"
      >
        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

        <div className="flex flex-col items-center mb-8 text-center">
          <TerminalSquare className="w-12 h-12 text-primary mb-4" />
          <h1 className="font-mono text-3xl font-bold tracking-[0.2em] text-primary glitch" data-text="ZARITH">
            ZARITH
          </h1>
          <p className="text-muted-foreground font-mono text-xs mt-2 uppercase tracking-widest">
            Executive AI Super-Agent
          </p>
        </div>

        {step === "email" ? (
          <motion.form 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
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
                className="bg-black/50 border-primary/30 font-mono text-primary placeholder:text-primary/20 focus-visible:ring-primary focus-visible:border-primary h-12"
              />
            </div>
            <Button type="submit" className="w-full h-12 font-mono uppercase tracking-widest bg-primary/10 text-primary border border-primary/50 hover:bg-primary hover:text-black transition-all">
              Initialize Sequence
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.form>
        ) : (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6 flex flex-col items-center"
          >
            <div className="text-center space-y-2 w-full">
              <label className="text-xs font-mono text-secondary uppercase tracking-wider flex items-center justify-center gap-2">
                <Shield className="w-3 h-3" />
                Enter Authorization Code
              </label>
              <p className="text-[10px] font-mono text-muted-foreground">Code transmitted to secure relay.</p>
            </div>
            
            <InputOTP 
              maxLength={6} 
              value={otp} 
              onChange={setOtp}
              onComplete={handleOtpComplete}
              className="gap-2"
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot 
                    key={index} 
                    index={index} 
                    className="w-12 h-14 bg-black border-primary/30 text-primary font-mono text-xl focus:border-secondary focus:ring-secondary/50 rounded-sm"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>

            <Button 
              variant="ghost" 
              onClick={() => setStep("email")}
              className="text-xs font-mono text-muted-foreground hover:text-primary"
            >
              Abort & Retry
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}