import { useState, useEffect } from "react";
import { Eye, EyeOff, Save, RefreshCw, Cpu, Mic2, Globe, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SettingsData {
  groqApiKey: string | null; groqApiKeySet: boolean;
  openaiApiKey: string | null; openaiApiKeySet: boolean;
  anthropicApiKey: string | null; anthropicApiKeySet: boolean;
  geminiApiKey: string | null; geminiApiKeySet: boolean;
  elevenLabsApiKey: string | null; elevenLabsApiKeySet: boolean;
  elevenLabsVoiceId: string | null; elevenLabsVoiceIdSet: boolean;
  googleMapsApiKey: string | null; googleMapsApiKeySet: boolean;
  searchApiKey: string | null; searchApiKeySet: boolean;
}

// ── Types ────────────────────────────────────────────────────────────────────

type FieldKey = keyof Pick<SettingsData,
  "groqApiKey" | "openaiApiKey" | "anthropicApiKey" | "geminiApiKey" |
  "elevenLabsApiKey" | "elevenLabsVoiceId" | "googleMapsApiKey" | "searchApiKey"
>;

interface FieldDef {
  fieldKey: FieldKey;
  label: string;
  placeholder?: string;
  isVoiceId?: boolean;
}

interface ProviderGroup {
  icon: React.ReactNode;
  title: string;
  category: string;
  fields: FieldDef[];
}

// ── Provider configuration ───────────────────────────────────────────────────

const PROVIDERS: ProviderGroup[] = [
  {
    icon: <Cpu className="w-4 h-4 text-primary" />,
    title: "AI Models",
    category: "LANGUAGE MODELS — GEMINI É O CORE PRINCIPAL",
    fields: [
      { fieldKey: "geminiApiKey", label: "Google Gemini 2.5 Flash — CORE PRINCIPAL", placeholder: "AIza..." },
      { fieldKey: "anthropicApiKey", label: "Anthropic — Claude 3.5 (Fallback #1)", placeholder: "sk-ant-..." },
      { fieldKey: "openaiApiKey", label: "OpenAI — GPT-4o (Fallback #2)", placeholder: "sk-..." },
    ],
  },
  {
    icon: <Mic2 className="w-4 h-4 text-secondary" />,
    title: "Voice",
    category: "TEXT-TO-SPEECH",
    fields: [
      { fieldKey: "elevenLabsApiKey", label: "ElevenLabs — API Key", placeholder: "Paste your ElevenLabs key..." },
      { fieldKey: "elevenLabsVoiceId", label: "ElevenLabs — Voice ID", placeholder: "e.g. 21m00Tcm4TlvDq8ikWAM", isVoiceId: true },
    ],
  },
  {
    icon: <Globe className="w-4 h-4 text-primary" />,
    title: "Services",
    category: "EXTERNAL APIS",
    fields: [
      { fieldKey: "googleMapsApiKey", label: "Google Maps API", placeholder: "AIza..." },
      { fieldKey: "searchApiKey", label: "Search API (SerpAPI / Tavily)", placeholder: "Paste search API key..." },
    ],
  },
];

// ── Key status helper ────────────────────────────────────────────────────────

function isSet(settings: SettingsData | null, key: FieldKey): boolean {
  const setKey = (key + "Set") as keyof SettingsData;
  return Boolean(settings?.[setKey]);
}

function maskedValue(settings: SettingsData | null, key: FieldKey): string | null {
  return settings?.[key] as string | null ?? null;
}

// ── Inline editable field ────────────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  fieldKey: FieldKey;
  masked: string | null;
  set: boolean;
  isVoiceId?: boolean;
  onSave: (key: FieldKey, value: string) => Promise<void>;
  saving: boolean;
}

