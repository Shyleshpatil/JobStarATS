import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileText,
  KeyRound,
  Lightbulb,
  Loader2,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  X
} from 'lucide-react'

const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey'

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function scoreColor(score) {
  if (score >= 80) return { ring: '#22c55e', text: 'text-emerald-400', label: 'Strong match' }
  if (score >= 60) return { ring: '#f59e0b', text: 'text-amber-400', label: 'Moderate match' }
  return { ring: '#ef4444', text: 'text-red-400', label: 'Weak match' }
}

function ScoreRing({ score }) {
  const size = 168
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const { ring, text, label } = scoreColor(score)

  // Animate from 0 to the real score on mount / change.
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf
    const start = performance.now()
    const duration = 900
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(eased * score))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score])

  const offset = circumference - (display / 100) * circumference

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ring}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke 0.4s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-5xl font-extrabold tabular-nums ${text}`}>{display}</span>
        <span className="text-xs font-medium uppercase tracking-widest text-slate-500">/ 100</span>
        <span className={`mt-1 text-xs font-semibold ${text}`}>{label}</span>
      </div>
    </div>
  )
}

function Card({ className = '', children }) {
  return (
    <div
      className={`rounded-2xl border border-white/5 bg-base-800/70 shadow-card backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  )
}

function ListCard({ icon: Icon, iconClass, title, items, emptyText, numbered }) {
  return (
    <Card className="p-6 animate-fade-up">
      <div className="mb-4 flex items-center gap-3">
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <span className="ml-auto rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-slate-400">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-300">
              <span className="mt-0.5 shrink-0">
                {numbered ? (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-accent/15 text-[11px] font-bold text-accent-soft">
                    {i + 1}
                  </span>
                ) : (
                  <span className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-slate-500" />
                )}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Onboarding (no API key yet)
// ---------------------------------------------------------------------------

function ApiKeyForm({ initialValue = '', onSave, onCancel, busy }) {
  const [value, setValue] = useState(initialValue)
  const [touched, setTouched] = useState(false)
  const valid = value.trim().length > 20

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (valid) onSave(value.trim())
      }}
      className="space-y-5"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-300">Gemini API Key</label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="AIza..."
            className="w-full rounded-xl border border-white/10 bg-base-900/80 py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/30"
          />
        </div>
        {touched && !valid && (
          <p className="mt-1.5 text-xs text-red-400">That key looks too short — paste the full key.</p>
        )}
      </div>

      <a
        href={AI_STUDIO_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-soft transition hover:text-accent"
      >
        Get a free key at Google AI Studio
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Save & Continue
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        Stored locally on this device. Your key and resume never leave your machine except to call Gemini directly.
      </p>
    </form>
  )
}

