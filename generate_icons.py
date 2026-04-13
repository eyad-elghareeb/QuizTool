"""
Generate PWA icons from favicon.svg using Pillow only (no Cairo dependency)
Requires: pip install pillow
"""
import os
import sys
import re
from PIL import Image, ImageDraw

SIZES = [
    (192, 192, 'icon-192.png'),
    (512, 512, 'icon-512.png'),
    (144, 144, 'icon-144.png'),
    (96, 96, 'icon-96.png'),
    (72, 72, 'icon-72.png'),
    (48, 48, 'icon-48.png'),
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
SVG_PATH = os.path.join(ROOT_DIR, 'favicon.svg')

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def generate_icons():
    if not os.path.exists(SVG_PATH):
        print(f'Error: favicon.svg not found at: {SVG_PATH}')
        sys.exit(1)
    
    print('Generating PWA icons from favicon.svg...')
    
    # Parse SVG to extract colors and shapes
    with open(SVG_PATH, 'r') as f:
        svg_content = f.read()
    
    # Extract viewBox or use default 100x100
    viewBox_match = re.search(r'viewBox="([^"]+)"', svg_content)
    if viewBox_match:
        viewBox = list(map(float, viewBox_match.group(1).split()))
        svg_width, svg_height = viewBox[2], viewBox[3]
    else:
        width_match = re.search(r'width="([^"]+)"', svg_content)
        height_match = re.search(r'height="([^"]+)"', svg_content)
        svg_width = float(width_match.group(1)) if width_match else 100
        svg_height = float(height_match.group(1)) if height_match else 100
    
    # Extract colors from SVG
    fill_matches = re.findall(r'fill="([^"]+)"', svg_content)
    stroke_matches = re.findall(r'stroke="([^"]+)"', svg_content)
    
    # Parse the specific SVG structure we know
    # <rect width="100" height="100" rx="22" fill="#0d1117"/>
    # <circle cx="50" cy="50" r="28" fill="none" stroke="#f0a500" stroke-width="3.5"/>
    # <rect x="44" y="32" width="12" height="36" rx="2" fill="#f0a500"/>
    # <rect x="32" y="44" width="36" height="12" rx="2" fill="#f0a500"/>
    
    bg_color = '#0d1117'
    accent_color = '#f0a500'
    
    for width, height, filename in SIZES:
        # Create image with background
        img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Scale factor (SVG is 100x100)
        scale = width / 100.0
        
        # Draw background rounded rectangle
        bg_rgb = hex_to_rgb(bg_color)
        corner_radius = 22 * scale
        draw.rounded_rectangle(
            [0, 0, width - 1, height - 1],
            radius=corner_radius,
            fill=bg_rgb
        )
        
        # Draw circle (clock face)
        circle_cx = 50 * scale
        circle_cy = 50 * scale
        circle_r = 28 * scale
        stroke_width = 3.5 * scale
        accent_rgb = hex_to_rgb(accent_color)
        
        # Draw circle outline
        draw.ellipse(
            [circle_cx - circle_r, circle_cy - circle_r,
             circle_cx + circle_r, circle_cy + circle_r],
            outline=accent_rgb,
            width=int(stroke_width)
        )
        
        # Draw vertical line (12 o'clock)
        v_rect_x1 = 44 * scale
        v_rect_y1 = 32 * scale
        v_rect_x2 = v_rect_x1 + 12 * scale
        v_rect_y2 = v_rect_y1 + 36 * scale
        v_radius = 2 * scale
        
        draw.rounded_rectangle(
            [v_rect_x1, v_rect_y1, v_rect_x2, v_rect_y2],
            radius=v_radius,
            fill=accent_rgb
        )
        
        # Draw horizontal line (3 o'clock)
        h_rect_x1 = 32 * scale
        h_rect_y1 = 44 * scale
        h_rect_x2 = h_rect_x1 + 36 * scale
        h_rect_y2 = h_rect_y1 + 12 * scale
        h_radius = 2 * scale
        
        draw.rounded_rectangle(
            [h_rect_x1, h_rect_y1, h_rect_x2, h_rect_y2],
            radius=h_radius,
            fill=accent_rgb
        )
        
        # Convert to RGB (remove alpha) and save
        img_rgb = img.convert('RGB')
        output_path = os.path.join(ROOT_DIR, filename)
        img_rgb.save(output_path, 'PNG', quality=95)
        print(f'✓ Generated {filename} ({width}x{height})')
    
    print('\nAll icons generated successfully!')

if __name__ == '__main__':
    generate_icons()
