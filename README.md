# JobStar ATS Optimizer

A standalone desktop app that scores your resume against a job description using
Google Gemini — built with **Electron + React + Tailwind CSS**. Bring your own
Gemini API key (stored locally); your resume and key never leave your machine
except to call Gemini directly.

## Features

- 🔐 **BYOK** — API key saved locally with `electron-store`
- 📄 **Native parsing** — `pdf-parse` (PDF) and `mammoth` (DOCX) in the main process
- 🤖 **Gemini** — strict JSON output via `responseSchema`
- 🔁 **Fail-proof** — exponential backoff (2s → 4s → 8s → 16s) on 503/429/500 with a live "retrying…" message
- 🎛️ **Executive UI** — deep-slate palette, score ring, keyword chips, red flags & suggestions

## 1. Prerequisites

- Node.js 18+ and npm
- A free Gemini API key: https://aistudio.google.com/app/apikey

## 2. Setup

This repo already contains all source files. Just install dependencies:

```powershell
npm install
```

> Starting from scratch instead? The equivalent boilerplate is:
> `npm create @quick-start/electron@latest` (choose the **React** template),
> then add `tailwindcss postcss autoprefixer lucide-react @google/generative-ai electron-store@^8 pdf-parse mammoth`.

## 3. Run in development

```powershell
npm run dev
```

On first launch you'll be asked for your Gemini API key.

## 4. Build the standalone executable

**Windows (.exe installer):**

```powershell
npm run build:win
```

The installer (`JobStar ATS Optimizer-1.0.0-Setup.exe`) is written to the
`release/` folder.

Other platforms:

```powershell
npm run build:mac     # .dmg   (run on macOS)
npm run build:linux   # AppImage
```

## Configuration notes

- **Model (dynamic, future-proof):** the model is **not** hardcoded. On first analysis the
  app calls Gemini's `listModels` for your key and auto-selects the highest-version `flash`
  model, saving it. You can override it in **Settings → Analysis Model** (pick from the live
  dropdown or type a custom id). If a saved model is ever deprecated and 404s mid-analysis,
  the app clears it, re-discovers the best current model, and retries automatically.
  `FALLBACK_MODEL` in `src/main/index.js` is only used if discovery fails (e.g. offline).
- **Backoff:** tune `retries` / `baseDelay` in `withBackoff()` in `src/main/index.js`.
- **AI guardrail:** the system instruction that keeps rewrites truthful lives in
  `SYSTEM_INSTRUCTION` in `src/main/index.js`.

## Project structure

```
src/
  main/index.js       Electron backend: IPC, PDF/DOCX parsing, Gemini + backoff
  preload/index.js    contextBridge API (the only renderer↔Node surface)
  renderer/
    index.html
    src/App.jsx       React UI (onboarding, dashboard, results)
    src/index.css     Tailwind + base styling
```
