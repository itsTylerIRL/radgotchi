---
name: create_file
description: Create or overwrite a file on the local filesystem with the given content.
icon: 📝
parameters:
  path:
    type: string
    description: Absolute path for the file
    required: true
  content:
    type: string
    description: Content to write to the file
    required: true
---

# Create File

Creates (or overwrites) a file at the given absolute path. Parent directories are
created automatically if they don't exist.

```js
const fs = require('fs');
const pathMod = require('path');
const filePath = args.path || '';
const content = args.content || '';
const resolved = pathMod.resolve(filePath);
const dir = pathMod.dirname(resolved);

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}
fs.writeFileSync(resolved, content, 'utf-8');
return { result: `File created: ${resolved} (${content.length} bytes)` };
```
