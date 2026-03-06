# 🤖 Radgotchi

> A cross-platform desktop virtual pet that lives on your screen, reacts to your system, and keeps you company.

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
  <a href="#customization">Customization</a> •
  <a href="#building">Building</a>
</p>

---

## ✨ Features

### 🎭 Expressive Moods
- **25 unique mood states** with hand-crafted pixel art sprites
- Smooth transitions between moods
- Contextual status messages

### 🖥️ System Awareness
- **CPU monitoring** — Gets intense during heavy loads
- **Memory tracking** — Warns you about high usage
- **Network detection** — Celebrates connectivity
- **Idle detection** — Falls asleep when you're AFK, wakes up when you return

### 🎮 Interactive
- **Mouse tracking** — Follows your cursor with its eyes
- **Draggable** — Place it anywhere on your desktop
- **Resizable** — Scroll wheel to scale up/down
- **Color themes** — 10 preset colors via tray menu
- **Bounce mode** — DVD-logo style screensaver

### 💫 Polished Details
- **Breathing animation** — Subtle idle pulse
- **Always-on-top** — Floats above other windows
- **System tray** — Minimize and access settings
- **Transparent background** — Clean floating appearance

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
| **Click** | Pet interaction with milestone rewards |
| **Double-click** | Spin animation |
| **Right-click tray** | Access menu and settings |

### Tray Menu Options

- 🔄 **Bounce Mode** — Toggle DVD-style bouncing
- 🎨 **Color** — Choose from 10 theme colors
- 📌 **Always on Top** — Toggle window priority
- 🔄 **Reset Position** — Return to default location
- ❌ **Quit** — Close Radgotchi

### System Reactions

| Condition | Radgotchi's Response |
|-----------|---------------------|
| CPU > 90% | 😰 Intense, shaking |
| Memory > 85% | 😟 Concerned |
| Network lost | 😢 Sad, searching |
| User idle 2min | 😴 Falls asleep |
| User returns | 😆 Excited wakeup |

---

## 🎨 Customization

### Color Themes

Right-click the tray icon → **Color** to choose from:
- 🔴 Red (default)
- 🩵 Cyan
- 💚 Green (Hacker)
- 💜 Purple
- 💗 Pink
- 🧡 Orange
- 💛 Gold
- 🩷 Hot Pink
- 💙 Blue
- 🤍 White

### CSS Variables

For deeper customization, edit `styles.css`:

```css
:root {
    --rg-color: #ff3344;       /* Main accent */
    --rg-glow: #ff334488;      /* Glow effect */
    --rg-status-color: #cc2233; /* Status text */
}
```

### Custom Status Messages

Edit the `statusText` object in `radgotchi.js` to add your own messages for each mood.

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
├── main.js          # Electron main process
├── preload.js       # Secure IPC bridge
├── renderer.js      # UI logic & interactions
├── radgotchi.js     # Pet behavior module
├── index.html       # App shell
├── styles.css       # Animations & themes
├── package.json     # Config & dependencies
└── assets/          # Sprite images (25+)
```

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

