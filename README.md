# 🤖 Radgotchi

> A cross-platform desktop virtual pet that lives on your screen, reacts to your system, chats with you via local AI, and keeps you company while you level up.

**Supports:** Windows • macOS • Linux

<p align="center">
  <img src="assets/AWAKE.png" alt="Radgotchi" width="120">
  <img src="assets/HAPPY.png" alt="Happy" width="120">
  <img src="assets/EXCITED.png" alt="Excited" width="120">
  <img src="assets/COOL.png" alt="Cool" width="120">
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#chat--ai">Chat & AI</a> •
  <a href="#xp--leveling">XP & Leveling</a> •
  <a href="#customization">Customization</a> •
  <a href="#building">Building</a>
</p>

---

## ✨ Features

### 🎭 Expressive Moods
- **25+ unique mood states** with hand-crafted pixel art sprites
- Smooth transitions between moods
- Contextual status messages in English or Chinese

### 🖥️ System Awareness
- **CPU monitoring** — Gets intense during heavy loads, detects spikes
- **Memory tracking** — Warns you about high usage
- **Network detection** — Celebrates connectivity, notices disconnects
- **Window tracking** — Reacts to apps opening/closing
- **Idle detection** — Falls asleep when you're AFK (2 min), wakes up when you return

### 🎮 Movement Modes
- **None** — Stays where you put it
- **Bounce** — DVD-logo style screensaver, bounces off screen edges
- **Follow** — Pet follows your cursor around the screen
- **Wander** — Random exploration with pauses

### 💬 AI Chat Integration
- **Local LLM support** — Connect to Ollama, LM Studio, LocalAI, or any OpenAI-compatible endpoint
- **SIGINT Terminal interface** — Themed chat window
- **Mood reactions** — Pet reacts while thinking and responding
- **Markdown support** — Code blocks with copy button, formatting

### 📈 XP & Leveling System
- **Passive XP** — Earn XP just by keeping Radgotchi open
- **Interaction XP** — Extra XP for clicks and chat messages
- **21 levels** — Progress from 0 to 17,500+ XP
- **Persistent progress** — XP saves across sessions
- **Level-up celebrations** — Visual feedback when you level up

### 🌐 Internationalization
- **English** (default)
- **中文** (Chinese)
- Toggle via chat panel or system tray

### 💫 Polished Details
- **Breathing animation** — Subtle idle pulse
- **Eye tracking** — Follows your cursor
- **Always-on-top** — Floats above other windows
- **System tray** — Full control panel
- **Transparent background** — Clean floating appearance
- **Expression-only mode** — Hide status text, show just the face

---

## 📦 Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- Windows 10/11, macOS 10.15+, or Linux (Ubuntu/Debian recommended)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/itsTylerIRL/radgotchi.git
cd radgotchi

# Install dependencies
npm install

