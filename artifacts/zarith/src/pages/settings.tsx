import { useState, useEffect } from "react";
import { Eye, EyeOff, Save, RefreshCw, Cpu, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SettingsData {
  groqApiKey: string | null;
  groqApiKeySet: boolean;
  geminiApiKey: string | null;
  geminiApiKeySet: boolean;
}

interface KeyFieldProps {
  label: string;
  provider: string;
  maskedValue: string | null;
  isSet: boolean;
  fieldKey: "groqApiKey" | "geminiApiKey";
  onSave: (field: "groqApiKey" | "geminiApiKey", value: string) => Promise<void>;
  saving: boolean;
}

function KeyField({ label, provider, maskedValue, isSet, fieldKey, onSave, saving }: KeyFieldProps) {
  const [editing, setEditing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await onSave(fieldKey, value);
    setValue("");
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <motion.div
      layout
      className="bg-black border border-primary/20 rounded-sm p-5 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <KeyRound className="w-4 h-4 text-primary" />
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{provider}</p>
            <p className="text-sm font-mono text-foreground font-semibold">{label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.div key="saved" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </motion.div>
            ) : isSet ? (
              <motion.div key="set" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Active</span>
              </motion.div>
            ) : (
              <motion.div key="unset" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Not Set</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {!editing ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 px-3 py-2 bg-primary/5 border border-primary/20 rounded-sm font-mono text-sm text-muted-foreground tracking-widest">
            {maskedValue ?? "— not configured —"}
          </div>
          <Button
            onClick={() => setEditing(true)}
            size="sm"
            className="bg-primary/10 text-primary border border-primary/30 hover:bg-primary hover:text-black font-mono uppercase text-xs rounded-sm"
          >
            Edit
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="flex-1 relative">
            <Input
              type={visible ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste new API key..."
              className="bg-primary/5 border-primary/30 text-primary font-mono text-sm rounded-sm pr-10 focus-visible:ring-primary"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
            >
              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button
            onClick={handleSave}
            disabled={!value.trim() || saving}
            size="sm"
            className="bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-black font-mono uppercase text-xs rounded-sm"
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
          <Button
            onClick={() => { setEditing(false); setValue(""); }}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive font-mono uppercase text-xs rounded-sm"
          >
            Cancel
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json() as SettingsData;
      setSettings(data);
    } catch {
      setError("Unable to connect to ZARITH core. Check API server status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async (field: "groqApiKey" | "geminiApiKey", value: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Update failed");
      const data = await res.json() as SettingsData & { success: boolean };
      setSettings(data);
    } catch {
      setError("Failed to update configuration.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 flex flex-col h-full overflow-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-mono font-bold text-primary tracking-widest uppercase">
            System Config
          </h1>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">
            API Keys & Runtime Parameters
          </p>
        </div>
        <Button
          onClick={fetchSettings}
          disabled={loading}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary font-mono uppercase text-xs rounded-sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 px-4 py-3 border border-destructive/30 bg-destructive/5 rounded-sm font-mono text-xs text-destructive"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Cpu className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">AI Providers</h2>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-black border border-primary/10 rounded-sm p-5 h-28 animate-pulse" />
            ))}
          </div>
        ) : settings ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <KeyField
              label="API Key"
              provider="Groq — Llama 3 70B"
              maskedValue={settings.groqApiKey}
              isSet={settings.groqApiKeySet}
              fieldKey="groqApiKey"
              onSave={handleSave}
              saving={saving}
            />
            <KeyField
              label="API Key"
              provider="Google Gemini"
              maskedValue={settings.geminiApiKey}
              isSet={settings.geminiApiKeySet}
              fieldKey="geminiApiKey"
              onSave={handleSave}
              saving={saving}
            />
          </motion.div>
        ) : null}

        <div className="mt-8 pt-6 border-t border-primary/10">
          <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
            Keys updated here apply immediately to the current session. For permanent persistence across restarts, update them in Replit Secrets.
          </p>
        </div>
      </div>
    </div>
  );
}
