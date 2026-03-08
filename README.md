<p align="center">
  <img src="assets/AWAKE.png" alt="Radgotchi" width="100">
</p>

<h1 align="center">RADGOTCHI</h1>
<p align="center"><code>CLASSIFICATION: OPEN SOURCE</code></p>

<p align="center">
  <b>Desktop Intelligence Asset</b> — Cross-platform radbro companion app that monitors your system,<br>
  interfaces with local AI, and rewards operational engagement.
</p>

<p align="center">
  <code>PLATFORM SUPPORT:</code> Windows • macOS • Linux
</p>

<p align="center">
  <img src="assets/AWAKE.png" alt="Radgotchi" width="80">
  <img src="assets/HAPPY.png" alt="Happy" width="80">
  <img src="assets/EXCITED.png" alt="Excited" width="80">
  <img src="assets/COOL.png" alt="Cool" width="80">
</p>

<p align="center">
  <a href="#system-capabilities">Capabilities</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#operational-parameters">Operations</a> •
  <a href="#sigint-terminal">SIGINT Terminal</a> •
  <a href="#clearance-progression">Clearance</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#distribution">Distribution</a>
</p>

---

## System Capabilities

Radgotchi operates as a persistent desktop intelligence asset, continuously monitoring system telemetry and user engagement patterns. The following subsystems work in concert to create a responsive companion that adapts to your operational environment in real time.

### Behavioral Intelligence

Your asset maintains situational awareness through an advanced mood state engine. Each state corresponds to specific environmental triggers, ensuring the visual representation matches current operational status.

| Capability | Description |
|------------|-------------|
| **Mood States** | 25+ expressive states with hand-crafted pixel art |
| **Context Awareness** | Localized status messaging (EN/中文) |
| **Adaptive Response** | Smooth state transitions based on system events |

### System Telemetry

The asset continuously ingests system health data, translating raw metrics into behavioral responses. High-severity conditions trigger visual and auditory alerts.

| Feed | Response Behavior |
|------|-------------------|
| **CPU Load** | Elevated alertness during high utilization, spike detection |
| **Memory Pressure** | Warning indicators above 85% threshold |
| **Network Status** | Connectivity state changes logged and displayed |
| **Process Health** | Hung process detection and notification |
| **User Presence** | Idle detection (2min) triggers sleep mode; returns on activity |

### Movement Protocols

Select from four distinct movement behaviors to match your workflow. Each mode offers different levels of autonomy and screen utilization.

| Mode | Behavior |
|------|----------|
| `STATIC` | Fixed position, manual repositioning only |
| `BOUNCE` | Perimeter patrol, edge reflection |
| `FOLLOW` | Cursor tracking, maintains visual contact |
| `WANDER` | Autonomous exploration with rest intervals |

### SIGINT Terminal

The integrated communication interface provides direct access to local language models. All traffic remains local—no external API calls unless explicitly configured.

| Feature | Status |
|---------|--------|
| **Local LLM Integration** | Ollama, LM Studio, LocalAI, OpenAI-compatible |
| **Streaming Decode** | Real-time token display (endpoint-dependent) |
| **Session Persistence** | Message history retained across sessions |
| **Mood Feedback** | Visual state changes during processing |
| **Markdown Render** | Code blocks, formatting, copy functionality |

### Audio Subsystem

All sound effects are generated procedurally via the Web Audio API—no external audio files required. Toggle mute from the command center or terminal interface.

| Component | Specification |
|-----------|---------------|
| **Engine** | Web Audio API synthesis |
| **Sound Library** | 14 unique operational tones |
| **Controls** | MUTE toggle, volume adjustment via API |

### Clearance System

Operational engagement is rewarded through a comprehensive progression framework. Sustained activity unlocks increasingly prestigious clearance designations.

| Mechanic | Description |
|----------|-------------|
| **Milestone Tracking** | Clicks, messages, sessions, XP, uptime |
| **Achievement Unlock** | "🔓 CLEARANCE GRANTED" notifications |
| **Persistence** | Progress survives session termination |

### Asset Maintenance

Like any field asset, Radgotchi requires periodic care. Neglecting vital signs results in XP penalties; attentive operation yields bonus rewards.

| Need | Mechanism |
|------|----------|
| **Sustenance** | Feed via terminal interface |
| **Energy** | Sleep mode restoration |
| **Penalties** | XP decay on neglect |
| **Monitoring** | Stats panel visualization |

### Focus Operations

Integrated Pomodoro timer for sustained operational focus. Complete work cycles to earn XP bonuses and maintain peak productivity.

| Parameter | Value |
|-----------|-------|
| **Work Cycle** | 25 minutes |
| **Break Cycle** | 5 minutes |
| **Audio Alerts** | Session start/complete |
| **XP Reward** | +25 on completion |

