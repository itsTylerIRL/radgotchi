# Contributing to Radgotchi

Thanks for your interest in contributing! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/itsTylerIRL/radgotchi.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development

```bash
# Run in development mode
npm start

# Run with GPU disabled (for VMs/remote sessions)
npm run start:safe
```

## Project Structure

| Directory/File | Purpose |
|------|--------|
| `main.js` | Electron main process entry point |
| `preload.js` | Secure IPC bridge (main window) |
| `preload-chat.js` | Secure IPC bridge (chat window) |
| `src/main/` | Main process modules (persistence, networking, XP, etc.) |
| `src/renderer/` | Renderer ES modules (sprites, mood, audio, interaction, etc.) |
| `src/chat/` | Chat window ES modules (messages, controls, equalizer, etc.) |
| `src/styles/` | All CSS (styles.css, chat-window.css) |
| `index.html` | App shell |
| `chat.html` | RAD Terminal window |

## Adding Features

### New Mood

1. Add sprite image to `assets/gotchi/` (e.g., `NEWMOOD.png`)
2. Register in `src/renderer/pet-sprites.js`:
   ```javascript
   const faces = {
       // ... existing moods
       newmood: 'assets/gotchi/NEWMOOD.png',
   };
   ```
3. Add status messages in `src/renderer/status-text.js`:
   ```javascript
   const statusText = {
       // ... existing
       newmood: ['Status message 1', 'Status message 2'],
   };
   ```

### New Animation

1. Add keyframes to `src/styles/styles.css`:
   ```css
   @keyframes rg-neweffect {
       0% { transform: ...; }
       100% { transform: ...; }
   }
   ```
2. Add class:
   ```css
   .radgotchi-face.rg-neweffect { animation: rg-neweffect 0.5s ease-out; }
   ```
3. Use in code:
   ```javascript
   RG.setMood('happy', { anim: 'neweffect' });
   ```

### New System Event

1. Add detection in `src/main/system-monitor.js`
2. Send event: `mainWindow.webContents.send('system-event', { type: 'new-event', value: ... })`
3. Handle in `src/renderer/health-monitor.js` inside `handleSystemEvent()`

## Code Style

- Use 4-space indentation
- Use single quotes for strings
- Add comments for complex logic
- Keep functions focused and small

## Submitting Changes

1. Test your changes thoroughly
2. Update README if adding user-facing features
3. Commit with descriptive messages:
   ```
   feat: add new mood state for low battery
   fix: resolve bounce mode edge detection
   docs: update installation instructions
   ```
4. Push to your fork
5. Open a Pull Request with:
   - Clear description of changes
   - Screenshots/GIFs for visual changes
   - Reference any related issues

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- OS version and Node.js version
- Screenshots if applicable

## Feature Requests

Open an issue with:
- Clear description of the feature
- Use cases / why it would be useful
- Mockups if applicable

---

Thanks for helping make Radgotchi better! 🤖
