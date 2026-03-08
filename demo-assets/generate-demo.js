/**
 * RADGOTCHI DEMO ASSET GENERATOR
 * Generates rendered GIFs/PNGs for each README section
 * Sprites are colored cyan for demo purposes
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Configuration
const OUTPUT_DIR = path.join(__dirname, 'demo-assets');
const ASSETS_DIR = path.join(__dirname, 'assets');
const CYAN_COLOR = { r: 0, g: 255, b: 255 };

// README sections mapped to relevant sprites and descriptions
const SECTIONS = [
  {
    id: 'header',
    title: 'RADGOTCHI',
    sprites: ['AWAKE.png'],
    description: 'Desktop Intelligence Asset',
    type: 'png'
  },
  {
    id: 'behavioral-intelligence',
    title: 'Behavioral Intelligence',
    sprites: ['HAPPY.png', 'EXCITED.png', 'COOL.png', 'ANGRY.png'],
    description: '25+ Mood States',
    type: 'gif'
  },
  {
    id: 'system-telemetry',
    title: 'System Telemetry',
    sprites: ['INTENSE.png', 'SMART.png'],
    description: 'CPU • Memory • Network',
    type: 'png'
  },
  {
    id: 'movement-protocols',
    title: 'Movement Protocols',
    sprites: ['LOOK_L.png', 'AWAKE.png', 'LOOK_R.png'],
    description: 'STATIC • BOUNCE • FOLLOW • WANDER',
    type: 'gif'
  },
  {
    id: 'sigint-terminal',
    title: 'SIGINT Terminal',
    sprites: ['SMART.png'],
    description: 'Local LLM Integration',
    type: 'png'
  },
  {
    id: 'audio-subsystem',
    title: 'Audio Subsystem',
    sprites: ['EXCITED.png'],
    description: 'Web Audio Synthesis',
    type: 'png'
  },
  {
    id: 'clearance-system',
    title: 'Clearance System',
    sprites: ['MOTIVATED.png', 'GRATEFUL.png'],
    description: 'XP • Levels • Ranks',
    type: 'png'
  },
  {
    id: 'asset-maintenance',
    title: 'Asset Maintenance',
    sprites: ['SAD.png', 'HAPPY.png'],
    description: 'Feed • Sleep • Care',
    type: 'gif'
  },
  {
    id: 'focus-operations',
    title: 'Focus Operations',
    sprites: ['INTENSE.png'],
    description: 'Pomodoro Timer',
    type: 'png'
  },
  {
    id: 'progression-engine',
    title: 'Progression Engine',
    sprites: ['COOL.png'],
    description: 'TRAINEE → PHANTOM',
    type: 'png'
  },
  {
    id: 'sleepy-mode',
    title: 'Sleepy Mode',
    sprites: ['SLEEP.png', 'SLEEP2.png'],
    description: 'Low-Power State',
    type: 'gif'
  },
  {
    id: 'visual-themes',
    title: 'Visual Themes',
    sprites: ['AWAKE.png'],
    description: '10 Color Themes',
    type: 'png'
  }
];

/**
 * Apply cyan tint to image data
 * Replaces any non-transparent pixel with cyan glow
 * Works with black sprites by using alpha as the basis
 */
function applyCyanTint(imageData) {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // Skip fully transparent pixels
    if (a === 0) continue;
    
    // For black sprites, use alpha channel to determine intensity
    // For colored sprites, use luminance
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // If sprite is mostly black, use alpha-based coloring
    // Otherwise use luminance-based coloring
    let intensity;
    if (luminance < 30) {
      // Black sprite - use full cyan color based on alpha
      intensity = 255;
    } else {
      // Colored sprite - boost luminance
      intensity = Math.min(255, luminance * 1.4);
    }
    
    // Apply glowing cyan (R=0, G=255, B=255 for pure cyan)
    data[i] = Math.floor(intensity * 0.0);      // R - none for pure cyan
    data[i + 1] = Math.floor(intensity * 1.0);  // G - full
    data[i + 2] = Math.floor(intensity * 1.0);  // B - full
  }
  
  return imageData;
}