function Onboarding({ onSave, busy }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-deep shadow-glow">
            <Target className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-50">JobStar ATS Optimizer</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Connect your Gemini API key to start matching resumes against job descriptions.
          </p>
        </div>
        <ApiKeyForm onSave={onSave} busy={busy} />
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dropzone
// ---------------------------------------------------------------------------

function Dropzone({ file, onPick, onClear, disabled }) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault()
      setDragging(false)
      if (disabled) return
      const dropped = e.dataTransfer.files?.[0]
      if (!dropped) return
      const path = window.api.getPathForFile(dropped)
      onPick(path)
    },
    [disabled, onPick]
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={async () => {
        if (disabled || file) return
        const path = await window.api.openFileDialog()
        if (path) onPick(path)
      }}
      className={`group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
        dragging
          ? 'border-accent bg-accent/10'
          : file
            ? 'border-emerald-500/40 bg-emerald-500/5 cursor-default'
            : 'border-white/10 bg-base-900/40 hover:border-accent/50 hover:bg-accent/5'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      {file ? (
        <>
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-emerald-500/15">
            <FileText className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="max-w-full truncate text-sm font-semibold text-slate-100">{file.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {file.words.toLocaleString()} words extracted
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        </>
      ) : (
        <>
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-accent/15 transition group-hover:scale-105">
            <UploadCloud className="h-6 w-6 text-accent-soft" />
          </div>
          <p className="text-sm font-semibold text-slate-200">Drop your resume here</p>
          <p className="mt-1 text-xs text-slate-500">or click to browse — PDF or DOCX</p>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Model settings (dynamic discovery + manual/custom override)
// ---------------------------------------------------------------------------

function ModelSettings({ onChange }) {
  const [current, setCurrent] = useState('') // saved model ('' => auto)
  const [list, setList] = useState([])
  const [recommended, setRecommended] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('select') // 'select' | 'custom'
  const [selected, setSelected] = useState('')
  const [custom, setCustom] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const savedModel = await window.api.getModel()
      setCurrent(savedModel)
      const { models, recommended: rec } = await window.api.listModels()
      setList(models)
      setRecommended(rec || '')
      if (savedModel && !models.some((m) => m.id === savedModel)) {
        // Saved a custom id not in the list — show it in the custom field.
        setMode('custom')
        setCustom(savedModel)
      } else {
        setMode('select')
        setSelected(savedModel || rec || models[0]?.id || '')
      }
    } catch (e) {
      setError(e.message || 'Could not load models.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flashUpdate = () => {
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1600)
  }

  const save = async () => {
    const value = (mode === 'custom' ? custom : selected).trim()
    await window.api.setModel(value)
    setCurrent(value)
    onChange?.(value)
    flashUpdate()
  }

  const useAuto = async () => {
    await window.api.setModel('') // clear → next analysis auto-resolves
    setCurrent('')
    setMode('select')
    setSelected(recommended || list[0]?.id || '')
    onChange?.('')
    flashUpdate()
  }

  return (
    <div className="mt-6 border-t border-white/5 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Cpu className="h-4 w-4 text-accent-soft" />
          Analysis Model
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-white/5 disabled:opacity-50"
          title="Refresh model list"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        Active:{' '}
        <span className="font-medium text-slate-300">
          {current || 'Auto — best available flash model'}
        </span>
      </p>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Discovering models for your key…
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mode toggle */}
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setMode('select')}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                mode === 'select'
                  ? 'bg-accent/20 text-accent-soft'
                  : 'text-slate-400 hover:bg-white/5'
              }`}
            >
              Choose from list
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                mode === 'custom'
                  ? 'bg-accent/20 text-accent-soft'
                  : 'text-slate-400 hover:bg-white/5'
              }`}
            >
              Custom model
            </button>
          </div>

          {mode === 'select' ? (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={!list.length}
              className="w-full rounded-xl border border-white/10 bg-base-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
            >
              {!list.length && <option value="">No models found</option>}
              {list.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                  {m.id === recommended ? '  (recommended)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="e.g. gemini-4-flash"
              className="w-full rounded-xl border border-white/10 bg-base-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/30"
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep"
            >
              {justSaved ? <CheckCircle2 className="h-4 w-4" /> : null}
              {justSaved ? 'Saved' : 'Save model'}
            </button>
            <button
              onClick={useAuto}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5"
              title="Clear override and auto-pick the best current model each run"
            >
              Use auto
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Auto picks the highest-version <span className="text-slate-400">flash</span> model your
            key can access, and self-heals if a model is ever deprecated.
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [booting, setBooting] = useState(true)
  const [hasKey, setHasKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [jobDescription, setJobDescription] = useState('')
  const [file, setFile] = useState(null) // { name, text, words }
  const [parsing, setParsing] = useState(false)

  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [activeModel, setActiveModel] = useState('')

  const resultRef = useRef(null)

  useEffect(() => {
    Promise.all([window.api.getApiKey(), window.api.getModel()]).then(([key, model]) => {
      setHasKey(Boolean(key))
      setActiveModel(model || '')
      setBooting(false)
    })
  }, [])

  // If a deprecated model is auto-swapped mid-analysis, reflect the new one.
  useEffect(() => {
    const unsub = window.api.onModelSwitched(({ to }) => setActiveModel(to))
    return unsub
  }, [])

  // Subscribe to backoff retry events from the main process.
  useEffect(() => {
    const unsub = window.api.onAiRetry(({ attempt, totalRetries, delay }) => {
      setLoadingMsg(
        `Servers are busy — retrying (${attempt}/${totalRetries}) in ${Math.round(delay / 1000)}s…`
      )
    })
    return unsub
  }, [])

  const saveKey = async (key) => {
    setSavingKey(true)
    await window.api.setApiKey(key)
    setSavingKey(false)
    setHasKey(true)
    setShowSettings(false)
  }

  const clearKey = async () => {
    await window.api.clearApiKey()
    setHasKey(false)
    setShowSettings(false)
    setResult(null)
  }

  const pickFile = async (path) => {
    setError('')
    setParsing(true)
    try {
      const { text, name } = await window.api.parseFile(path)
      const words = text.split(/\s+/).filter(Boolean).length
      setFile({ name, text, words })
    } catch (err) {
      setError(err.message || 'Could not read that file.')
      setFile(null)
    } finally {
      setParsing(false)
    }
  }

  const canAnalyze = jobDescription.trim().length > 30 && file && !loading && !parsing

  const runAnalysis = async () => {
    if (!canAnalyze) return
    setLoading(true)
    setError('')
    setResult(null)
    setLoadingMsg('Analysing your resume against the job description…')
    try {
      const data = await window.api.analyze({
        jobDescription: jobDescription.trim(),
        resumeText: file.text
      })
      setResult(data)
      if (data.model) setActiveModel(data.model)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  if (!hasKey) {
    return <Onboarding onSave={saveKey} busy={savingKey} />
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-base-900/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-deep shadow-glow">
            <Target className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-50">JobStar ATS Optimizer</h1>
            <p className="text-xs text-slate-500">Match. Optimize. Get interviews.</p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Inputs */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="flex flex-col p-6">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent-soft" />
              <h2 className="text-sm font-semibold text-slate-200">Job Description</h2>
            </div>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here…"
              className="min-h-[220px] flex-1 resize-none rounded-xl border border-white/10 bg-base-900/60 p-4 text-sm leading-relaxed text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            />
            <p className="mt-2 text-xs text-slate-600">
              {jobDescription.trim().split(/\s+/).filter(Boolean).length} words
            </p>
          </Card>

          <Card className="flex flex-col p-6">
            <div className="mb-3 flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-accent-soft" />
              <h2 className="text-sm font-semibold text-slate-200">Your Resume</h2>
            </div>
            <div className="flex-1">
              {parsing ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-base-900/40">
                  <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extracting text…
                  </span>
                </div>
              ) : (
                <Dropzone file={file} onPick={pickFile} onClear={() => setFile(null)} />
              )}
            </div>
          </Card>
        </div>

        {/* Action */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={runAnalysis}
            disabled={!canAnalyze}
            className="group inline-flex w-full max-w-sm items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-accent to-accent-deep px-6 py-4 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5 transition group-hover:scale-110" />
            )}
            {loading ? 'Analyzing…' : 'Analyze Match'}
          </button>
          {loading && loadingMsg && (
            <p className="flex items-center gap-2 text-xs text-slate-400">
              {loadingMsg.includes('busy') ? (
                <RotateCcw className="h-3.5 w-3.5 animate-spin text-amber-400" />
              ) : (
                <Activity className="h-3.5 w-3.5 text-accent-soft" />
              )}
              {loadingMsg}
            </p>
          )}
          {!canAnalyze && !loading && (
            <p className="text-xs text-slate-600">
              Add a job description and upload a resume to enable analysis.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 animate-fade-up">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div ref={resultRef} className="mt-10 space-y-6">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-white/5" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Analysis Results
              </span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
              <Card className="flex flex-col items-center justify-center p-8 animate-fade-up">
                <h3 className="mb-6 text-sm font-semibold text-slate-300">Overall Match Score</h3>
                <ScoreRing score={result.match_score} />
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
                  <span className="rounded-full bg-white/5 px-2.5 py-1">
                    {result.missing_keywords.length} keywords to add
                  </span>
                  <span className="rounded-full bg-white/5 px-2.5 py-1">
                    {result.red_flags.length} red flags
                  </span>
                </div>
              </Card>

              <ListCard
                icon={Target}
                iconClass="bg-accent/15 text-accent-soft"
                title="Missing Keywords"
                items={result.missing_keywords}
                emptyText="No critical keywords missing — great coverage."
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ListCard
                icon={AlertTriangle}
                iconClass="bg-red-500/15 text-red-400"
                title="Red Flags"
                items={result.red_flags}
                emptyText="No red flags detected."
              />
              <ListCard
                icon={Lightbulb}
                iconClass="bg-amber-500/15 text-amber-400"
                title="Actionable Suggestions"
                items={result.actionable_suggestions}
                emptyText="No further suggestions."
                numbered
              />
            </div>
          </div>
        )}

        <footer className="mt-12 pb-6 text-center text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <Cpu className="h-3 w-3" />
            {activeModel || 'Auto model'}
          </span>
          <span className="mx-2">·</span>
          Powered by Google Gemini · Your data stays on this device.
        </footer>
      </main>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <Card className="max-h-[88vh] w-full max-w-md overflow-y-auto p-7 animate-fade-up">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-100">
                <Settings className="h-5 w-5 text-accent-soft" />
                Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <KeyRound className="h-4 w-4 text-accent-soft" />
              Gemini API Key
            </h3>
            <ApiKeyForm
              onSave={saveKey}
              onCancel={() => setShowSettings(false)}
              busy={savingKey}
            />
            <button
              onClick={clearKey}
              className="mt-4 w-full rounded-xl border border-red-500/20 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
            >
              Remove saved key
            </button>

            <ModelSettings onChange={(m) => setActiveModel(m)} />
          </Card>
        </div>
      )}
    </div>
  )
}
