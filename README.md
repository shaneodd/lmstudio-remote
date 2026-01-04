# LMStudio Chat Web Client

A tiny, dependency‑free web client that lets you talk to an **LMStudio** instance from any device – perfect for a phone or tablet.  All chat history is stored locally in the browser (IndexedDB) and can be exported as JSON for later review on a larger computer. Android will require termux to run.

---

## Features

- **Zero‑install (for desktop):** Just open `index.html` in a modern browser.
- **Works on mobile:** UI fits small screens, runs as a progressive web app (standalone mode).
- **Local persistence:** Messages are saved in IndexedDB and survive page reloads.
- **Export / Import:** Export your chat history to a JSON file; import it later.
- **Dark / Light theme** toggle.
- **Configurable endpoint:** Set the LMStudio URL (and optional model) via the settings modal.
- **Streaming responses:** Shows assistant replies as they are streamed from the server.

---

## Getting Started

### Desktop
1. Clone or download this repository.
1. Open `index.html` in a browser.

### Mobile
1. Clone or download this repository.
1. Open termux
1. Run the `run_server.sh` 
1. Open your browser and go to `127.0.0.1:8080`


### Setup
1. Click the **⚙️ Settings** button and enter your LMStudio URL (e.g., `http://192.168.1.27:1234`). Optionally set a default model name.
1. Start chatting! Your messages appear on the right, assistant replies on the left.

> The client stores all messages locally; you can clear them with the **🗑️ Clear** button in the header.

---

## 🔧 Advanced Use Cases

- **Remote debugging:** Test prompts while away from your development machine.
- **Team sharing:** Export a conversation, send the JSON file to a teammate, and import it on another device.
- **Prompt engineering practice:** Experiment with different prompt styles on‑the‑go.
- **Educational demos:** Show students how a language model works without needing a full desktop setup.

---

## Project Structure

```
├─ index.html      # Minimal HTML layout and UI elements
├─ style.css       # Simple styling, includes pre‑formatted message display
├─ app.js          # Core logic – IndexedDB wrapper, API calls, UI helpers
└─ manifest.json   # PWA manifest for "Add to Home Screen" support
```

---

## License

Feel free to use, modify, and share this code however you like. No warranty is provided.
