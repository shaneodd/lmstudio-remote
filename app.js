/* ==== app.js ========================================================= */
/*  A tiny, dependency‑free client for LMStudio's OpenAI compatible API   */

(() => {
    // ---------- IndexedDB wrapper (using idb) -------------------------
    const DB_NAME = "lmstudio-chat";
    const STORE_NAME = "messages";

    // Very small wrapper – you can replace with plain indexedDB if desired
    async function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function addMessage(msg) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).add(msg);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getAllMessages() {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function clearMessages() {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

// ---------- UI helpers ------------------------------------------------
let wakeLock = null;

/**
 * Request a screen wake lock to prevent the display from sleeping.
 */
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            // Release any existing lock first
            if (wakeLock) {
                try { await wakeLock.release(); } catch (_) {}
                wakeLock = null;
            }
            wakeLock = await navigator.wakeLock.request('screen');
            // Re‑acquire on visibility change per spec
            document.addEventListener('visibilitychange', async () => {
                if (document.visibilityState === 'visible' && !wakeLock) {
                    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
                }
            });
        } catch (err) {
            console.warn('Wake Lock not supported or failed:', err);
        }
    } else {
        console.warn('Screen Wake Lock API not available in this browser.');
    }
}

async function releaseWakeLock() {
    if (wakeLock) {
        try { await wakeLock.release(); } catch (_) {}
        wakeLock = null;
    }
}
const chatContainer   = document.getElementById('chatContainer');
const promptInput     = document.getElementById('promptInput');
const sendBtn         = document.getElementById('sendBtn');

// New elements for context upload
const attachBtn       = document.getElementById('attachBtn');
const contextPanel    = document.getElementById('contextPanel');

// Model selector element (populated from server)
const modelSelect     = document.getElementById('modelSelect');

// ---------- Context handling helpers -----------------------------------
function clearPendingContext() {
    pendingContext = [];
    if (contextPanel) contextPanel.innerHTML = '';
}

// Load models from LMStudio server and populate the selector
async function loadModels() {
    const cfg = loadConfig();
    if (!cfg.apiUrl) return; // cannot fetch without base URL
    try {
        const resp = await fetch(`${cfg.apiUrl.replace(/\/+$/,"")}/v1/models`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        // Expecting {data: [{id:'model-name', ...}]}
        const models = (data && data.data) || [];
        // clear previous options
        modelSelect.innerHTML = '';
        // add a placeholder option
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- select model --';
        modelSelect.appendChild(placeholder);
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id || m.name || '';
            opt.textContent = opt.value;
            modelSelect.appendChild(opt);
        });
        // set selected value from stored config if present
        if (cfg.model) {
            modelSelect.value = cfg.model;
        }
    } catch (e) {
        console.warn('Failed to load models:', e);
        // keep selector empty; optionally inform user
    }
}

// Update config when user picks a model
modelSelect.addEventListener('change', () => {
    const cfg = loadConfig();
    const val = modelSelect.value || undefined;
    cfg.model = val;
    saveConfig(cfg);
});

const settingsBtn     = document.getElementById('settingsBtn');
const settingsModal   = document.getElementById('settingsModal');
const apiUrlInput     = document.getElementById('apiUrlInput');
// const modelNameInput  = document.getElementById('modelNameInput'); // removed – use selector
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const closeSettingsBtn= document.getElementById('closeSettingsBtn');
// New UI elements for mobile navigation
const menuBtn         = document.getElementById('menuBtn');
const navActions      = document.getElementById('navActions');
// Toggle navigation visibility on hamburger click
if (menuBtn) {
    menuBtn.addEventListener('click', () => {
        const hdr = document.querySelector('header');
        if (hdr) hdr.classList.toggle('open');
    });
}

// ---------- Context handling (text + images) ----------------------------
let pendingContext = []; // [{type:'text'|'image', content:string, name:string}]

