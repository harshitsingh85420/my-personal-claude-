// ══════════════════════════════════════════════════════════════════
//  Opus 4.6 Documentation Assistant — app.js
// ══════════════════════════════════════════════════════════════════

// ── marked.js + highlight.js setup ───────────────────────────────
marked.setOptions({ breaks: true, gfm: true });

const renderer = new marked.Renderer();
renderer.code = (code, lang) => {
    const language = (lang && hljs.getLanguage(lang)) ? lang : 'plaintext';
    const highlighted = hljs.highlight(String(code), { language }).value;
    const label = language === 'plaintext' ? 'code' : language;
    return `<pre>
      <div class="code-header">
        <span class="code-lang">${label}</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <code class="hljs language-${language}">${highlighted}</code>
    </pre>`;
};
marked.use({ renderer });

function copyCode(btn) {
    const code = btn.closest('pre').querySelector('code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        btn.textContent = '✓ Copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
    });
}

// ── DOM refs ──────────────────────────────────────────────────────
const messagesEl    = document.getElementById('messages');
const typingRow     = document.getElementById('typing-row');
const userInput     = document.getElementById('user-input');
const sendBtn       = document.getElementById('send-btn');
const attachBtn     = document.getElementById('attach-btn');
const fileInput     = document.getElementById('file-input');
const attachPreview = document.getElementById('attachment-preview');
const emptyState    = document.getElementById('empty-state');
const webSearchBtn  = document.getElementById('websearch-btn');

// ── State ─────────────────────────────────────────────────────────
let attachedFileContent = null;
let attachedFileName    = null;
let isSending           = false;
let webSearchEnabled    = false;   // ← controlled by the toggle button

// ── System prompts ────────────────────────────────────────────────
const BASE_SYSTEM = `You are Claude Opus 4.6 configured as an autonomous documentation specialist.
Your goal is to provide deep, accurate, and up-to-date documentation on technical subjects, frameworks, and tools.

## RULES
1. Provide accurate, clear, and comprehensive documentation formatted beautifully in Markdown.
2. Use precise language, code snippets, and structured explanations.
3. Use headers (##, ###), bullet lists, tables, and code blocks liberally to make responses scannable.
4. Answer directly from your training knowledge unless told otherwise.`;

const SEARCH_ADDON = `

## WEB SEARCH CAPABILITY (ACTIVE)
You have live web search available for this request. When you need current information, output EXACTLY:
SEARCH_QUERY: <your search query>

Then STOP. The system will run the search and feed results back so you can continue with accurate, up-to-date documentation.`;

// Returns the system prompt based on current web-search state
function getSystemPrompt() {
    return webSearchEnabled ? BASE_SYSTEM + SEARCH_ADDON : BASE_SYSTEM;
}

let messages = [{ role: 'system', content: getSystemPrompt() }];

// ── Web Search Toggle ─────────────────────────────────────────────
function toggleWebSearch() {
    webSearchEnabled = !webSearchEnabled;
    webSearchBtn.classList.toggle('active', webSearchEnabled);
    // Update the system message so the AI knows its current capability
    if (messages[0]?.role === 'system') {
        messages[0].content = getSystemPrompt();
    }
    // Visual placeholder update
    userInput.placeholder = webSearchEnabled
        ? 'Ask me to document anything… (web search ON 🌐)'
        : 'Ask me to document anything…';
}

// ── Persistence (localStorage) ────────────────────────────────────
function loadMessages() {
    try {
        const saved = localStorage.getItem('chat_history');
        if (saved) {
            const parsed = JSON.parse(saved);
            messages = (parsed[0]?.role === 'system')
                ? parsed
                : [{ role: 'system', content: getSystemPrompt() }, ...parsed];
            // Always refresh system prompt to current state
            messages[0].content = getSystemPrompt();
        }
    } catch (e) { /* ignore corrupt storage */ }
    renderAll();
}

function saveMessages() {
    try { localStorage.setItem('chat_history', JSON.stringify(messages)); }
    catch (e) { /* storage full – silently ignore */ }
}

// ── Render helpers ────────────────────────────────────────────────
function renderAll() {
    const visible = messages.filter(m => m.role !== 'system');
    // Remove old chat rows (not the empty-state or typing-row)
    messagesEl.querySelectorAll('.msg-row').forEach(el => el.remove());
    if (visible.length === 0) {
        emptyState.style.display = 'flex';
    } else {
        emptyState.style.display = 'none';
        visible.forEach(msg => {
            messagesEl.appendChild(buildRow(msg));
        });
    }
    scrollBottom();
}