/**
 * Load and tint a sprite image
 */
async function loadTintedSprite(spriteName) {
  const spritePath = path.join(ASSETS_DIR, spriteName);
  
  if (!fs.existsSync(spritePath)) {
    console.warn(`  ⚠ Sprite not found: ${spriteName}`);
    return null;
  }
  
  const image = await loadImage(spritePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(image, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const tintedData = applyCyanTint(imageData);
  ctx.putImageData(tintedData, 0, 0);
  
  return canvas;
}

/**
 * Generate a single PNG demo image
 */
async function generatePNG(section) {
  const PADDING = 40;
  const SPRITE_SIZE = 200;  // 3x bigger sprites
  const HEADER_HEIGHT = 60;
  const FOOTER_HEIGHT = 50;
  
  const spriteCount = section.sprites.length;
  const totalSpriteWidth = spriteCount * SPRITE_SIZE + (spriteCount - 1) * 20;
  const width = Math.max(500, totalSpriteWidth + PADDING * 2);
  const height = HEADER_HEIGHT + SPRITE_SIZE + FOOTER_HEIGHT + PADDING * 2;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Background - dark terminal style
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);
  
  // Scanline effect
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)';
  for (let y = 0; y < height; y += 2) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // Border
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, width - 4, height - 4);
  
  // Title
  ctx.fillStyle = '#00ffff';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(section.title.toUpperCase(), width / 2, PADDING + 30);
  
  // Load and draw tinted sprites
  const startX = (width - totalSpriteWidth) / 2;
  const spriteY = HEADER_HEIGHT + PADDING;
  
  for (let i = 0; i < section.sprites.length; i++) {
    const tintedSprite = await loadTintedSprite(section.sprites[i]);
    if (tintedSprite) {
      // Preserve aspect ratio when drawing sprites
      const aspectRatio = tintedSprite.width / tintedSprite.height;
      let drawWidth, drawHeight;
      
      if (aspectRatio >= 1) {
        // Wider than tall
        drawWidth = SPRITE_SIZE;
        drawHeight = SPRITE_SIZE / aspectRatio;
      } else {
        // Taller than wide
        drawHeight = SPRITE_SIZE;
        drawWidth = SPRITE_SIZE * aspectRatio;
      }
      
      const x = startX + i * (SPRITE_SIZE + 20) + (SPRITE_SIZE - drawWidth) / 2;
      const y = spriteY + (SPRITE_SIZE - drawHeight) / 2;
      ctx.drawImage(tintedSprite, x, y, drawWidth, drawHeight);
    }
  }
  
  // Description
  ctx.fillStyle = '#00cccc';
  ctx.font = '14px monospace';
  ctx.fillText(section.description, width / 2, height - PADDING);
  
  // Glow effect on sprites
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 20;
  
  return canvas;
}

/**
 * Generate animated GIF frames
 * Returns array of canvas frames
 */
async function generateGIFFrames(section) {
  const FRAME_COUNT = section.sprites.length * 2; // Loop through sprites twice
  const frames = [];
  
  for (let f = 0; f < FRAME_COUNT; f++) {
    const spriteIndex = f % section.sprites.length;
    const singleSpriteSection = {
      ...section,
      sprites: [section.sprites[spriteIndex]]
    };
    
    const frame = await generatePNG(singleSpriteSection);
    frames.push(frame);
  }
  
  return frames;
}

/**
 * Save canvas as PNG
 */
function savePNG(canvas, filename) {
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outputPath, buffer);
  console.log(`  ✓ Saved: ${filename}`);
}

/**
 * Save GIF frames as individual PNGs (for external GIF assembly)
 * Note: For actual GIF creation, use gifencoder or external tools
 */
