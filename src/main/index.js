import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename, extname } from 'path'
import { readFile } from 'fs/promises'
import Store from 'electron-store'
import mammoth from 'mammoth'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
// Import the internal module directly to avoid pdf-parse's debug harness, which
// tries to read a bundled test PDF when the package index is required at top level.
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// The model is NOT hardcoded for normal operation — it is discovered dynamically from the
// user's own API key via listModels (see resolveModel). This constant is only a last-resort
// fallback if discovery fails (e.g. offline). It is verified current as of 2026-10-25, but
// the dynamic resolver is what keeps the app working after Google deprecates models.
const FALLBACK_MODEL = 'gemini-3.8-flash'

// REST base for the Generative Language API (used for listModels discovery).
const GENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Specialized model variants that should never be auto-selected as the analysis model.
const EXCLUDE_VARIANT = /(tts|audio|image|vision|live|embed|embedding|transcribe|aqa|learnlm|translate)/i

// electron-store persists the user's API key across sessions (Bring Your Own Key).
// encryptionKey obfuscates the file at rest; it is not a substitute for OS keychain
// security, but keeps the key out of plain sight on disk.
const store = new Store({
  name: 'jobstar-config',
  encryptionKey: 'jobstar-local-obfuscation-key'
})

// The base system instruction that constrains the AI's rewriting behaviour.
const SYSTEM_INSTRUCTION_BASE = `You are a senior technical recruiter and ATS (Applicant Tracking System) expert who reviews software developer resumes.

When suggesting resume improvements, do not alter the core truth of the candidate's work experience. Identify bottlenecks and suggest keyword integrations that map truthfully to their existing experience. Ensure all phrasing frames the candidate accurately for a developer role—specifically, avoid rephrasing that makes it sound like the candidate single-handedly owned or architected a project. Frame all achievements correctly as someone who worked on the systems as a developer.

Be rigorous and specific. Base every observation strictly on the provided resume and job description.`

// Build the system instruction with today's date injected at the very top, so the model
// evaluates timelines/career gaps against the real current date instead of its training cutoff
// (which otherwise makes it flag valid past dates as "in the future").
function buildSystemInstruction() {
  const today = new Date().toDateString()
  return `Today's current date is ${today}. Strictly evaluate all timelines, employment end dates, and career gaps in the resume relative to this exact current date. Do not flag dates prior to this current date as being in the future.

${SYSTEM_INSTRUCTION_BASE}`
}

// Strict JSON response schema enforced by the Gemini API.
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    match_score: {
      type: SchemaType.NUMBER,
      description: 'Overall match between the resume and job description, 0 to 100.'
    },
    missing_keywords: {
      type: SchemaType.ARRAY,
      description: 'Important skills/technologies/terms in the JD absent from the resume.',
      items: { type: SchemaType.STRING }
    },
    red_flags: {
      type: SchemaType.ARRAY,
      description: 'Concerns an ATS or recruiter would flag (gaps, mismatches, vague claims).',
      items: { type: SchemaType.STRING }
    },
    actionable_suggestions: {
      type: SchemaType.ARRAY,
      description: 'Concrete, truthful edits the candidate can make to improve the match.',
      items: { type: SchemaType.STRING }
    }
  },
  required: ['match_score', 'missing_keywords', 'red_flags', 'actionable_suggestions']
}

// ---------------------------------------------------------------------------
// Model discovery & resolution
// ---------------------------------------------------------------------------

// Fetch every model the given key can use for text generation.
async function fetchModels(apiKey) {
  const key = (apiKey || store.get('apiKey') || '').trim()
  if (!key) throw new Error('No Gemini API key configured.')

  // Paginate defensively in case the catalogue grows beyond one page.
  const collected = []
  let pageToken = ''
  do {
    const url =
      `${GENAI_BASE}/models?key=${encodeURIComponent(key)}&pageSize=200` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      const err = new Error(`Could not list models (HTTP ${res.status}). ${body.slice(0, 200)}`)
      err.status = res.status
      throw err
    }
    const data = await res.json()
    if (Array.isArray(data.models)) collected.push(...data.models)
    pageToken = data.nextPageToken || ''
  } while (pageToken)

  return collected
    .map((m) => ({
      id: String(m.name || '').replace(/^models\//, ''),
      displayName: m.displayName || '',
      methods: m.supportedGenerationMethods || []
    }))
    .filter((m) => m.id && m.methods.includes('generateContent'))
}

// Extract a comparable numeric version from a model id, e.g.
// "gemini-3.8-flash" -> 3.08, "gemini-3-flash-preview" -> 3, "gemini-2.5-flash" -> 2.05.
function parseVersion(id) {
  const m = String(id).match(/gemini-(\d+)(?:\.(\d+))?/i)
  if (!m) return -1
  return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) / 100 : 0)
}