# Run the app
npm start
```

### GPU Issues?

If you're running in a VM, remote session, or have GPU issues, use:

```bash
npm run start:safe
```

---

## 🎮 Usage

### Controls

| Action | Effect |
|--------|--------|
| **Drag** | Move Radgotchi around your screen |
| **Scroll wheel** | Resize (scale up/down) |
| **Click** | Pet interaction with emotes (+2 XP) |
| **Right-click tray** | Access menu and settings |

### Tray Menu Options

- 📌 **Always on Top** — Toggle window priority
- 🔄 **Reset Position** — Return to default location
- 🎬 **Movement** — None / Bounce / Follow / Wander
- 🎨 **Color** — Choose from 10 theme colors
- 🌐 **Language** — English / 中文
- ⚙️ **Chat Settings** — Configure LLM endpoint
- 🛠️ **Dev Tools** — Debug console
- 🔄 **Update from GitHub** — Pull latest changes
- ❌ **Quit** — Close Radgotchi

### System Reactions

| Condition | Radgotchi's Response |
|-----------|---------------------|
| CPU > 80% | 😰 Concerned, alert |
| CPU > 95% | 🔥 Intense spike detected |
| Memory > 85% | 😟 Memory pressure warning |
| Network lost | 😢 Connection lost |
| Network restored | 😊 Back online |
| App not responding | 😵 Detects hung processes |
| User idle 2min | 😴 Falls asleep |
| User returns | 😆 Excited wakeup |

---

## 💬 Chat & AI

Radgotchi includes a built-in chat terminal that connects to local LLM services.

### Supported Backends

- **[Ollama](https://ollama.ai/)** — `http://localhost:11434/v1/chat/completions`
- **[LM Studio](https://lmstudio.ai/)** — `http://localhost:1234/v1/chat/completions`
- **[LocalAI](https://localai.io/)** — Configure your endpoint
- **Any OpenAI-compatible API** — Works with custom endpoints

### Setup

1. Right-click tray → **Chat Settings**
2. Enable chat and enter your API endpoint
3. Set the model name (e.g., `llama2`, `mistral`, `codellama`)
4. Optionally customize the system prompt
5. Click **Save**

### Opening Chat

Click on Radgotchi to open the **SIGINT Terminal** chat interface.

### Chat Features

- **Retro terminal aesthetic** — CRT scanlines, grid background
- **Mood reactions** — Pet shows thinking/success/error states
- **Markdown rendering** — Code blocks, bold, lists, links
- **Copy code blocks** — One-click copy button
- **Control panel** — Movement, color, and language controls built-in
- **XP display** — Level and progress bar in chat header

---

## 📈 XP & Leveling

Keep Radgotchi running and interact with it to earn XP and level up!

### XP Sources

| Action | XP Earned |
|--------|-----------|
| **Passive** | +1 XP every 30 seconds |
| **Click pet** | +2 XP (3-second cooldown) |
| **Send message** | +5 XP |
| **Receive response** | +3 XP |

### Level Progression

| Level | Total XP Required |
|-------|-------------------|
| 1 | 0 |
| 2 | 50 |
| 3 | 150 |
| 5 | 500 |
| 10 | 2,600 |
| 15 | 7,200 |
| 20 | 17,500 |
| 21+ | +3,000 per level |

### XP Display

The chat panel shows:
- **Level badge** — Your current level
- **Progress bar** — XP towards next level
- **Total XP** — Cumulative XP earned

XP automatically saves to disk and persists across sessions.

---

## 🎨 Customization

### Color Themes

Right-click the tray icon → **Color** or use the chat panel dropdown:
- 🔴 Red (default)
- 🩵 Cyan
- 💚 Green
- 💜 Purple
- 💗 Pink
- 🧡 Orange
- 💛 Yellow
- 💙 Blue
- 💚 Lime
- 🤍 White

### Language

Switch between English and 中文 (Chinese):
- Tray menu → **Language**
- Chat panel → **Language toggle button**

All UI text, status messages, and emotes are localized.

### Expression-Only Mode

Toggle via the chat panel to hide status text and show only Radgotchi's expressions. Perfect for a cleaner desktop look.

### CSS Variables

For deeper customization, edit `styles.css`:

```css
:root {
    --rg-color: #ff3344;       /* Main accent */
    --rg-glow: #ff334488;      /* Glow effect */
    --rg-status-color: #cc2233; /* Status text */
}
```

### Custom System Prompt

Configure the AI personality in Chat Settings:
- Change the system prompt to customize how Radgotchi talks
- Make it more helpful, silly, professional, or anything you want

---

## 🔨 Building

### Create Distributable

```bash
# Build for current platform
npm run build

# Platform-specific builds
npm run build:win      # Windows (NSIS installer + portable)
npm run build:mac      # macOS (DMG + ZIP)
npm run build:linux    # Linux (AppImage + DEB)

# Windows portable only
npm run build:portable
```

Output goes to the `dist/` folder:

**Windows:**
- `Radgotchi Setup x.x.x.exe` — Installer
- `Radgotchi x.x.x.exe` — Portable version

**macOS:**
- `Radgotchi-x.x.x.dmg` — Disk image
- `Radgotchi-x.x.x-mac.zip` — Zipped app

**Linux:**
- `Radgotchi-x.x.x.AppImage` — Universal Linux app
- `radgotchi_x.x.x_amd64.deb` — Debian/Ubuntu package

---

## 📁 Project Structure

```
radgotchi/
├── main.js           # Electron main process, XP system, IPC
├── preload.js        # Secure IPC bridge (main window)
├── preload-chat.js   # Secure IPC bridge (chat window)
├── renderer.js       # UI logic & interactions
├── radgotchi.js      # Pet behavior module
├── index.html        # Main app shell
├── chat.html         # Chat terminal interface
├── styles.css        # Animations & themes
├── package.json      # Config & dependencies
└── assets/           # Sprite images (25+)
```

### Data Files (stored in userData)

- `llm-config.json` — LLM endpoint configuration
- `xp-data.json` — XP and level progress

---

## 🛠️ Development

### API Reference

The global `RG` module provides programmatic control:

```javascript
// Set mood (with options)
RG.setMood('happy', { 
  duration: 3000,    // Auto-reset after 3s
  anim: 'bounce',    // Animation class
  status: 'Custom!'  // Status text
});

// React to severity levels
RG.react('critical', 'Alert!');
RG.react('warning', 'Heads up');
RG.react('ok', 'All good');

// Feed system metrics
RG.assessHealth({
  cpu: { usage_total: 45 },
  memory: { percent: 60 }
});

// Read state
console.log(RG.mood);      // Current mood
console.log(RG.petCount);  // Interaction count
```

### IPC Events

The main process emits these events to renderers:

| Event | Data | Description |
|-------|------|-------------|
| `xp-update` | `{level, totalXp, progress, leveledUp}` | XP changed |
| `movement-mode-change` | `mode` | Movement mode switched |
| `system-event` | `{type, value}` | System state changed |
| `idle-change` | `{idle: boolean}` | User AFK status |
| `set-color` | `color` | Theme color changed |
| `set-language` | `lang` | Language switched |

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <b>Made with 💻 by the Radbro community</b>
</p>
