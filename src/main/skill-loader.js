'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let skillsDir = null;
let loadedSkills = new Map();  // name -> { definition, execute, icon }

/**
 * Initialise the skill loader.
 * @param {Electron.App} app – used to resolve the skills folder in packaged builds
 */
function init(app) {
    if (app.isPackaged) {
        skillsDir = path.join(process.resourcesPath, 'skills');
    } else {
        skillsDir = path.join(__dirname, '..', '..', 'skills');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Markdown parser — extracts YAML frontmatter + first ```js block
// ═══════════════════════════════════════════════════════════════════════════

function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return { meta: {}, body: content };
    const yamlBlock = match[1];
    const body = content.slice(match[0].length).trim();

    // Minimal YAML parser — handles the flat + nested structure we need
    const meta = {};
    const lines = yamlBlock.split(/\r?\n/);
    let currentParam = null;
    let currentProp = null;

    for (const line of lines) {
        // Skip blank lines and comments
        if (!line.trim() || line.trim().startsWith('#')) continue;

        // Top-level key (no indentation)
        const topMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)/);
        if (topMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
            const key = topMatch[1];
            const val = topMatch[2].trim();
            if (key === 'parameters') {
                meta.parameters = {};
                currentParam = null;
                currentProp = null;
            } else if (key === 'required' && !currentParam) {
                // Top-level required as YAML list
                meta.required = parseYamlList(val, lines, lines.indexOf(line));
            } else {
                meta[key] = unquoteYaml(val);
                currentParam = null;
                currentProp = null;
            }
            continue;
        }

        // Parameter name (2-space indent under parameters)
        const paramMatch = line.match(/^  (\w[\w-]*)\s*:\s*(.*)/);
        if (paramMatch && meta.parameters !== undefined) {
            currentParam = paramMatch[1];
            meta.parameters[currentParam] = {};
            currentProp = null;
            continue;
        }

        // Parameter property (4-space indent)
        const propMatch = line.match(/^    (\w[\w-]*)\s*:\s*(.*)/);
        if (propMatch && currentParam) {
            const key = propMatch[1];
            let val = unquoteYaml(propMatch[2].trim());
            if (val === 'true') val = true;
            else if (val === 'false') val = false;
            meta.parameters[currentParam][key] = val;
            continue;
        }
    }

    return { meta, body };
}

function parseYamlList(inlineVal, lines, startIdx) {
    // Inline: required: [a, b]
    if (inlineVal.startsWith('[')) {
        return inlineVal.replace(/[\[\]]/g, '').split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    }
    // Block style
    const items = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
        const m = lines[i].match(/^\s+-\s+(.*)/);
        if (m) items.push(m[1].trim().replace(/['"]/g, ''));
        else if (lines[i].trim() && !lines[i].match(/^\s/)) break;
    }
    return items;
}

function unquoteYaml(s) {
    if (!s) return s;
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
    }
    return s;
}

function extractJsCodeBlock(body) {
    const match = body.match(/```js\s*\r?\n([\s\S]*?)```/);
    return match ? match[1].trim() : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Build OpenAI-format tool definition from parsed metadata
// ═══════════════════════════════════════════════════════════════════════════

function buildToolDefinition(meta) {
    const properties = {};
    const required = [];

    if (meta.parameters) {
        for (const [paramName, paramDef] of Object.entries(meta.parameters)) {
            properties[paramName] = {
                type: paramDef.type || 'string',
                description: paramDef.description || paramName,
            };
            if (paramDef.required === true) {
                required.push(paramName);
            }
        }
    }

    // Also honour a top-level `required` list
    if (meta.required && Array.isArray(meta.required)) {
        for (const r of meta.required) {
            if (!required.includes(r)) required.push(r);
        }
    }

    return {
        type: 'function',
        function: {
            name: meta.name,
            description: meta.description || '',
            parameters: {
                type: 'object',
                properties,
                required,
            }
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Compile the JS code block into a callable function
// ═══════════════════════════════════════════════════════════════════════════

function compileHandler(code, skillName) {
    // Wrap the code block in an async function that receives `args`
    // and has access to `require` and common Node globals.
    const wrapped = `'use strict';
module.exports = async function skillHandler(args) {
${code}
};`;

    const script = new vm.Script(wrapped, { filename: `skill:${skillName}` });

    // Create a module-like sandbox with require available
    const sandbox = {
        module: { exports: {} },
        exports: {},
        require,
        console,
        process,
        Buffer,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        URL,
        __dirname: skillsDir,
    };

    script.runInNewContext(sandbox, { timeout: 5000 });
    return sandbox.module.exports;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load (or reload) all skills from the skills/ directory.
 */
function loadSkills() {
    loadedSkills.clear();

    if (!skillsDir || !fs.existsSync(skillsDir)) {
        console.warn('[Skills] Skills directory not found:', skillsDir);
        return;
    }

    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
        try {
            const content = fs.readFileSync(path.join(skillsDir, file), 'utf-8');
            const { meta, body } = parseFrontmatter(content);

            if (!meta.name) {
                console.warn(`[Skills] Skipping ${file}: missing 'name' in frontmatter`);
                continue;
            }

            const definition = buildToolDefinition(meta);
            const jsCode = extractJsCodeBlock(body);
            let execute = null;

            if (jsCode) {
                execute = compileHandler(jsCode, meta.name);
            } else {
                console.warn(`[Skills] ${file}: no \`\`\`js code block — skill will have no handler`);
            }

            loadedSkills.set(meta.name, {
                definition,
                execute,
                icon: meta.icon || '🔧',
                file,
            });

            console.log(`[Skills] Loaded: ${meta.name} (${file})`);
        } catch (e) {
            console.error(`[Skills] Failed to load ${file}:`, e.message);
        }
    }

    console.log(`[Skills] ${loadedSkills.size} skill(s) loaded`);
}

/**
 * Returns the OpenAI-format tool definitions array for all loaded skills.
 */
function getToolDefinitions() {
    return Array.from(loadedSkills.values()).map(s => s.definition);
}

/**
 * Returns a map of skill name → icon emoji.
 */
function getToolIcons() {
    const icons = {};
    for (const [name, skill] of loadedSkills) {
        icons[name] = skill.icon;
    }
    return icons;
}

/**
 * Execute a skill by name.
 * @param {string} name – tool/function name
 * @param {object} args – parsed arguments from the LLM
 * @returns {Promise<{result: string} | {error: string}>}
 */
async function executeToolCall(name, args) {
    const skill = loadedSkills.get(name);
    if (!skill) {
        return { error: `Unknown tool: ${name}` };
    }
    if (!skill.execute) {
        return { error: `Skill '${name}' has no handler` };
    }
    try {
        const result = await skill.execute(args);
        return result;
    } catch (e) {
        return { error: `Tool execution error: ${e.message}` };
    }
}

/**
 * Returns the number of loaded skills.
 */
function getSkillCount() {
    return loadedSkills.size;
}

module.exports = {
    init,
    loadSkills,
    getToolDefinitions,
    getToolIcons,
    executeToolCall,
    getSkillCount,
};