// Pick the best general-purpose "flash" model: highest version, preferring the full
// (non-lite) stable variant over lite/preview ones.
function pickBestFlash(models) {
  const flash = models.filter((m) => /flash/i.test(m.id) && !EXCLUDE_VARIANT.test(m.id))
  if (!flash.length) return null
  const scored = flash
    .map((m) => ({
      id: m.id,
      version: parseVersion(m.id),
      isLite: /lite/i.test(m.id),
      isPreview: /preview|exp\b/i.test(m.id)
    }))
    .sort((a, b) => {
      if (b.version !== a.version) return b.version - a.version
      if (a.isLite !== b.isLite) return a.isLite ? 1 : -1 // prefer full flash over lite
      if (a.isPreview !== b.isPreview) return a.isPreview ? 1 : -1 // prefer stable over preview
      return a.id.localeCompare(b.id)
    })
  return scored[0].id
}

// Build the sorted list the Settings dropdown consumes, flagging the recommended one.
async function listModelsForUi(apiKey) {
  const models = await fetchModels(apiKey)
  const recommended = pickBestFlash(models)
  const sorted = [...models].sort((a, b) => {
    const av = parseVersion(a.id)
    const bv = parseVersion(b.id)
    if (bv !== av) return bv - av
    return a.id.localeCompare(b.id)
  })
  return {
    recommended,
    models: sorted.map((m) => ({ id: m.id, displayName: m.displayName }))
  }
}

// Resolve the model to use: the user's saved choice, else auto-pick the best flash model
// (and persist it). Falls back to FALLBACK_MODEL only if discovery fails entirely.
async function resolveModel(apiKey, { forceRefresh = false } = {}) {
  const saved = (store.get('model') || '').trim()
  if (saved && !forceRefresh) return saved
  try {
    const models = await fetchModels(apiKey)
    const best = pickBestFlash(models) || models[0]?.id
    if (best) {
      store.set('model', best)
      return best
    }
  } catch {
    // Discovery failed (offline / key issue) — fall back below.
  }
  return FALLBACK_MODEL
}

function isModelNotFound(err) {
  const status = err?.status ?? err?.response?.status
  const msg = String(err?.message || '')
  return status === 404 || /not found|notfound|is not supported|not supported for|unknown model/i.test(msg)
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b1220',
    title: 'JobStar ATS Optimizer',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Open external links (e.g. Google AI Studio) in the system browser.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite exposes the dev server URL in development; load the built file otherwise.
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ---------------------------------------------------------------------------
// Document parsing
// ---------------------------------------------------------------------------

async function extractResumeText(filePath) {
  const ext = extname(filePath).toLowerCase()
  const buffer = await readFile(filePath)

  let text = ''
  if (ext === '.pdf') {
    const data = await pdfParse(buffer)
    text = data.text || ''
  } else if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ buffer })
    text = value || ''
  } else if (ext === '.doc') {
    // Legacy binary .doc is not supported by mammoth.
    throw new Error('Legacy .doc files are not supported. Please export your resume as .docx or .pdf.')
  } else if (ext === '.txt') {
    text = buffer.toString('utf-8')
  } else {
    throw new Error(`Unsupported file type "${ext}". Please upload a .pdf or .docx resume.`)
  }

  text = text.replace(/\u0000/g, '').trim()
  if (!text) {
    throw new Error('No readable text found. If this is a scanned PDF (an image), export a text-based version.')
  }
  return { text, name: basename(filePath) }
}

// ---------------------------------------------------------------------------
// AI call with exponential backoff
// ---------------------------------------------------------------------------

function isRetriable(err) {
  const status = err?.status ?? err?.response?.status
  if (status === 503 || status === 429 || status === 500) return true
  const msg = String(err?.message || '')
  return /\b(503|429|500)\b|overloaded|unavailable|rate.?limit|try again|high demand/i.test(msg)
}