function buildRow(msg) {
    const row = document.createElement('div');
    row.className = `msg-row ${msg.role}`;

    const avatar = document.createElement('div');
    avatar.className = `avatar ${msg.role === 'user' ? 'you' : 'ai'}`;
    avatar.textContent = msg.role === 'user' ? '👤' : '✦';

    const bubble = document.createElement('div');
    bubble.className = `bubble ${msg.role === 'user' ? 'user' : 'assistant'}`;

    if (msg.role === 'user') {
        // Escape HTML in user messages then break newlines
        bubble.textContent = msg.content;
    } else {
        bubble.innerHTML = marked.parse(msg.content || '&nbsp;');
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    return row;
}

function appendRow(msg) {
    emptyState.style.display = 'none';
    const row = buildRow(msg);
    // Insert before the typingRow which is OUTSIDE messagesEl
    messagesEl.appendChild(row);
    scrollBottom();
    return row;
}

/** Live-update the last .bubble.assistant with streaming text */
function streamIntoLastBubble(text) {
    const all = messagesEl.querySelectorAll('.bubble.assistant');
    const last = all[all.length - 1];
    if (last) { last.innerHTML = marked.parse(text || '&nbsp;'); scrollBottom(); }
}

function scrollBottom() {
    messagesEl.scrollBottom = 0; // reset cache
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Typing indicator ──────────────────────────────────────────────
function setTyping(show) {
    typingRow.style.display = show ? 'flex' : 'none';
    sendBtn.disabled = show;
    if (show) scrollBottom();
}

// ── Search status bubble ──────────────────────────────────────────
let searchStatusEl = null;

function showSearchStatus(query) {
    searchStatusEl = document.createElement('div');
    searchStatusEl.className = 'msg-row';
    searchStatusEl.innerHTML = `
        <div class="bubble search-status">
            <div class="search-spinner"></div>
            🔍 Searching the web for: <strong>${escapeHtml(query)}</strong>
        </div>`;
    messagesEl.appendChild(searchStatusEl);
    scrollBottom();
}

function hideSearchStatus() {
    if (searchStatusEl) { searchStatusEl.remove(); searchStatusEl = null; }
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Chip suggestions ──────────────────────────────────────────────
function fillChip(el) {
    userInput.value = el.textContent.replace(/^📋\s*/, '');
    userInput.focus();
    autoResize();
}

// ── Attachment ────────────────────────────────────────────────────
function clearAttachment() {
    attachedFileContent = null;
    attachedFileName    = null;
    attachPreview.style.display = 'none';
    attachPreview.innerHTML = '';
    fileInput.value = '';
}

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    // Guard: don't allow files > 500 KB (rough token limit)
    if (file.size > 512 * 1024) {
        alert('File is too large (max 500 KB). Please paste the text instead.');
        fileInput.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = evt => {
        attachedFileContent = evt.target.result;
        attachedFileName    = file.name;
        attachPreview.style.display = 'flex';
        attachPreview.innerHTML = `📄 <strong>${escapeHtml(file.name)}</strong>
            <span class="attachment-remove" onclick="clearAttachment()" title="Remove">✕</span>`;
    };
    reader.onerror = () => alert('Error reading file.');
    reader.readAsText(file);
});

// ── Textarea auto-resize ──────────────────────────────────────────
function autoResize() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
}
userInput.addEventListener('input', autoResize);

// ── Send (supports recursive search-resume) ───────────────────────
async function sendMessage(isSearchResume = false) {
    // Guard: don't stack sends unless resuming after search
    if (isSending && !isSearchResume) return;

    const inputText = userInput.value.trim();

    // Nothing to send (and not resuming from search)
    if (!isSearchResume && !inputText && !attachedFileContent) return;

    // ── Build user message ────────────────────────────────────────
    if (!isSearchResume) {
        let userContent = inputText;

        if (attachedFileContent) {
            userContent += (userContent ? '\n\n' : '') +
                `**Attached file: ${attachedFileName}**\n\`\`\`\n${attachedFileContent}\n\`\`\``;
            clearAttachment();
        }

        messages.push({ role: 'user', content: userContent });
        saveMessages();
        appendRow({ role: 'user', content: userContent });
        userInput.value = '';
        autoResize();
    }

    isSending = true;
    setTyping(true);

    // Push a placeholder assistant message (will be updated via streaming)
    const placeholder = { role: 'assistant', content: '' };
    messages.push(placeholder);
    appendRow({ role: 'assistant', content: '' });

    try {
        // Build API payload: send all messages except the empty placeholder
        const apiMessages = messages
            .slice(0, messages.length - 1)
            .map(m => ({ role: m.role, content: m.content }));

        const response = await puter.ai.chat(apiMessages, {
            model: 'claude-opus-4-6',
            stream: true
        });

        let fullText = '';
        setTyping(false); // dots go away once tokens arrive

        for await (const part of response) {
            if (part?.text) {
                fullText += part.text;
                placeholder.content = fullText;
                streamIntoLastBubble(fullText);
            }
        }

        placeholder.content = fullText;
        saveMessages();

        // ── Web search protocol ───────────────────────────────────
        // Only attempt search if web search is enabled AND AI requested it
        if (webSearchEnabled) {
            const match = fullText.match(/SEARCH_QUERY:\s*(.+)/i);
            if (match) {
                const query = match[1].trim();
                showSearchStatus(query);

                const searchResults = await performSearch(query);
                hideSearchStatus();

                // Feed results back as a user message so Claude can continue
                messages.push({
                    role: 'user',
                    content: `[WEB SEARCH RESULTS for "${query}"]:\n${searchResults}\n\nNow continue writing the documentation using these results.`
                });
                saveMessages();

                // Reset so the recursive call can proceed
                isSending = false;
                await sendMessage(true);   // resume
                return;
            }
        }

    } catch (err) {
        console.error('[Opus 4.6] Error:', err);
        placeholder.content = `⚠️ **Error:** ${err.message || 'Failed to get a response. Please try again.'}`;
        streamIntoLastBubble(placeholder.content);
        saveMessages();
    } finally {
        isSending = false;
        setTyping(false);
    }
}

// ── SerpAPI proxy ─────────────────────────────────────────────────
async function performSearch(query) {
    try {
        const res = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.results || data.error || 'No results returned.';
    } catch (e) {
        return `Search failed: ${e.message}`;
    }
}

// ── Event listeners ───────────────────────────────────────────────
sendBtn.addEventListener('click', () => sendMessage());
userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ── Init ──────────────────────────────────────────────────────────
loadMessages();