### Progression Engine

The leveling system tracks cumulative engagement across all operational vectors—interactions, messages, sessions, and uptime. Advance through 13 clearance ranks from TRAINEE to PHANTOM.

| Metric | Range |
|--------|-------|
| **Levels** | 1–50+ (17,500+ XP max tier) |
| **Ranks** | 13 tiers (TRAINEE → PHANTOM) |
| **Persistence** | Automatic state serialization |
| **Engagement** | Streak tracking, level-up events |

### Localization

Full interface localization ensures global accessibility. All status messages, interface elements, and system notifications adapt to the selected language.

- **Primary:** English
- **Secondary:** 中文 (Chinese)
- **Toggle:** Terminal or system tray

### Visual Fidelity

Pixel-perfect rendering ensures your asset looks sharp at any scale. The floating window maintains transparency with always-on-top priority.

| Feature | Implementation |
|---------|----------------|
| **Idle Animation** | Breathing pulse effect |
| **Gaze Tracking** | Cursor-following eyes |
| **Window Priority** | Always-on-top rendering |
| **Transparency** | Clean floating overlay |
| **Sleepy Mode** | Low-power rest state |

---

## Deployment

Radgotchi deploys as a standalone Electron application. No additional runtime dependencies required after initial setup.

### System Requirements

| Dependency | Version |
|------------|---------|
| Node.js | v18+ |
| Windows | 10/11 |
| macOS | 10.15+ |
| Linux | Ubuntu/Debian recommended |

### Standard Deployment

```bash
# Acquire source
git clone https://github.com/itsTylerIRL/radgotchi.git
cd radgotchi

# Initialize dependencies
npm install

# Execute
npm start
```

### Fallback Mode

For environments with GPU constraints (VM, remote session, compatibility issues):

```bash
npm run start:safe
```

---

## Operational Parameters

Direct interaction with your asset is handled through mouse controls and the system tray command center. The following matrices define available inputs and their effects.

### Input Controls

Basic interaction mechanics for daily operation.

| Input | Action |
|-------|--------|
| `DRAG` | Reposition asset on screen |
| `SCROLL` | Scale adjustment |
| `CLICK` | Interaction event (+2 XP) |
| `TRAY RIGHT-CLICK` | Access command center |

### Command Center

Right-click the system tray icon to access the full command interface. All operational modes and configuration options are accessible here.

| Option | Function |
|--------|----------|
| Always on Top | Window priority toggle |
| Reset Position | Return to origin coordinates |
| Movement | Protocol selection |
| Color | Visual theme configuration |
| Language | Localization toggle |
| Chat Settings | LLM endpoint configuration |
| Dev Tools | Debug interface |
| Update | Pull latest from repository |
| Quit | Terminate session |

### Event Response Matrix

System telemetry triggers automatic behavioral responses. These thresholds ensure your asset reflects actual system health.

| Trigger | Asset Response |
|---------|----------------|
| `CPU > 80%` | Alert state |
| `CPU > 95%` | Critical alert |
| `MEM > 85%` | Pressure warning |
| `NET DOWN` | Connection lost indicator |
| `NET UP` | Connectivity restored |
| `PROC HUNG` | Process fault detected |
| `IDLE 2m` | Sleep mode engaged |
| `ACTIVITY` | Wake event |

---

## SIGINT Terminal

Integrated communication interface with local language model support.

### Compatible Endpoints

Any OpenAI-compatible API endpoint works out of the box. Popular local inference backends are preconfigured for rapid deployment.

