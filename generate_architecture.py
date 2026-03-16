from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1600, 1000
BG = (10, 10, 10)

# Colors
GREEN  = (74, 222, 128)
WHITE  = (255, 255, 255)
GRAY   = (55, 65, 81)
GRAY_L = (156, 163, 175)
RED    = (248, 113, 113)
ORANGE = (249, 115, 22)
BLUE   = (59, 130, 246)
CYAN   = (34, 211, 238)
DARK   = (20, 20, 20)

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img, "RGBA")

# ── Font helpers ──────────────────────────────────────────────────────────────
def font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/consola.ttf",
        "C:/Windows/Fonts/cour.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

fnt_title  = font(28, bold=True)
fnt_head   = font(18, bold=True)
fnt_sub    = font(14)
fnt_small  = font(12)
fnt_footer = font(13)

# ── Drawing helpers ────────────────────────────────────────────────────────────
def glow_rect(draw, xy, color, radius=10, glow_width=6):
    """Draw a glowing rounded-rectangle border."""
    x0, y0, x1, y1 = xy
    # Glow layers (transparent-ish)
    for i in range(glow_width, 0, -1):
        alpha = int(60 * (1 - i / glow_width))
        expanded = (x0 - i, y0 - i, x1 + i, y1 + i)
        draw.rounded_rectangle(expanded, radius=radius + i,
                               outline=color + (alpha,), width=1)
    # Solid border
    draw.rounded_rectangle(xy, radius=radius,
                           fill=DARK + (255,), outline=color + (220,), width=2)

