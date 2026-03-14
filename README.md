# Opus 4.6 Documentation Assistant

A premium AI-powered documentation assistant built with **Claude Opus 4.6** via [Puter.js](https://puter.com) — featuring real-time streaming, live web search, file attachments, and a beautiful dark UI.

![UI Preview](https://img.shields.io/badge/Claude-Opus%204.6-7c3aed?style=for-the-badge)
![Node](https://img.shields.io/badge/Node.js-Express-green?style=for-the-badge)

## Features

- ✦ **Claude Opus 4.6** — 1M context window, no API key needed (Puter.js handles it)
- 🌐 **Web Search Toggle** — Enable live Google search via SerpAPI when you need up-to-date info
- 📎 **File Attachments** — Attach `.js`, `.ts`, `.py`, `.md`, `.txt` etc. for the AI to analyze
- ⚡ **Real-time Streaming** — Tokens appear as Claude generates them
- 🎨 **Beautiful Dark UI** — Glassmorphism design with marked.js + highlight.js markdown rendering
- 💾 **Chat History** — Persisted across sessions via localStorage
- 📋 **Suggestion Chips** — One-click prompts to get started quickly

## Setup

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/opus-doc-assistant.git
cd opus-doc-assistant
npm install
```

### 2. Configure Environment
Create a `.env` file (never commit this!):
```env
SERPAPI_KEY=your_serpapi_key_here
PORT=3000
```
Get a free SerpAPI key at [serpapi.com](https://serpapi.com) (100 searches/month free).

### 3. Run
```bash
node server.js
```
Open [http://localhost:3000](http://localhost:3000)

## How Web Search Works

1. Click the **Web Search** toggle button to enable it (turns green)
2. Ask a question that needs current info (e.g. *"What changed in React 19?"*)
3. Claude autonomously requests a web search using `SEARCH_QUERY: <query>`
4. The backend proxy fetches results from Google via SerpAPI
5. Claude receives results and streams a complete, up-to-date documentation response

## Tech Stack

| Layer | Tech |
|---|---|
| AI | Claude Opus 4.6 via Puter.js |
| Frontend | Vanilla HTML/CSS/JS + marked.js + highlight.js |
| Backend | Node.js + Express |
| Search | SerpAPI (Google) |
| Fonts | Inter + JetBrains Mono |

## File Structure
```
├── index.html      # Frontend UI
├── app.js          # Client-side logic (Puter.js, streaming, search)
├── server.js       # Express backend (SerpAPI proxy)
├── .env            # Your keys (DO NOT commit)
├── .env.example    # Template for others
└── package.json
```
