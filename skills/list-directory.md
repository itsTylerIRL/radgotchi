---
name: list_directory
description: List files and folders in a directory.
icon: 📁
parameters:
  path:
    type: string
    description: Absolute path to the directory
    required: true
---

# List Directory

Lists up to 100 entries in a directory, prefixed with 📁 for folders and 📄 for files.

```js
const fs = require('fs');
const os = require('os');
const dirPath = args.path || os.homedir();
const resolved = require('path').resolve(dirPath);

if (!fs.existsSync(resolved)) {
    return { error: `Directory not found: ${resolved}` };
}
const entries = fs.readdirSync(resolved, { withFileTypes: true });
const listing = entries.slice(0, 100).map(e =>
    (e.isDirectory() ? '📁 ' : '📄 ') + e.name
).join('\n');
return { result: listing || '(empty directory)' };
```