function FieldRow({ label, fieldKey, masked, set, isVoiceId, onSave, saving }: FieldRowProps) {
  const [editing, setEditing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSave = async () => {
    await onSave(fieldKey, value);
    setValue("");
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="py-3 border-b border-primary/5 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.div key="saved" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              </motion.div>
            ) : set ? (
              <motion.div key="active" className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            ) : (
              <motion.div key="inactive">
                <AlertCircle className="w-3 h-3 text-muted-foreground/40 shrink-0" />
              </motion.div>
            )}
          </AnimatePresence>
          <span className="text-xs font-mono text-foreground/80 truncate">{label}</span>
        </div>

        {!editing && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-muted-foreground tracking-widest hidden sm:block">
              {masked ?? "—"}
            </span>
            <Button
              onClick={() => setEditing(true)}
              size="sm"
              className="h-6 px-2 text-[10px] bg-primary/5 text-primary/60 border border-primary/20 hover:bg-primary/10 hover:text-primary font-mono uppercase rounded-sm"
            >
              Edit
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-3"
          >
            <div className="flex gap-2">
              <div
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-sm border bg-primary/5 transition-all duration-200 ${
                  focused
                    ? "border-primary shadow-[0_0_12px_rgba(0,255,255,0.3)]"
                    : "border-primary/25"
                }`}
              >
                <input
                  type={visible || isVoiceId ? "text" : "password"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={isVoiceId ? "Voice ID..." : "Paste API key..."}
                  autoFocus
                  className="flex-1 bg-transparent outline-none font-mono text-xs text-primary placeholder:text-primary/25"
                />
                {!isVoiceId && (
                  <button type="button" onClick={() => setVisible((v) => !v)} className="text-muted-foreground hover:text-primary transition-colors">
                    {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <Button
                onClick={handleSave}
                disabled={!value.trim() || saving}
                size="sm"
                className="h-auto px-3 bg-primary/10 text-primary border border-primary/30 hover:bg-primary hover:text-black font-mono uppercase text-[10px] rounded-sm"
              >
                <Save className="w-3 h-3 mr-1" />Save
              </Button>
              <Button
                onClick={() => { setEditing(false); setValue(""); }}
                variant="ghost"
                size="sm"
                className="h-auto px-2 text-muted-foreground hover:text-destructive text-[10px] font-mono rounded-sm"
              >
                ✕
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Provider Card ────────────────────────────────────────────────────────────

interface ProviderCardProps {
  group: ProviderGroup;
  settings: SettingsData | null;
  onSave: (key: FieldKey, value: string) => Promise<void>;
  saving: boolean;
}

function ProviderCard({ group, settings, onSave, saving }: ProviderCardProps) {
  const [open, setOpen] = useState(true);
  const activeCount = group.fields.filter((f) => isSet(settings, f.fieldKey)).length;

  return (
    <motion.div layout className="bg-black border border-primary/15 rounded-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-primary/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          {group.icon}
          <div className="text-left">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">{group.category}</p>
            <p className="text-sm font-mono text-foreground font-semibold">{group.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${
            activeCount > 0
              ? "text-primary border-primary/30 bg-primary/5"
              : "text-muted-foreground border-muted-foreground/20"
          }`}>
            {activeCount}/{group.fields.length} active
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 border-t border-primary/10">
              {group.fields.map((field) => (
                <FieldRow
                  key={field.fieldKey}
                  label={field.label}
                  fieldKey={field.fieldKey}
                  masked={maskedValue(settings, field.fieldKey)}
                  set={isSet(settings, field.fieldKey)}
                  isVoiceId={field.isVoiceId}
                  onSave={onSave}
                  saving={saving}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { email } = useAuth();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = () => ({
    "Content-Type": "application/json",
    ...(email ? { "X-User-Email": email } : {}),
  });

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/settings`, { headers: headers() });
      if (!res.ok) throw new Error("Failed to load settings");
      setSettings(await res.json() as SettingsData);
    } catch {
      setError("Unable to connect to ZARITH core. Check API server status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, [email]);

  const handleSave = async (key: FieldKey, value: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ [key]: value }),
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

  const totalActive = settings
    ? Object.entries(settings).filter(([k, v]) => k.endsWith("Set") && v === true).length
    : 0;

  return (
    <div className="flex-1 p-4 sm:p-6 flex flex-col h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-mono font-bold text-primary tracking-widest uppercase">
            System Config
          </h1>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">
            API Keys · Runtime Parameters · {email ? <span className="text-primary">{email}</span> : "No session"}
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
          Sync
        </Button>
      </div>

      {/* Summary bar */}
      {!loading && settings && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 px-4 py-3 bg-primary/5 border border-primary/15 rounded-sm flex items-center gap-3"
        >
          <div className="flex-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-mono text-primary">{totalActive} of 8 providers active</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {email ? "Keys saved to your profile" : "Log in to persist keys"}
          </span>
        </motion.div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mb-4 px-4 py-3 border border-destructive/30 bg-destructive/5 rounded-sm font-mono text-xs text-destructive"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3 max-w-2xl pb-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-black border border-primary/10 rounded-sm h-20 animate-pulse" />
            ))}
          </div>
        ) : (
          PROVIDERS.map((group) => (
            <ProviderCard
              key={group.title}
              group={group}
              settings={settings}
              onSave={handleSave}
              saving={saving}
            />
          ))
        )}

        {!loading && (
          <div className="pt-4 border-t border-primary/10">
            <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
              Keys are saved to your profile in the database and loaded automatically on login. Runtime updates apply immediately for the current session.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
