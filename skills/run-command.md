---
name: run_command
description: Run a shell command and return its output. Do NOT run destructive commands.
icon: ⚙️
timeout: 20s
parameters:
  command:
    type: string
    description: The shell command to execute
    required: true
---

# Run Command

Executes a shell command with a 15-second timeout and returns stdout.
Destructive commands are blocked by a safety pattern list.

```js
const { execSync } = require('child_process');
const os = require('os');

const BLOCKED_COMMANDS = [
    /\brm\s+(-rf?|--recursive)\b/i, /\brm\s+-/i, /\brmdir\b/i,
    /\bmkfs\b/i, /\bdd\s+/i, /\bshutdown\b/i, /\breboot\b/i,
    /\bsudo\b/i, /\bformat\b/i, />\s*\/dev\//i,
];

const cmd = args.command || '';
if (BLOCKED_COMMANDS.some(re => re.test(cmd))) {
    return { error: 'Command blocked for safety: ' + cmd };
}

try {
    const output = execSync(cmd, {
        timeout: 15000,
        maxBuffer: 512 * 1024,
        cwd: os.homedir(),
        encoding: 'utf-8'
    });
    return { result: output.slice(0, 4000) || '(no output)' };
} catch (e) {
    const stderr = e.stderr ? e.stderr.slice(0, 1000) : '';
    const stdout = e.stdout ? e.stdout.slice(0, 1000) : '';
    return { error: `Command failed: ${stderr || stdout || e.message}` };
}
```
