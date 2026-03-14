// ══════════════════════════════════════════════════════════════════
//  Opus 4.6 Documentation Assistant — Multi-chat app.js
// ══════════════════════════════════════════════════════════════════

// ── marked.js + highlight.js ──────────────────────────────────────
marked.setOptions({ breaks: true, gfm: true });

const renderer = new marked.Renderer();
renderer.code = function(token) {
    // marked v5+ passes a token object; older versions pass (code, lang) separately
    const rawCode = (typeof token === 'object' && token !== null) ? (token.text || token.raw || '') : String(token);
    const lang     = (typeof token === 'object' && token !== null) ? (token.lang || '') : (arguments[1] || '');
    const language = (lang && hljs.getLanguage(lang)) ? lang : 'plaintext';
    const highlighted = hljs.highlight(rawCode, { language }).value;
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

function escapeHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
const chatListEl    = document.getElementById('chat-list');
const topbarTitle   = document.getElementById('topbar-title');

// ── App State ─────────────────────────────────────────────────────
let attachedFileContent = null;
let attachedFileName    = null;
let isSending           = false;
let webSearchEnabled    = false;

// Multi-chat state
let activeChatId = null;   // UUID of the currently open chat
let chatIndex    = [];     // [{ id, title, createdAt }] — ordered list

// ── Prompts ───────────────────────────────────────────────────────
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
Then STOP. The system will run the search and feed results back so you can continue.`;

function getSystemPrompt() {
    return webSearchEnabled ? BASE_SYSTEM + SEARCH_ADDON : BASE_SYSTEM;
}

// ── Storage helpers ───────────────────────────────────────────────
const CHAT_INDEX_KEY = 'chatIndex_v1';

function saveChatIndex() {
    localStorage.setItem(CHAT_INDEX_KEY, JSON.stringify(chatIndex));
}

function loadChatIndex() {
    try {
        const raw = localStorage.getItem(CHAT_INDEX_KEY);
        if (raw) chatIndex = JSON.parse(raw);
    } catch { chatIndex = []; }
}

function chatKey(id) { return `chat_${id}`; }

function loadChatMessages(id) {
    try {
        const raw = localStorage.getItem(chatKey(id));
        return raw ? JSON.parse(raw) : [{ role:'system', content: getSystemPrompt() }];
    } catch { return [{ role:'system', content: getSystemPrompt() }]; }
}

function saveChatMessages(id, msgs) {
    try { localStorage.setItem(chatKey(id), JSON.stringify(msgs)); } catch {}
}

function deleteChatData(id) {
    localStorage.removeItem(chatKey(id));
}

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// ── Chat Index UI ─────────────────────────────────────────────────
function renderChatList() {
    chatListEl.innerHTML = '';

    if (chatIndex.length === 0) {
        chatListEl.innerHTML = '<div style="padding:10px 12px;font-size:0.75rem;color:var(--text-muted);font-style:italic;">No conversations yet</div>';
        return;
    }

    // Newest first
    [...chatIndex].reverse().forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-item' + (chat.id === activeChatId ? ' active' : '');
        item.dataset.id = chat.id;
        item.innerHTML = `
            <span class="chat-icon">💬</span>
            <span class="chat-title">${escapeHtml(chat.title)}</span>
            <button class="chat-delete" title="Delete" onclick="event.stopPropagation(); deleteChat('${chat.id}')">✕</button>`;
        item.addEventListener('click', () => switchChat(chat.id));
        chatListEl.appendChild(item);
    });
}

// ── Create a new chat ─────────────────────────────────────────────
function createNewChat() {
    const id = uuid();
    const entry = { id, title: 'New Conversation', createdAt: Date.now() };
    chatIndex.push(entry);
    saveChatIndex();

    // Initialize with system message
    saveChatMessages(id, [{ role:'system', content: getSystemPrompt() }]);

    switchChat(id);
}

// ── Switch to a chat ──────────────────────────────────────────────
function switchChat(id) {
    if (isSending) return; // Don't switch while generating

    activeChatId = id;

    // Update sidebar
    chatListEl.querySelectorAll('.chat-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
    });

    // Update topbar title
    const entry = chatIndex.find(c => c.id === id);
    topbarTitle.textContent = entry ? entry.title : 'Conversation';

    // Update system prompt in case web-search toggled
    const msgs = loadChatMessages(id);
    if (msgs[0]?.role === 'system') msgs[0].content = getSystemPrompt();

    renderMessages(msgs);
}

// ── Delete a chat ─────────────────────────────────────────────────
function deleteChat(id) {
    chatIndex = chatIndex.filter(c => c.id !== id);
    deleteChatData(id);
    saveChatIndex();

    if (activeChatId === id) {
        // Switch to the most recent remaining chat, or create new
        if (chatIndex.length > 0) {
            switchChat(chatIndex[chatIndex.length - 1].id);
        } else {
            activeChatId = null;
            topbarTitle.textContent = 'New Conversation';
            renderMessages([]);
        }
    }

    renderChatList();
}

// ── Auto-title chat from first user message ───────────────────────
function autoTitle(text) {
    const clean = text.replace(/\[Attached.*?\]/g, '').trim();
    return clean.length > 45 ? clean.slice(0, 45) + '…' : clean || 'New Conversation';
}

// ── Render messages into the chat pane ───────────────────────────
function renderMessages(msgs) {
    // Remove existing rows
    messagesEl.querySelectorAll('.msg-row').forEach(el => el.remove());

    const visible = (msgs || []).filter(m => m.role !== 'system');

    if (visible.length === 0) {
        emptyState.style.display = 'flex';
    } else {
        emptyState.style.display = 'none';
        visible.forEach(msg => messagesEl.appendChild(buildRow(msg)));
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
    messagesEl.appendChild(row);
    scrollBottom();
    return row;
}

function updateLastAssistantBubble(text) {
    const all = messagesEl.querySelectorAll('.bubble.assistant');
    const last = all[all.length - 1];
    if (last) { last.innerHTML = marked.parse(text || '&nbsp;'); scrollBottom(); }
}

function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

// ── Typing indicator ──────────────────────────────────────────────
function setTyping(show) {
    typingRow.style.display = show ? 'flex' : 'none';
    sendBtn.disabled = show;
    if (show) scrollBottom();
}

// ── Search status ─────────────────────────────────────────────────
let searchStatusEl = null;

function showSearchStatus(query) {
    searchStatusEl = document.createElement('div');
    searchStatusEl.className = 'msg-row';
    searchStatusEl.innerHTML = `<div class="bubble search-status"><div class="search-spinner"></div>🔍 Searching: <strong>${escapeHtml(query)}</strong></div>`;
    messagesEl.appendChild(searchStatusEl);
    scrollBottom();
}

function hideSearchStatus() {
    if (searchStatusEl) { searchStatusEl.remove(); searchStatusEl = null; }
}

// ── Chips ─────────────────────────────────────────────────────────
function fillChip(el) {
    userInput.value = el.textContent.replace(/^📋\s*/, '');
    userInput.focus();
    autoResize();
}

// ── Web Search Toggle ─────────────────────────────────────────────
function toggleWebSearch() {
    webSearchEnabled = !webSearchEnabled;
    webSearchBtn.classList.toggle('active', webSearchEnabled);
    userInput.placeholder = webSearchEnabled
        ? 'Ask me anything… (Web Search ON 🌐)'
        : 'Ask me to document anything…';

    // Update system msg in current chat
    if (activeChatId) {
        const msgs = loadChatMessages(activeChatId);
        if (msgs[0]?.role === 'system') {
            msgs[0].content = getSystemPrompt();
            saveChatMessages(activeChatId, msgs);
        }
    }
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
    if (file.size > 512 * 1024) { alert('File too large (max 500 KB).'); fileInput.value = ''; return; }
    const reader = new FileReader();
    reader.onload = evt => {
        attachedFileContent = evt.target.result;
        attachedFileName    = file.name;
        attachPreview.style.display = 'flex';
        attachPreview.innerHTML = `📄 <strong>${escapeHtml(file.name)}</strong><span class="attachment-remove" onclick="clearAttachment()" title="Remove">✕</span>`;
    };
    reader.onerror = () => alert('Error reading file.');
    reader.readAsText(file);
});

// ── Textarea auto-resize ──────────────────────────────────────────
function autoResize() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 130) + 'px';
}
userInput.addEventListener('input', autoResize);
userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ── Send message ──────────────────────────────────────────────────
async function sendMessage(isSearchResume = false) {
    if (isSending && !isSearchResume) return;

    // Ensure there's an active chat — auto-create if none
    if (!activeChatId) createNewChat();

    const inputText = userInput.value.trim();
    if (!isSearchResume && !inputText && !attachedFileContent) return;

    // Load current chat messages
    const msgs = loadChatMessages(activeChatId);

    // ── Build user message ──
    if (!isSearchResume) {
        let userContent = inputText;

        if (attachedFileContent) {
            userContent += (userContent ? '\n\n' : '') +
                `**Attached: ${attachedFileName}**\n\`\`\`\n${attachedFileContent}\n\`\`\``;
            clearAttachment();
        }

        msgs.push({ role: 'user', content: userContent });

        // Auto-title chat from first real user message
        const userMsgs = msgs.filter(m => m.role === 'user');
        if (userMsgs.length === 1) {
            const entry = chatIndex.find(c => c.id === activeChatId);
            if (entry) {
                entry.title = autoTitle(userContent);
                saveChatIndex();
                topbarTitle.textContent = entry.title;
                renderChatList();
            }
        }

        saveChatMessages(activeChatId, msgs);
        appendRow({ role:'user', content: userContent });
        userInput.value = '';
        autoResize();
    }

    isSending = true;
    setTyping(true);

    // Streaming placeholder
    const placeholder = { role: 'assistant', content: '' };
    msgs.push(placeholder);
    appendRow({ role: 'assistant', content: '' });

    try {
        const apiMessages = msgs.slice(0, -1).map(m => ({ role: m.role, content: m.content }));

        const response = await puter.ai.chat(apiMessages, {
            model: 'claude-opus-4-6',
            stream: true
        });

        let fullText = '';
        setTyping(false);

        for await (const part of response) {
            if (part?.text) {
                fullText += part.text;
                placeholder.content = fullText;
                updateLastAssistantBubble(fullText);
            }
        }

        placeholder.content = fullText;
        saveChatMessages(activeChatId, msgs);

        // ── Search protocol ──
        if (webSearchEnabled) {
            const match = fullText.match(/SEARCH_QUERY:\s*(.+)/i);
            if (match) {
                const query = match[1].trim();
                showSearchStatus(query);
                const results = await performSearch(query);
                hideSearchStatus();

                msgs.push({
                    role: 'user',
                    content: `[WEB SEARCH RESULTS for "${query}"]:\n${results}\n\nNow continue writing the documentation using these results.`
                });
                saveChatMessages(activeChatId, msgs);

                isSending = false;
                await sendMessage(true);
                return;
            }
        }

    } catch (err) {
        console.error(err);
        placeholder.content = `⚠️ **Error:** ${err.message || 'Failed to get a response.'}`;
        updateLastAssistantBubble(placeholder.content);
        saveChatMessages(activeChatId, msgs);
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

// ── Boot ──────────────────────────────────────────────────────────
function init() {
    loadChatIndex();
    renderChatList();

    if (chatIndex.length > 0) {
        // Open most recent chat
        switchChat(chatIndex[chatIndex.length - 1].id);
    } else {
        // First launch — create a starter chat
        createNewChat();
    }
}

init();