async function withBackoff(fn, { retries = 4, baseDelay = 2000, onRetry } = {}) {
  let attempt = 0
  // Total attempts = 1 initial + `retries` retries. Delays: 2s, 4s, 8s, 16s.
  while (true) {
    try {
      return await fn()
    } catch (err) {
      if (!isRetriable(err) || attempt >= retries) throw err
      const delay = baseDelay * 2 ** attempt
      attempt += 1
      if (onRetry) onRetry({ attempt, totalRetries: retries, delay })
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

function buildPrompt(jobDescription, resumeText) {
  return `Analyse how well the following resume matches the target job description.

=== JOB DESCRIPTION ===
${jobDescription}

=== RESUME ===
${resumeText}

Return ONLY a JSON object matching the required schema:
- "match_score": integer 0-100 reflecting true fit.
- "missing_keywords": concrete skills/tools/terms from the JD missing in the resume (deduplicated, most important first).
- "red_flags": issues an ATS or recruiter would notice.
- "actionable_suggestions": specific, truthful edits that raise the match without overstating the candidate's role.`
}

function normaliseResult(raw) {
  const clampScore = (n) => {
    const v = Number(n)
    if (!Number.isFinite(v)) return 0
    return Math.max(0, Math.min(100, Math.round(v)))
  }
  const toStringArray = (arr) =>
    Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : []

  return {
    match_score: clampScore(raw?.match_score),
    missing_keywords: toStringArray(raw?.missing_keywords),
    red_flags: toStringArray(raw?.red_flags),
    actionable_suggestions: toStringArray(raw?.actionable_suggestions)
  }
}

// Core single-model analysis run (one specific model id).
async function runAnalysis(event, key, modelId, jobDescription, resumeText) {
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: buildSystemInstruction(),
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA
    }
  })

  const result = await withBackoff(
    () => model.generateContent(buildPrompt(jobDescription, resumeText)),
    {
      onRetry: (info) => {
        // Tell the renderer so it can show "Servers are busy, retrying..."
        if (!event.sender.isDestroyed()) event.sender.send('ai:retry', info)
      }
    }
  )

  const text = result.response.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    // Safety net: pull the first {...} block if the model wrapped it.
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('The AI returned an unreadable response. Please try again.')
    parsed = JSON.parse(match[0])
  }
  return { ...normaliseResult(parsed), model: modelId }
}

async function analyze(event, { jobDescription, resumeText, apiKey }) {
  const key = (apiKey || store.get('apiKey') || '').trim()
  if (!key) throw new Error('No Gemini API key configured.')
  if (!jobDescription?.trim()) throw new Error('Job description is empty.')
  if (!resumeText?.trim()) throw new Error('Resume text is empty.')

  // Use the saved model, or auto-resolve the best current flash model and persist it.
  const modelId = await resolveModel(key)

  try {
    return await runAnalysis(event, key, modelId, jobDescription, resumeText)
  } catch (err) {
    // Auto-recovery: if the saved/chosen model was deprecated (404), the compiled app would
    // otherwise be stuck forever. Clear it, re-discover the best current model, and retry once.
    if (isModelNotFound(err)) {
      store.delete('model')
      const fresh = await resolveModel(key, { forceRefresh: true })
      if (fresh && fresh !== modelId) {
        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:modelSwitched', { from: modelId, to: fresh })
        }
        return await runAnalysis(event, key, fresh, jobDescription, resumeText)
      }
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

function toFriendlyError(err) {
  const msg = String(err?.message || err || 'Unknown error')
  if (/API key not valid|API_KEY_INVALID|invalid api key/i.test(msg)) {
    return 'Your Gemini API key was rejected. Please check it in Settings.'
  }
  if (/quota|RESOURCE_EXHAUSTED/i.test(msg)) {
    return 'Your Gemini quota is exhausted. Check your Google AI Studio usage limits.'
  }
  if (isRetriable({ message: msg })) {
    return 'Gemini is overloaded right now and did not recover after several retries. Please try again shortly.'
  }
  if (isModelNotFound({ message: msg })) {
    return 'The selected model is unavailable for your API key. Open Settings → Analysis Model and pick an available one.'
  }
  return msg
}

function registerIpcHandlers() {
  ipcMain.handle('store:getApiKey', () => store.get('apiKey') || '')
  ipcMain.handle('store:setApiKey', (_e, key) => {
    store.set('apiKey', String(key || '').trim())
    return true
  })
  ipcMain.handle('store:clearApiKey', () => {
    store.delete('apiKey')
    return true
  })

  // Model preference storage
  ipcMain.handle('store:getModel', () => store.get('model') || '')
  ipcMain.handle('store:setModel', (_e, model) => {
    const value = String(model || '').trim()
    if (value) store.set('model', value)
    else store.delete('model') // empty clears it → next analysis auto-resolves
    return true
  })

  // Discover the models available to the user's key (for the Settings dropdown).
  ipcMain.handle('ai:listModels', async (_e, apiKey) => {
    try {
      return await listModelsForUi(apiKey)
    } catch (err) {
      throw new Error(toFriendlyError(err))
    }
  })

  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select your resume',
      properties: ['openFile'],
      filters: [{ name: 'Resumes', extensions: ['pdf', 'docx', 'txt'] }]
    })
    if (canceled || !filePaths.length) return null
    return filePaths[0]
  })

  ipcMain.handle('file:parse', async (_e, filePath) => {
    try {
      return await extractResumeText(filePath)
    } catch (err) {
      throw new Error(toFriendlyError(err))
    }
  })

  ipcMain.handle('ai:analyze', async (event, payload) => {
    try {
      return await analyze(event, payload)
    } catch (err) {
      throw new Error(toFriendlyError(err))
    }
  })
}