def centered_text(draw, cx, cy, text, fnt, color=WHITE):
    bb = draw.textbbox((0, 0), text, font=fnt)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    draw.text((cx - tw // 2, cy - th // 2), text, font=fnt, fill=color)

def arrow_down(draw, cx, y_top, y_bot, color=GREEN, width=3):
    """Draw a downward arrow from y_top to y_bot at x=cx."""
    draw.line([(cx, y_top), (cx, y_bot - 10)], fill=color, width=width)
    # Arrowhead
    aw = 10
    draw.polygon([(cx - aw, y_bot - 10), (cx + aw, y_bot - 10), (cx, y_bot)],
                 fill=color)

def arrow_side(draw, x_left, y_mid, x_right, color=GREEN, width=2):
    """Horizontal arrow from x_left to x_right at y_mid."""
    draw.line([(x_left, y_mid), (x_right - 8, y_mid)], fill=color, width=width)
    aw = 8
    draw.polygon([(x_right - aw, y_mid - aw // 2),
                  (x_right - aw, y_mid + aw // 2),
                  (x_right, y_mid)], fill=color)

# ─────────────────────────────────────────────────────────────────────────────
# TITLE
# ─────────────────────────────────────────────────────────────────────────────
title_text = "ResilienceOS — System Architecture"
bb = draw.textbbox((0, 0), title_text, font=fnt_title)
tw = bb[2] - bb[0]
draw.text(((W - tw) // 2, 22), title_text, font=fnt_title, fill=GREEN)

# Thin separator line
draw.line([(80, 62), (W - 80, 62)], fill=(*GREEN, 80), width=1)

# ─────────────────────────────────────────────────────────────────────────────
# Layer 1 – USERS  (y ~75..145)
# ─────────────────────────────────────────────────────────────────────────────
L1_y0, L1_y1 = 75, 148
glow_rect(draw, (60, L1_y0, W - 60, L1_y1), GREEN)
centered_text(draw, W // 2, L1_y0 + 16, "USERS", fnt_head, GREEN)
centered_text(draw, W // 2, L1_y0 + 45,
              "  Citizens           Gov IT Team          NOC Operators  ",
              fnt_sub, GRAY_L)

# ─────────────────────────────────────────────────────────────────────────────
# Arrow 1→2
# ─────────────────────────────────────────────────────────────────────────────
arrow_down(draw, W // 2, L1_y1, L1_y1 + 35)

# ─────────────────────────────────────────────────────────────────────────────
# Layer 2 – FRONTEND  (y ~183..270)
# ─────────────────────────────────────────────────────────────────────────────
L2_y0, L2_y1 = L1_y1 + 35, L1_y1 + 35 + 88
glow_rect(draw, (60, L2_y0, W - 60, L2_y1), GREEN)
centered_text(draw, W // 2, L2_y0 + 16, "FRONTEND  (Next.js 14)", fnt_head, GREEN)
centered_text(draw, W // 2, L2_y0 + 42,
              "Landing Page  |  Dashboard  |  Features  |  Login  |  Pricing",
              fnt_sub, WHITE)
centered_text(draw, W // 2, L2_y0 + 64,
              "TypeScript  ·  Tailwind CSS  ·  App Router",
              fnt_small, GRAY_L)

# ─────────────────────────────────────────────────────────────────────────────
# Arrow 2→3
# ─────────────────────────────────────────────────────────────────────────────
arrow_down(draw, W // 2, L2_y1, L2_y1 + 35)

# ─────────────────────────────────────────────────────────────────────────────
# Layer 3 – API LAYER  (y ~338..415)
# ─────────────────────────────────────────────────────────────────────────────
L3_y0, L3_y1 = L2_y1 + 35, L2_y1 + 35 + 80
glow_rect(draw, (60, L3_y0, W - 60, L3_y1), GREEN)
centered_text(draw, W // 2, L3_y0 + 16, "API LAYER  (Route Handlers)", fnt_head, GREEN)
centered_text(draw, W // 2, L3_y0 + 45,
              "/api/health-check     /api/chaos     /api/ai-analyse     /api/auth",
              fnt_sub, WHITE)

# ─────────────────────────────────────────────────────────────────────────────
# Three arrows down to service boxes
# ─────────────────────────────────────────────────────────────────────────────
BOX_Y0 = L3_y1 + 38
BOX_Y1 = BOX_Y0 + 148

# x centres for the three boxes
CX1 = 260    # Supabase
CX2 = W // 2 # Groq
CX3 = W - 260 # Google OAuth

BW = 340   # box width
BH = BOX_Y1 - BOX_Y0

def box_x(cx): return cx - BW // 2, cx + BW // 2

# Arrow fork: vertical down from API centre, then split
fork_y = L3_y1 + 18
draw.line([(W // 2, L3_y1), (W // 2, fork_y)], fill=GREEN, width=3)
draw.line([(CX1, fork_y), (CX3, fork_y)], fill=GREEN, width=2)
for cx in [CX1, CX2, CX3]:
    arrow_down(draw, cx, fork_y, BOX_Y0, width=2)

# ── Supabase box ──────────────────────────────────────────────────────────────
sx0, sx1 = box_x(CX1)
glow_rect(draw, (sx0, BOX_Y0, sx1, BOX_Y1), CYAN)
centered_text(draw, CX1, BOX_Y0 + 18, "SUPABASE", fnt_head, CYAN)
centered_text(draw, CX1, BOX_Y0 + 48, "PostgreSQL", fnt_sub, WHITE)
centered_text(draw, CX1, BOX_Y0 + 72, "Realtime WebSocket", fnt_sub, WHITE)
centered_text(draw, CX1, BOX_Y0 + 96, "Auth", fnt_sub, GRAY_L)

# ── Groq API box ─────────────────────────────────────────────────────────────
gx0, gx1 = box_x(CX2)
glow_rect(draw, (gx0, BOX_Y0, gx1, BOX_Y1), ORANGE)
centered_text(draw, CX2, BOX_Y0 + 18, "GROQ API", fnt_head, ORANGE)
centered_text(draw, CX2, BOX_Y0 + 48, "llama-3.3-70b", fnt_sub, WHITE)
centered_text(draw, CX2, BOX_Y0 + 72, "AI Analysis", fnt_sub, WHITE)

# ── Google OAuth box ──────────────────────────────────────────────────────────
ox0, ox1 = box_x(CX3)
glow_rect(draw, (ox0, BOX_Y0, ox1, BOX_Y1), BLUE)
centered_text(draw, CX3, BOX_Y0 + 18, "GOOGLE OAUTH", fnt_head, BLUE)
centered_text(draw, CX3, BOX_Y0 + 48, "Auth 2.0 PKCE", fnt_sub, WHITE)
centered_text(draw, CX3, BOX_Y0 + 72, "Session Mgmt", fnt_sub, WHITE)

# ─────────────────────────────────────────────────────────────────────────────
# Arrow Supabase → Monitored Services
# ─────────────────────────────────────────────────────────────────────────────
MS_Y0 = BOX_Y1 + 38
MS_Y1 = MS_Y0 + 120

# Arrow from Supabase down, then across to full-width box
arrow_down(draw, CX1, BOX_Y1, BOX_Y1 + 18, width=2)
draw.line([(CX1, BOX_Y1 + 18), (W // 2, BOX_Y1 + 18)], fill=(*CYAN, 120), width=2)
arrow_down(draw, W // 2, BOX_Y1 + 18, MS_Y0, width=3)

# ─────────────────────────────────────────────────────────────────────────────
# Layer 5 – MONITORED SERVICES
# ─────────────────────────────────────────────────────────────────────────────
glow_rect(draw, (60, MS_Y0, W - 60, MS_Y1), RED)
centered_text(draw, W // 2, MS_Y0 + 16, "MONITORED SERVICES  (8 portals)", fnt_head, RED)
centered_text(draw, W // 2, MS_Y0 + 48,
              "EPFO  ·  GST  ·  CoWIN  ·  DigiLocker  ·  Income Tax  ·  Passport  ·  Ration Card  ·  UMANG",
              fnt_sub, WHITE)
centered_text(draw, W // 2, MS_Y0 + 80,
              "5 Regions:  IN-N  ·  IN-S  ·  IN-E  ·  IN-W  ·  IN-C",
              fnt_small, GRAY_L)

# ─────────────────────────────────────────────────────────────────────────────
# Footer
# ─────────────────────────────────────────────────────────────────────────────
footer = "Next.js 14  ·  Supabase  ·  Groq AI  ·  Google OAuth  ·  TypeScript"
draw.line([(80, H - 42), (W - 80, H - 42)], fill=(*GREEN, 60), width=1)
bb = draw.textbbox((0, 0), footer, font=fnt_footer)
tw = bb[2] - bb[0]
draw.text(((W - tw) // 2, H - 30), footer, font=fnt_footer, fill=GRAY_L)

# ─────────────────────────────────────────────────────────────────────────────
# Save
# ─────────────────────────────────────────────────────────────────────────────
out_path = "D:/govdash/public/architecture.png"
img.save(out_path, "PNG")
size = os.path.getsize(out_path)
print(f"Saved: {out_path}  ({size:,} bytes)")