| Backend | Default Endpoint |
|---------|------------------|
| [Ollama](https://ollama.ai/) | `localhost:11434/v1/chat/completions` |
| [LM Studio](https://lmstudio.ai/) | `localhost:1234/v1/chat/completions` |
| [LocalAI](https://localai.io/) | Custom configuration |
| OpenAI-compatible | Any conformant endpoint |

### Configuration Sequence

1. Access Command Center → **Chat Settings**
2. Enable interface, specify endpoint URL
3. Define model identifier (`llama2`, `mistral`, `codellama`, etc.)
4. Configure system prompt (optional)
5. Commit configuration

### Interface Access

Click asset to launch **SIGINT Terminal**.

### Terminal Features

The SIGINT Terminal provides a full-featured chat interface with retro CRT aesthetics. All controls are accessible from the terminal footer.

| Feature | Description |
|---------|-------------|
| **Visual Design** | CRT scanlines, grid overlay, retro aesthetic |
| **Streaming** | Real-time token decode and display |
| **Persistence** | Automatic session history retention |
| **Activity Log** | Event tracking (XP, milestones, system) |
| **State Display** | Processing/success/error indicators |
| **Markdown** | Full rendering with code block copy |
| **Controls** | Movement, theme, language, sleep, stats, focus |
| **Status Bar** | Level, rank, progress visualization |
| **Audio** | MUTE toggle for silent operation |

---

## Clearance Progression

Operational engagement generates experience points. Sustained activity advances clearance level.

### XP Acquisition

Experience points are earned through various operational activities. Higher-engagement actions yield greater rewards.

| Source | Yield | Conditions |
|--------|-------|------------|
| Passive | +1 | Every 30 seconds |
| Interaction | +2 | 3-second cooldown |
| Message Send | +5 | Per transmission |
| Message Receive | +3 | Per response |
| Focus Complete | +25 | Pomodoro session |
| Alert Response | +15 | Attention event |

### Level Thresholds

Each level requires progressively more XP. The curve accelerates through mid-game before stabilizing at +3,000 XP per level.

| Level | XP Required | Level | XP Required |
|-------|-------------|-------|-------------|
| 1 | 0 | 10 | 2,600 |
| 2 | 50 | 15 | 7,200 |
| 3 | 150 | 20 | 17,500 |
| 5 | 500 | 21+ | +3,000/level |

### Clearance Ranks

Your clearance rank reflects cumulative operational achievement. Each designation unlocks at specific level thresholds.

| Designation | Min Level | Designation | Min Level |
|-------------|-----------|-------------|-----------|
| TRAINEE | 1 | CONTROLLER | 17 |
| ANALYST | 3 | DIRECTOR | 20 |
| OPERATIVE | 5 | EXECUTIVE | 24 |
| AGENT | 8 | OVERSEER | 28 |
| SPECIALIST | 11 | SENTINEL | 33 |
| HANDLER | 14 | ARCHITECT | 40 |
| | | PHANTOM | 50 |

### Milestone Objectives

Milestones track categorical achievements across multiple engagement vectors. Reaching each threshold triggers a clearance notification.

| Category | Thresholds |
|----------|------------|
| Interactions | 10 → 50 → 100 → 500 → 1,000 → 5,000 |
| Transmissions | 5 → 25 → 50 → 100 → 250 → 500 |
| Sessions | 5 → 10 → 25 → 50 → 100 |
| Total XP | 100 → 500 → 1K → 5K → 10K → 50K |
| Uptime | 1h → 4h → 12h → 24h → 48h → 72h |

### Status Display

Your current progression is always visible in the terminal status bar. Expand the stats panel for detailed metrics.

| Element | Content |
|---------|---------|
| Level Badge | Current clearance level |
| Rank Title | Designation name |
| Progress Bar | XP to next threshold |
| Total XP | Cumulative acquisition |
| Stats Panel | Detailed metrics (📊 toggle) |

State automatically persists to local storage.

---

## Configuration

Radgotchi offers extensive customization options for visual appearance, language, and behavior. All settings persist across sessions.

### Visual Themes

Ten color themes are available out of the box. Access via Command Center → **Color** or terminal dropdown:

| Theme | Code | Theme | Code |
|-------|------|-------|------|
| Red | `red` | Yellow | `yellow` |
| Cyan | `cyan` | Blue | `blue` |
| Green | `green` | Lime | `lime` |
| Purple | `purple` | White | `white` |
| Pink | `pink` | Orange | `orange` |

### Localization

Switch between supported languages instantly. The entire interface—including status messages and system notifications—localizes automatically.

| Language | Access |
|----------|--------|
| English | Default |
| 中文 | Toggle via tray or terminal |

All interface elements and status messages localize automatically.

### Sleepy Mode

Enable low-power display mode via terminal toggle. Reduces visual activity and prevents energy loss over time.

### Style Variables

For advanced theming, modify `styles.css`:

```css
:root {
    --rg-color: #ff3344;       /* Primary accent */
    --rg-glow: #ff334488;      /* Glow intensity */
    --rg-status-color: #cc2233; /* Status text */
}
```

### System Prompt Configuration

Customize asset personality via Chat Settings:
- Modify system prompt to alter communication style
- Supports any persona configuration

---

## Distribution

Radgotchi can be packaged for distribution on all major platforms using electron-builder. Build artifacts are ready for direct distribution or installer deployment.

### Build Commands

```bash
# Current platform
npm run build

# Platform-specific
npm run build:win      # Windows (NSIS + portable)
npm run build:mac      # macOS (DMG + ZIP)
npm run build:linux    # Linux (AppImage + DEB)

# Portable only
npm run build:portable
```

### Output Artifacts

Builds produce platform-appropriate installers and portable executables.

| Platform | Artifacts |
|----------|----------|
| Windows | `Radgotchi Setup x.x.x.exe`, `Radgotchi x.x.x.exe` (portable) |
| macOS | `Radgotchi-x.x.x.dmg`, `Radgotchi-x.x.x-mac.zip` |
| Linux | `Radgotchi-x.x.x.AppImage`, `radgotchi_x.x.x_amd64.deb` |

All outputs written to `dist/` directory.

---

## Architecture

Radgotchi follows standard Electron architecture with clear separation between main process, preload scripts, and renderer processes. The codebase is intentionally minimal for easy modification.

### Source Structure

```
radgotchi/
├── main.js           # Main process, state management, IPC
├── preload.js        # Secure bridge (main window)
├── preload-chat.js   # Secure bridge (terminal window)
├── renderer.js       # UI controller
├── radgotchi.js      # Asset behavior engine
├── sounds.js         # Audio synthesis module
├── index.html        # Primary interface
├── chat.html         # SIGINT Terminal
├── styles.css        # Visual styling
├── package.json      # Project manifest
└── assets/           # Sprite library (25+)
```

### Persistent Data

All user data is stored in the system user data directory. These JSON files survive application updates.

Stored in user data directory:

| File | Contents |
|------|----------|
| `llm-config.json` | LLM endpoint configuration |
| `xp-data.json` | Progression state, streaks |
| `chat-data.json` | Message history |
| `milestones.json` | Achievement records |

---

## Technical Reference

For developers extending Radgotchi or integrating it with other systems. The following APIs provide programmatic control over asset behavior and audio.

### RG Module API

The global `RG` object exposes methods for direct asset manipulation. Useful for custom integrations or debugging.

Programmatic asset control:

```javascript
// State manipulation
RG.setMood('happy', { 
  duration: 3000,
  anim: 'bounce',
  status: 'Custom text'
});

// Severity response
RG.react('critical', 'Alert message');
RG.react('warning', 'Warning message');
RG.react('ok', 'Status normal');

// Telemetry ingestion
RG.assessHealth({
  cpu: { usage_total: 45 },
  memory: { percent: 60 }
});

// State inspection
console.log(RG.mood);
console.log(RG.petCount);
```

### SoundSystem API

The `SoundSystem` module generates all audio procedurally. Control playback, volume, and mute state programmatically.

Audio control interface:

```javascript
// Playback
SoundSystem.play('levelUp');
SoundSystem.play('click');
SoundSystem.play('messageReceive');

// Available: chatOpen, chatClose, messageSend, messageReceive,
// click, sleepStart, sleepEnd, attentionStart, attentionEnd,
// levelUp, milestone, pomodoroStart, pomodoroComplete, xpGain, xpLoss

// Enable/disable
SoundSystem.setEnabled(false);
SoundSystem.setEnabled(true);
SoundSystem.isEnabled();

// Volume (0.0 - 1.0)
SoundSystem.setVolume(0.5);
SoundSystem.getVolume();
```

### IPC Event Reference

These events facilitate communication between the main process and renderer windows. Subscribe via `api.on()` in preload-exposed contexts.

| Event | Payload | Description |
|-------|---------|-------------|
| `xp-update` | `{level, totalXp, progress, leveledUp}` | Progression change |
| `movement-mode-change` | `mode` | Protocol switch |
| `system-event` | `{type, value}` | System state delta |
| `idle-change` | `{idle: boolean}` | Presence detection |
| `set-color` | `color` | Theme update |
| `set-language` | `lang` | Locale switch |
| `chat-stream-chunk` | `{content, done}` | LLM stream data |
| `needs-update` | `{hunger, energy}` | Asset needs delta |
| `pomodoro-update` | `{mode, remaining}` | Timer state |
| `pomodoro-complete` | `{mode}` | Session complete |
| `activity-log-update` | `{type, message, ts}` | Activity event |
| `attention-event` | `{type, message}` | Alert triggered |

---

## License

`MIT` — See [LICENSE](LICENSE)

---

## Acknowledgments

<p align="center">
  <b>Inspired by the rad minds behind:</b>
</p>

<p align="center">
  <a href="https://radbro.xyz"><b>Radbro Webring</b></a><br>
  <a href="https://opensea.io/collection/radbro-webring">OpenSea</a> • <a href="https://x.com/radbro_webring">𝕏</a>
</p>

<p align="center">
  <a href="https://remilio.org"><b>Remilio</b></a> (Remilia Corporation)<br>
  <a href="https://opensea.io/collection/remilio-babies">OpenSea</a> • <a href="https://x.com/RemilioBaby">𝕏</a>
</p>

---

<p align="center">
  <code>[ END TRANSMISSION ]</code>
</p>