attachBtn.addEventListener('change', async e => {
    const files = Array.from(e.target.files);
    for (const f of files) {
        if (f.type.startsWith('image/')) {
            // read image as data URL
            const dataUrl = await new Promise(r => {
                const rdr = new FileReader();
                rdr.onload = () => r(rdr.result);
                rdr.readAsDataURL(f);
            });
            pendingContext.push({type:'image', content:dataUrl, name:f.name});
            // thumbnail preview
            const img = document.createElement('img');
            img.src = dataUrl;
            img.title = f.name;
            img.style.maxHeight='40px';
            img.style.marginRight='0.3rem';
            contextPanel.appendChild(img);
        } else {
            const txt = await f.text();
            pendingContext.push({type:'text', content:txt, name:f.name});
            const span = document.createElement('span');
            span.textContent = f.name;
            span.style.marginRight='0.5rem';
            contextPanel.appendChild(span);
        }
    }
    // reset file input so same file can be chosen again later
    attachBtn.value = '';
});


    // ---------- Config persistence (localStorage) ------------------------
    const CONFIG_KEY = "lmstudio-config";
    function loadConfig() {
        try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}; }
        catch (_) { return {}; }
    }
    function saveConfig(cfg) {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    }

    // ---------- Rendering -------------------------------------------------
    function renderMessage(msgObj) {
        const div = document.createElement('div');
        div.className = `message ${msgObj.role}`;
        // main text (prompt or assistant reply)
        const p = document.createElement('p');
        p.textContent = msgObj.content;
        div.appendChild(p);

        // render any attached context files (only for user messages)
        if (msgObj.attachments && msgObj.attachments.length) {
            const attachDiv = document.createElement('div');
            attachDiv.className = 'attachments';
            msgObj.attachments.forEach(a => {
                if (a.type === 'image') {
                    const img = document.createElement('img');
                    img.src = a.content; // data URL
                    img.style.maxWidth = '200px';
                    img.style.marginTop = '0.4rem';
                    attachDiv.appendChild(img);
                } else if (a.type === 'text') {
                    const pre = document.createElement('pre');
                    pre.textContent = a.content;
                    pre.style.background = '#eaeaea';
                    pre.style.padding = '.4rem';
                    pre.style.marginTop = '0.4rem';
                    attachDiv.appendChild(pre);
                }
            });
            div.appendChild(attachDiv);
        }

        chatContainer.appendChild(div);
        // auto‑scroll
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    async function loadHistoryAndRender() {
        const msgs = await getAllMessages();
        chatContainer.innerHTML = "";   // clear UI first
        msgs.forEach(renderMessage);
    }

    // ---------- API call -------------------------------------------------
    /**
     * Sends a single user message to LMStudio and streams back the assistant reply.
     *
     * @param {string} content  User prompt text
     */
    async function sendPrompt(content) {
    // Acquire wake lock to keep screen awake during processing
    requestWakeLock();
        const cfg = loadConfig();
        if (!cfg.apiUrl) {
            alert("❗ Please configure the LMStudio URL first (gear icon).");
            return;
        }

        // ---------- Build multimodal content array ----------
        // Base prompt text always present
        const userContentArray = [{type:'text', text: content}];
        // Append any pending context items
        pendingContext.forEach(item => {
            if (item.type === 'image') {
                userContentArray.push({
                    type: 'image_url',
                    image_url: {url: item.content}
                });
            } else if (item.type === 'text') {
                // prepend a header so the model knows it’s extra context
                const prefix = `--- Context file: ${item.name} ---\n`;
                userContentArray.push({type:'text', text: prefix + item.content});
            }
        });

        // Store user message locally (including raw attachments for later display)
        const userMsg = {role: "user", content, attachments: pendingContext.slice()};
        await addMessage(userMsg);
        renderMessage(userMsg);

        // Build request payload – compatible with OpenAI API v1
        const body = {
            model: cfg.model || undefined,   // optional; LMStudio will pick default if omitted
            messages: [{ role:"user", content: userContentArray }],
            stream: true                     // we want streaming tokens
        };

        // ---- fetch with ReadableStream (browser) ------------------------
        try {
            const response = await fetch(`${cfg.apiUrl.replace(/\/+$/,"")}/v1/chat/completions`, {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            // Stream the SSE‑style chunks that LMStudio emits
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let assistantText = "";
            let buffer = "";   // accumulate partial lines

            while (true) {
                const {value, done} = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, {stream:true});

                // LMStudio sends `data: {...}` per line; split on newlines
                let lines = buffer.split("\n");
                // keep the last incomplete line in buffer for next iteration
                buffer = lines.pop();

                for (let line of lines) {
                    line = line.trim();
                    if (!line || !line.startsWith("data:")) continue;
                    const payload = line.slice(5).trim();
                    if (payload === "[DONE]" || payload === "") {
                        // ignore termination or empty lines
                        continue;
                    }
                    // Ensure payload looks like JSON object before parsing
                    if (!payload.startsWith('{')) {
                        console.warn('Skipping non-JSON SSE line:', payload);
                        continue;
                    }
                    let json;
                    try {
                        json = JSON.parse(payload);
                    } catch (e) {
                        console.warn('Failed to parse SSE line as JSON:', payload, e);
                        continue;
                    }
                    // If the response contains an error field, surface it
                    if (json.error) {
                        console.error('API returned error:', json.error);
                        alert(`❗ API error – ${json.error.message || 'Unknown error'}`);
                        continue;
                    }
                    // OpenAI style payload:
                    // { choices: [{ delta: { content: "…" }, finish_reason: null }] }
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) {
                        assistantText += delta;
                        // Render incremental text (live typing effect)
                        renderStreamingAssistant(assistantText);
                    }
                }
            }

            // Final rendering & persistence
            const assistantMsg = {role:"assistant", content:assistantText};
            await addMessage(assistantMsg);
            // Re‑render final message to ensure proper styling (replace live line)
            finalizeAssistantRendering(assistantText);
        // clear uploaded context UI & state
        clearPendingContext();
        // Release wake lock now that processing done
        releaseWakeLock();
    } catch (err) {
            console.error(err);
            alert(`❗ API error – ${err.message}`);
        }
    }

    // ----------------------------------------------------------------------
    // Helpers for the streaming UI (they keep a placeholder element)
    let assistantPlaceholder = null;
    function renderStreamingAssistant(text) {
        if (!assistantPlaceholder) {
            const div = document.createElement('div');
            div.className = 'message assistant';
            chatContainer.appendChild(div);
            assistantPlaceholder = div;
        }
        assistantPlaceholder.textContent = text;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function finalizeAssistantRendering(finalText) {
        // placeholder already holds the final text, just clear the ref
        assistantPlaceholder = null;
    }

    // ----------------------------------------------------------------------
    // Event wiring ---------------------------------------------------------
    sendBtn.addEventListener('click', () => {
        const prompt = promptInput.value.trim();
        if (prompt) {
            promptInput.value = "";
            sendPrompt(prompt);
        }
    });

    // Enter key in textarea → send
    promptInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();  // keep newline from being inserted
            sendBtn.click();
        }
    });

    // Settings modal -------------------------------------------------------
    settingsBtn.onclick = () => {
        const cfg = loadConfig();
        apiUrlInput.value   = cfg.apiUrl || "";
        // set model selector if already loaded
        if (modelSelect) modelSelect.value = cfg.model || "";
        settingsModal.classList.remove('hidden');
    };
    closeSettingsBtn.onclick = () => settingsModal.classList.add('hidden');

    saveSettingsBtn.onclick = async () => {
        const newCfg = {
            apiUrl: apiUrlInput.value.trim(),
            // model is already stored when user picks from the selector
            model : loadConfig().model || undefined
        };
        if (!newCfg.apiUrl) { alert("API URL cannot be empty."); return; }
        saveConfig(newCfg);
        settingsModal.classList.add('hidden');
        // After saving, load models for the new endpoint
        await loadModels();
    };

    // ---------- Nice‑to‑have helpers ---------------------------------------
    // 1️⃣ Export / Import chat history as JSON file
    function downloadJSON(obj, filename) {
        const blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'});
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Add two extra buttons to the header (export / clear)
    const exportBtn = document.createElement('button');
    exportBtn.textContent = "💾 Export";
    exportBtn.onclick = async () => {
        const msgs = await getAllMessages();
        downloadJSON(msgs, `lmstudio-chat-${Date.now()}.json`);
    };
    const clearBtn = document.createElement('button');
    clearBtn.textContent = "🗑️ Clear";
    clearBtn.onclick = async () => {
        if (confirm("Delete ALL stored messages?")) {
            await clearMessages();
            chatContainer.innerHTML = "";
        }
    };
    const themeToggle = document.createElement('button');
    themeToggle.textContent = "🌙 Dark";
    themeToggle.onclick = () => {
        const root = document.body;
        if (root.classList.toggle('theme-dark')) {
            root.classList.remove('theme-light');
            themeToggle.textContent = "☀️ Light";
        } else {
            root.classList.add('theme-light');
            themeToggle.textContent = "🌙 Dark";
        }
        // Persist the selected theme in localStorage
        const currentTheme = root.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light';
        localStorage.setItem('theme', currentTheme);
    };
    // Insert after the settings icon
    if (navActions) {
    navActions.appendChild(exportBtn);
    navActions.appendChild(clearBtn);
    navActions.appendChild(themeToggle);
}

    // ---------- Init -------------------------------------------------------
    (async () => {
        // Load stored messages and render them on start‑up
        await loadHistoryAndRender();

        // Load models if API URL is configured
        const cfg = loadConfig();
        if (cfg.apiUrl) {
            await loadModels();
        }

        // Auto‑apply saved theme (optional)
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme) {
            document.body.className = savedTheme;
            // Update theme toggle button text to reflect current mode
            if (savedTheme === 'theme-dark') {
                themeToggle.textContent = "☀️ Light"; // currently dark, so offer light switch
            } else {
                themeToggle.textContent = "🌙 Dark"; // currently light, offer dark switch
            }
        } else {
            // No saved theme: default to light mode and set button accordingly
            document.body.classList.add('theme-light');
            themeToggle.textContent = "🌙 Dark";
        }
    })();
    // Release wake lock when page unloads
    window.addEventListener('beforeunload', () => { releaseWakeLock(); });
})();