function saveGIFFrames(frames, baseName) {
  const framesDir = path.join(OUTPUT_DIR, `${baseName}-frames`);
  
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }
  
  frames.forEach((frame, i) => {
    const buffer = frame.toBuffer('image/png');
    const framePath = path.join(framesDir, `frame-${String(i).padStart(3, '0')}.png`);
    fs.writeFileSync(framePath, buffer);
  });
  
  console.log(`  ✓ Saved ${frames.length} frames to: ${baseName}-frames/`);
  
  // Also save first frame as static preview
  savePNG(frames[0], `${baseName}-preview.png`);
}

/**
 * Generate combined showcase image
 */
async function generateShowcase() {
  const COLS = 4;
  const CELL_SIZE = 200;
  const PADDING = 10;
  
  const rows = Math.ceil(SECTIONS.length / COLS);
  const width = COLS * CELL_SIZE + (COLS + 1) * PADDING;
  const height = rows * CELL_SIZE + (rows + 1) * PADDING + 80;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, width, height);
  
  // Header
  ctx.fillStyle = '#00ffff';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RADGOTCHI DEMO', width / 2, 50);
  
  // Draw each section preview
  for (let i = 0; i < SECTIONS.length; i++) {
    const section = SECTIONS[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    
    const x = PADDING + col * (CELL_SIZE + PADDING);
    const y = 80 + PADDING + row * (CELL_SIZE + PADDING);
    
    // Cell background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    
    // Cell border
    ctx.strokeStyle = '#00ffff44';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
    
    // Section title
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(section.title.toUpperCase(), x + CELL_SIZE / 2, y + 20);
    
    // Draw first sprite (tinted)
    const sprite = await loadTintedSprite(section.sprites[0]);
    if (sprite) {
      const maxSize = 120;  // Bigger sprites in showcase
      const aspectRatio = sprite.width / sprite.height;
      let drawWidth, drawHeight;
      
      if (aspectRatio >= 1) {
        drawWidth = maxSize;
        drawHeight = maxSize / aspectRatio;
      } else {
        drawHeight = maxSize;
        drawWidth = maxSize * aspectRatio;
      }
      
      const spriteX = x + (CELL_SIZE - drawWidth) / 2;
      const spriteY = y + 35 + (maxSize - drawHeight) / 2;
      ctx.drawImage(sprite, spriteX, spriteY, drawWidth, drawHeight);
    }
    
    // Description
    ctx.fillStyle = '#00cccc88';
    ctx.font = '10px monospace';
    ctx.fillText(section.description, x + CELL_SIZE / 2, y + CELL_SIZE - 15);
  }
  
  return canvas;
}

/**
 * Main execution
 */
async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   RADGOTCHI DEMO ASSET GENERATOR       ║');
  console.log('║   Sprites tinted: CYAN                 ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  console.log('Generating section assets...\n');
  
  // Generate individual section assets
  for (const section of SECTIONS) {
    console.log(`📦 ${section.title}`);
    
    if (section.type === 'gif') {
      const frames = await generateGIFFrames(section);
      saveGIFFrames(frames, section.id);
    } else {
      const canvas = await generatePNG(section);
      savePNG(canvas, `${section.id}.png`);
    }
  }
  
  // Generate combined showcase
  console.log('\n📦 Combined Showcase');
  const showcase = await generateShowcase();
  savePNG(showcase, 'showcase.png');
  
  console.log('\n════════════════════════════════════════');
  console.log(`✓ All assets generated in: ${OUTPUT_DIR}`);
  console.log('════════════════════════════════════════\n');
  
  // Print GIF assembly instructions
  console.log('📝 To assemble GIFs from frames, use:');
  console.log('   ffmpeg -framerate 4 -i frame-%03d.png -vf palettegen palette.png');
  console.log('   ffmpeg -framerate 4 -i frame-%03d.png -i palette.png -lavfi paletteuse output.gif');
  console.log('');
  console.log('   Or use ImageMagick:');
  console.log('   magick convert -delay 25 -loop 0 frame-*.png output.gif\n');
}

// Run
main().catch(err => {
  console.error('Error generating demo assets:', err);
  process.exit(1);
});
