---
name: read_file
description: Read the contents of a file on the local filesystem. Use absolute paths.
icon: 📖
parameters:
  path:
    type: string
    description: Absolute path to the file to read
    required: true
---

# Read File

Reads a file from disk and returns its contents. Limited to 512 KB.

```js
const fs = require('fs');
const filePath = args.path || '';
const resolved = require('path').resolve(filePath);

if (!fs.existsSync(resolved)) {
    return { error: `File not found: ${resolved}` };
}
const stat = fs.statSync(resolved);
if (stat.size > 512 * 1024) {
    return { error: `File too large (${(stat.size / 1024).toFixed(0)}KB). Max 512KB.` };
}
const content = fs.readFileSync(resolved, 'utf-8');
return { result: content };
```
