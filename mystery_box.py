import math, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1600, 1200
random.seed(7)

# ---------- background: radial dark-purple -> deep blue ----------
bg = Image.new("RGB", (W, H))
px = bg.load()
cx, cy = W/2, H*0.46
maxd = math.hypot(W/2, H/2)
for y in range(H):
    for x in range(0, W, 1):
        d = math.hypot(x-cx, y-cy)/maxd
        t = min(1, d)
        r = int(70*(1-t) + 8*t)
        g = int(30*(1-t) + 6*t)
        b = int(95*(1-t) + 22*t)
        px[x, y] = (r, g, b)

draw = ImageDraw.Draw(bg, "RGBA")

# ---------- light beams from behind the box ----------
beams = Image.new("RGBA", (W, H), (0,0,0,0))
bd = ImageDraw.Draw(beams)
for i in range(14):
    ang = math.radians(i*(360/14) + 8)
    x2 = cx + math.cos(ang)*1500
    y2 = cy + math.sin(ang)*1500
    bd.polygon([(cx, cy),
                (cx+math.cos(ang-0.035)*1500, cy+math.sin(ang-0.035)*1500),
                (x2, y2)], fill=(255, 220, 130, 26))
beams = beams.filter(ImageFilter.GaussianBlur(6))
bg = Image.alpha_composite(bg.convert("RGBA"), beams)
draw = ImageDraw.Draw(bg, "RGBA")

# ---------- glow halo behind box ----------
halo = Image.new("RGBA", (W, H), (0,0,0,0))
hd = ImageDraw.Draw(halo)
hd.ellipse([cx-360, cy-360, cx+360, cy+360], fill=(255, 200, 90, 120))
halo = halo.filter(ImageFilter.GaussianBlur(120))
bg = Image.alpha_composite(bg, halo)
draw = ImageDraw.Draw(bg, "RGBA")

# ---------- isometric box (cube) ----------
s = 250                      # half-width
top = cy - 140               # box vertical anchor
# colors
gold      = (255, 196, 70)
gold_dk   = (210, 150, 40)
gold_dkr  = (170, 115, 28)
lid_top   = (255, 215, 110)

# points
A = (cx, top - s*0.55)            # top apex
B = (cx + s, top)                 # right
C = (cx, top + s*0.55)            # bottom of top face
D = (cx - s, top)                 # left
# lower body
bot = top + s*1.0
Bl = (cx + s, bot)
Cl = (cx, bot + s*0.55)
Dl = (cx - s, bot)

# left face
draw.polygon([D, C, Cl, Dl], fill=gold_dkr)
# right face
draw.polygon([B, C, Cl, Bl], fill=gold_dk)
# top lid face
draw.polygon([A, B, C, D], fill=lid_top)

# ribbon vertical on front faces
draw.polygon([( (D[0]+C[0])/2, (D[1]+C[1])/2 ),
              ( (D[0]+C[0])/2+0, Cl[1]-(C[1]-Dl[1]) ),
              ], fill=None)
# simpler ribbon: vertical band down the center edge C->Cl
rw = 34
draw.polygon([(C[0]-rw, C[1]), (C[0], C[1]-6), (Cl[0], Cl[1]-6), (Cl[0]-rw, Cl[1])], fill=(255,90,120,255))
draw.polygon([(C[0]+rw, C[1]), (C[0], C[1]-6), (Cl[0], Cl[1]-6), (Cl[0]+rw, Cl[1])], fill=(225,60,95,255))
# ribbon on lid
draw.polygon([(A[0]-rw,(A[1]+C[1])/2),(A[0],A[1]+10),(A[0]+rw,(A[1]+C[1])/2),(C[0],C[1]-4)], fill=(255,90,120,255))

# ---------- big question mark on lid ----------
def load_font(size):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]:
        try: return ImageFont.truetype(p, size)
        except: pass
    return ImageFont.load_default()

qfont = load_font(190)
qlayer = Image.new("RGBA", (W, H), (0,0,0,0))
qd = ImageDraw.Draw(qlayer)
tb = qd.textbbox((0,0), "?", font=qfont)
qw, qh = tb[2]-tb[0], tb[3]-tb[1]
qx, qy = cx-qw/2-tb[0], top - qh/2 - tb[1] + 4
qd.text((qx, qy), "?", font=qfont, fill=(90, 40, 120, 255))
qglow = qlayer.filter(ImageFilter.GaussianBlur(2))
bg = Image.alpha_composite(bg, qglow)
draw = ImageDraw.Draw(bg, "RGBA")

# ---------- sparkles ----------
def star(d, x, y, r, col):
    d.polygon([(x, y-r),(x+r*0.25,y-r*0.25),(x+r,y),(x+r*0.25,y+r*0.25),
               (x,y+r),(x-r*0.25,y+r*0.25),(x-r,y),(x-r*0.25,y-r*0.25)], fill=col)

spk = Image.new("RGBA",(W,H),(0,0,0,0))
sd = ImageDraw.Draw(spk)
for _ in range(40):
    x = random.randint(80, W-80); y = random.randint(60, H-260)
    r = random.choice([6,9,12,16])
    a = random.randint(120,255)
    star(sd, x, y, r, (255,255,235,a))
spk = spk.filter(ImageFilter.GaussianBlur(0.6))
bg = Image.alpha_composite(bg, spk)
draw = ImageDraw.Draw(bg, "RGBA")

# ---------- text ----------
tf = load_font(96)
sf = load_font(44)
title = "MYSTERY BOX"
tw = draw.textbbox((0,0), title, font=tf); twpx = tw[2]-tw[0]
ty = H-235
# shadow + glow
draw.text((cx-twpx/2+3, ty+3), title, font=tf, fill=(0,0,0,150))
draw.text((cx-twpx/2, ty), title, font=tf, fill=(255,220,120,255))
sub = "Et si vous l'ouvriez ?"
sw = draw.textbbox((0,0), sub, font=sf); swpx = sw[2]-sw[0]
draw.text((cx-swpx/2, ty+120), sub, font=sf, fill=(235,225,245,235))

bg.convert("RGB").save("/home/user/qzdsq/mystery_box.jpg", "JPEG", quality=92)
print("saved", bg.size)
