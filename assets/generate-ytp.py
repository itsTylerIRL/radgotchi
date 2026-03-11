"""
RADGOTCHI YouTube Poop Generator
Generates a chaotic, meme-style promotional video
MoviePy 2.x compatible
"""

import random
from pathlib import Path
import numpy as np
import os

# MoviePy 2.x imports
from moviepy import (
    ImageClip, CompositeVideoClip, concatenate_videoclips,
    TextClip, ColorClip, AudioClip
)

# Config
OUTPUT_SIZE = (1080, 1080)  # Square for social media
FPS = 30

# Font path for Windows
FONT_PATH = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'arialbd.ttf')

# Asset paths
SCRIPT_DIR = Path(__file__).parent
GOTCHI_DIR = SCRIPT_DIR / "gotchi"
DEMO_DIR = SCRIPT_DIR / "demo"

# Colors (RGB tuples)
NEON_GREEN = (0, 255, 65)
HOT_PINK = (255, 20, 147)
CYBER_BLUE = (0, 200, 255)
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)

def load_image_clip(path, duration=0.5):
    """Load an image as a clip with given duration"""
    clip = ImageClip(str(path), duration=duration)
    return clip.resized(height=OUTPUT_SIZE[1])

def apply_shake(clip, intensity=10):
    """Add screen shake effect using transform"""
    def shake_filter(frame):
        dx = random.randint(-intensity, intensity)
        dy = random.randint(-intensity, intensity)
        return np.roll(np.roll(frame, dx, axis=1), dy, axis=0)
    return clip.image_transform(shake_filter)

def apply_glitch_bars(clip):
    """Add horizontal glitch bar artifacts"""
    def glitch_filter(frame):
        frame = frame.copy()
        h, w = frame.shape[:2]
        for _ in range(random.randint(1, 5)):
            y1 = random.randint(0, max(1, h-20))
            y2 = min(h, y1 + random.randint(5, 20))
            shift = random.randint(-50, 50)
            frame[y1:y2] = np.roll(frame[y1:y2], shift, axis=1)
        return frame
    return clip.image_transform(glitch_filter)

def apply_invert(clip):
    """Invert colors"""
    def invert_filter(frame):
        return 255 - frame
    return clip.image_transform(invert_filter)

def apply_rgb_shift(clip, amount=10):
    """RGB channel shift glitch effect"""
    def shift_filter(frame):
        frame = frame.copy()
        frame[:, :, 0] = np.roll(frame[:, :, 0], amount, axis=1)
        frame[:, :, 2] = np.roll(frame[:, :, 2], -amount, axis=1)
        return frame
    return clip.image_transform(shift_filter)

def apply_color_boost(clip, factor=2.0):
    """Boost color intensity"""
    def boost_filter(frame):
        return np.clip(frame.astype(float) * factor, 0, 255).astype(np.uint8)
    return clip.image_transform(boost_filter)

def apply_mirror(clip):
    """Mirror horizontally"""
    def mirror_filter(frame):
        return frame[:, ::-1]
    return clip.image_transform(mirror_filter)

def make_stutter_clip(clip, times=3):
    """Repeat a clip rapidly for stutter effect"""
    short = clip.with_duration(0.08)
    return concatenate_videoclips([short] * times)

def create_text_burst(text, duration=0.3, fontsize=80, color='white'):
    """Create explosive text overlay"""
    txt = TextClip(
        text=text, 
        font_size=fontsize, 
        color=color,
        font=FONT_PATH,
        stroke_color='black', 
        stroke_width=3,
        text_align='center'
    )
    return txt.with_duration(duration).with_position('center')

def generate_chaos_audio(duration, sr=44100):
    """Generate chaotic 8-bit style audio"""
    def make_audio(t):
        t = np.atleast_1d(t)
        freq = 200 + 300 * np.sin(t * 15) + 100 * np.sin(t * 47)
        wave = np.sign(np.sin(2 * np.pi * freq * t))
        noise = np.random.rand(len(t)) * 0.3 - 0.15
        vol = 0.3 * (0.5 + 0.5 * np.sin(t * 8))
        result = vol * (wave + noise)
        # Return stereo
        return np.column_stack([result, result])
    
    return AudioClip(make_audio, duration=duration, fps=sr)

def main():
    print("=" * 50)
    print("  RADGOTCHI YTP GENERATOR")
    print("  Chaotic. Rapid. Rad.")
    print("=" * 50)
    
    clips = []
    
    # Gather assets
    gotchi_faces = list(GOTCHI_DIR.glob("*.png"))
    demo_images = list(DEMO_DIR.glob("*.png"))
    
    print(f"Found {len(gotchi_faces)} faces, {len(demo_images)} demo images")
    
    # === INTRO: Rapid face flashes ===
    print("Creating intro sequence...")
    for i in range(8):
        face = random.choice(gotchi_faces)
        clip = load_image_clip(face, duration=0.1)
        clip = clip.with_position('center')
        
        # Random effects
        if random.random() > 0.5:
            clip = apply_invert(clip)
        if random.random() > 0.7:
            clip = apply_mirror(clip)
        
        bg_color = random.choice([NEON_GREEN, HOT_PINK, CYBER_BLUE, BLACK])
        bg = ColorClip(OUTPUT_SIZE, color=bg_color, duration=0.1)
        clips.append(CompositeVideoClip([bg, clip], size=OUTPUT_SIZE))
    
    # Title slam
    title_bg = ColorClip(OUTPUT_SIZE, color=BLACK, duration=0.5)
    title_text = create_text_burst("RADGOTCHI", duration=0.5, fontsize=120, color='lime')
    clips.append(CompositeVideoClip([title_bg, title_text], size=OUTPUT_SIZE))
    
    # === STUTTER on COOL face ===
    print("Adding stutter effects...")
    cool_face = load_image_clip(GOTCHI_DIR / "COOL.png", duration=0.15)
    cool_face = cool_face.resized(0.8).with_position('center')
    cool_bg = ColorClip(OUTPUT_SIZE, color=HOT_PINK, duration=0.15)
    cool_comp = CompositeVideoClip([cool_bg, cool_face], size=OUTPUT_SIZE)
    clips.append(make_stutter_clip(cool_comp, times=4))
    
    # === Text bursts ===
    for text, dur, color, bg_col in [
        ("YOUR NEW", 0.25, 'white', CYBER_BLUE),
        ("DESKTOP", 0.3, 'cyan', BLACK),
    ]:
        bg = ColorClip(OUTPUT_SIZE, color=bg_col, duration=dur)
        txt = create_text_burst(text, duration=dur, fontsize=90, color=color)
        clips.append(CompositeVideoClip([bg, txt], size=OUTPUT_SIZE))
    
    # FRIEND with shake
    friend_face = load_image_clip(GOTCHI_DIR / "FRIEND.png", duration=0.5)
    friend_face = friend_face.resized(0.9).with_position('center')
    friend_face = apply_shake(friend_face, intensity=15)
    friend_bg = ColorClip(OUTPUT_SIZE, color=NEON_GREEN, duration=0.5)
    clips.append(CompositeVideoClip([friend_bg, friend_face], size=OUTPUT_SIZE))
    
    bg = ColorClip(OUTPUT_SIZE, color=BLACK, duration=0.3)
    txt = create_text_burst("FRIEND", duration=0.3, fontsize=110, color='lime')
    clips.append(CompositeVideoClip([bg, txt], size=OUTPUT_SIZE))
    
    # === Demo showcase with glitch ===
    print("Adding demo showcase...")
    if demo_images:
        for img_path in random.sample(demo_images, min(4, len(demo_images))):
            demo_clip = ImageClip(str(img_path), duration=0.35)
            demo_clip = demo_clip.resized(width=OUTPUT_SIZE[0])
            demo_clip = apply_glitch_bars(demo_clip)
            # Center crop to square
            demo_clip = demo_clip.with_position('center')
            bg = ColorClip(OUTPUT_SIZE, color=BLACK, duration=0.35)
            clips.append(CompositeVideoClip([bg, demo_clip], size=OUTPUT_SIZE))
    
    # === Feature callouts ===
    print("Adding feature callouts...")
    features = ["POMODORO", "CHAT", "LEVEL UP", "VIBES", "RAD MESH", "AUDIO MODE"]
    text_colors = ['lime', 'cyan', 'magenta', 'yellow', 'white']
    
    for feature in features:
        # Face flash
        face = random.choice(gotchi_faces)
        face_clip = load_image_clip(face, duration=0.12)
        face_clip = face_clip.resized(0.6).with_position('center')
        face_clip = apply_rgb_shift(face_clip, amount=random.randint(5, 15))
        
        bg_color = random.choice([NEON_GREEN, HOT_PINK, CYBER_BLUE])
        bg = ColorClip(OUTPUT_SIZE, color=bg_color, duration=0.12)
        clips.append(CompositeVideoClip([bg, face_clip], size=OUTPUT_SIZE))
        
        # Text
        bg = ColorClip(OUTPUT_SIZE, color=BLACK, duration=0.18)
        txt = create_text_burst(feature, duration=0.18, fontsize=85, 
                               color=random.choice(text_colors))
        clips.append(CompositeVideoClip([bg, txt], size=OUTPUT_SIZE))
    
    # === Rapid finale ===
    print("Creating finale...")
    for _ in range(12):
        face = random.choice(gotchi_faces)
        clip = load_image_clip(face, duration=0.07)
        scale = 0.7 + random.random() * 0.4
        clip = clip.resized(scale).with_position('center')
        
        if random.random() > 0.3:
            clip = apply_invert(clip)
        if random.random() > 0.5:
            clip = apply_color_boost(clip, random.uniform(1.5, 3.0))
        
        bg = ColorClip(OUTPUT_SIZE, color=(
            random.randint(0, 255),
            random.randint(0, 255),
            random.randint(0, 255)
        ), duration=0.07)
        clips.append(CompositeVideoClip([bg, clip], size=OUTPUT_SIZE))
    
    # Final slam
    final_bg = ColorClip(OUTPUT_SIZE, color=BLACK, duration=0.8)
    final_text = create_text_burst("DOWNLOAD\nNOW", duration=0.8, fontsize=100, color='lime')
    final_comp = CompositeVideoClip([final_bg, final_text], size=OUTPUT_SIZE)
    final_comp = apply_shake(final_comp, intensity=8)
    clips.append(final_comp)
    
    # Outro
    excited = load_image_clip(GOTCHI_DIR / "EXCITED.png", duration=0.6)
    excited = excited.resized(0.85).with_position('center')
    outro_bg = ColorClip(OUTPUT_SIZE, color=NEON_GREEN, duration=0.6)
    clips.append(CompositeVideoClip([outro_bg, excited], size=OUTPUT_SIZE))
    
    # === Concatenate ===
    print("Concatenating clips...")
    final_video = concatenate_videoclips(clips, method="chain")
    
    # Calculate actual content duration and trim
    actual_duration = sum(c.duration for c in clips)
    final_video = final_video.with_duration(actual_duration)
    print(f"Actual content duration: {actual_duration:.2f}s")
    
    # Add chaotic audio
    print("Generating audio...")
    try:
        audio = generate_chaos_audio(actual_duration)
        final_video = final_video.with_audio(audio)
    except Exception as e:
        print(f"Audio generation failed (video will be silent): {e}")
    
    # Export
    output_path = SCRIPT_DIR / "radgotchi-ytp.mp4"
    print(f"Rendering to {output_path}...")
    print(f"Duration: {final_video.duration:.1f}s | Size: {OUTPUT_SIZE}")
    
    final_video.write_videofile(
        str(output_path),
        fps=FPS,
        codec='libx264',
        audio_codec='aac',
        preset='fast',
        threads=4
    )
    
    print("=" * 50)
    print(f"Done! Video saved to: {output_path}")

if __name__ == "__main__":
    main()
