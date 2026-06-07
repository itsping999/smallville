"""Generate a cartoon-style community map as a PNG image using PIL."""
import os, sys, random
from PIL import Image, ImageDraw, ImageFont

random.seed(42)
TILE = 16
SCALE = 2
T = TILE * SCALE
MAP_W, MAP_H = 76, 52
W, H = MAP_W * T, MAP_H * T

GRASS_BASE = (124, 179, 66)
GRASS_DARK = (104, 159, 56)
GRASS_LIGHT = (139, 195, 74)
ROAD = (120, 120, 120)
ROAD_DARK = (100, 100, 100)
SIDEWALK = (200, 192, 184)
LINE_MARK = (200, 200, 200)

BUILDINGS = {
    "house_1":    {"pos": (10,8), "sz": (6,5), "body": (255,204,188), "roof": (191,54,12), "trim": (141,110,99), "lbl": "Chen", "rt": "gable"},
    "house_2":    {"pos": (18,8), "sz": (6,5), "body": (187,222,251), "roof": (21,101,192), "trim": (120,144,156), "lbl": "Williams", "rt": "gable"},
    "house_3":    {"pos": (26,8), "sz": (6,5), "body": (200,230,201), "roof": (51,105,30), "trim": (109,76,65), "lbl": "Henderson", "rt": "hip"},
    "house_4":    {"pos": (34,8), "sz": (6,5), "body": (255,249,196), "roof": (245,127,23), "trim": (161,136,127), "lbl": "Patel", "rt": "gable"},
    "house_5":    {"pos": (42,8), "sz": (6,5), "body": (248,187,208), "roof": (173,20,79), "trim": (141,110,99), "lbl": "Moreno", "rt": "hip"},
    "house_6":    {"pos": (50,8), "sz": (6,5), "body": (209,196,233), "roof": (69,39,160), "trim": (120,144,156), "lbl": "Fisher", "rt": "gable"},
    "apt_101":    {"pos": (55,42), "sz": (5,4), "body": (178,223,219), "roof": (0,105,92), "trim": (84,110,122), "lbl": "Apt 101", "rt": "flat"},
    "apt_102":    {"pos": (61,42), "sz": (5,4), "body": (178,223,219), "roof": (0,105,92), "trim": (84,110,122), "lbl": "Apt 102", "rt": "flat"},
    "sunrise_cafe":    {"pos": (8,22), "sz": (7,5), "body": (255,248,225), "roof": (230,81,0), "trim": (121,85,72), "lbl": "Sunrise Cafe", "rt": "awning"},
    "greenleaf_grocery":{"pos": (18,22), "sz": (7,5), "body": (232,245,233), "roof": (46,125,50), "trim": (85,139,47), "lbl": "Greenleaf Grocery", "rt": "flat"},
    "birch_barrel":    {"pos": (28,22), "sz": (7,5), "body": (239,235,233), "roof": (62,39,35), "trim": (93,64,55), "lbl": "Birch & Barrel", "rt": "gable"},
    "pages_bookstore": {"pos": (38,22), "sz": (6,5), "body": (252,228,236), "roof": (136,14,79), "trim": (109,76,65), "lbl": "Pages Books", "rt": "gable"},
    "corner_pharmacy": {"pos": (47,22), "sz": (5,5), "body": (227,242,253), "roof": (1,87,155), "trim": (69,90,100), "lbl": "Pharmacy", "rt": "flat"},
    "school":           {"pos": (45,30), "sz": (10,7), "body": (255,243,224), "roof": (191,54,12), "trim": (109,76,65), "lbl": "Maplewood Elementary", "rt": "hip", "big": True},
    "community_center": {"pos": (8,13), "sz": (8,6), "body": (232,234,246), "roof": (40,53,147), "trim": (92,107,192), "lbl": "Community Center", "rt": "flat", "big": True},
    "fire_station":    {"pos": (18,13), "sz": (5,6), "body": (255,205,210), "roof": (183,28,28), "trim": (211,47,47), "lbl": "Fire Station", "rt": "flat"},
    "town_hall":       {"pos": (40,42), "sz": (8,6), "body": (236,239,241), "roof": (55,71,79), "trim": (84,110,122), "lbl": "Town Hall", "rt": "column", "big": True},
    "riverside_tech":  {"pos": (10,42), "sz": (8,6), "body": (225,245,254), "roof": (2,119,189), "trim": (79,195,247), "lbl": "Riverside Tech", "rt": "flat", "big": True},
    "medical_center":  {"pos": (30,13), "sz": (7,6), "body": (243,229,245), "roof": (106,27,154), "trim": (171,71,188), "lbl": "Medical Center", "rt": "flat", "big": True},
    "library":         {"pos": (55,13), "sz": (7,6), "body": (255,248,225), "roof": (93,64,55), "trim": (121,85,72), "lbl": "Public Library", "rt": "gable", "big": True},
}

H_ROADS = [(0,7,75,3), (0,18,75,3), (0,26,75,4), (0,40,75,3)]
V_ROADS = [(7,7,2,36), (20,7,2,36), (35,7,2,36), (50,7,2,36), (62,18,2,25)]

def t(v): return v * T

def draw_tree(d, cx, cy, s=1.0):
    d.rectangle([cx-int(2*s), cy+int(4*s), cx+int(2*s), cy+int(14*s)], fill=(109,76,65))
    d.ellipse([cx-int(10*s), cy-int(8*s), cx+int(10*s), cy+int(6*s)], fill=(46,125,50))
    d.ellipse([cx-int(9*s), cy-int(10*s), cx+int(9*s), cy+int(4*s)], fill=(56,142,60))
    d.ellipse([cx-int(5*s), cy-int(10*s), cx+int(3*s), cy-int(2*s)], fill=(102,187,106))

def draw_building(d, bid, b):
    px, py = b["pos"]; sw, sh = b["sz"]
    x, y = t(px), t(py); w, h = t(sw), t(sh)
    body, roof, trim = b["body"], b["roof"], b["trim"]
    big = b.get("big", False)
    d.rectangle([x+4, y+4, x+w+4, y+h+4], fill=(0,0,0,25))
    d.rectangle([x, y, x+w, y+h], fill=body)
    d.rectangle([x, y, x+w, y+h], outline=trim, width=2)
    rt = b["rt"]
    if rt == "gable":
        d.polygon([(x-6, y), (x+w+6, y), (x+w//2, y-20)], fill=roof, outline=trim)
    elif rt == "hip":
        d.polygon([(x-4, y+2), (x+w+4, y+2), (x+w//2, y-18)], fill=roof)
        d.rectangle([x, y-3, x+w, y+3], fill=roof)
    elif rt == "flat":
        d.rectangle([x-3, y-6, x+w+3, y+2], fill=roof, outline=trim)
    elif rt == "awning":
        ax = x - 4
        while ax < x + w + 4:
            c = roof if (ax // 8) % 2 == 0 else (255, 255, 255)
            d.rectangle([ax, y-8, ax+8, y+2], fill=c); ax += 8
    elif rt == "column":
        d.rectangle([x-4, y-8, x+w+4, y+2], fill=roof)
        for cx in range(x+8, x+w-4, 20):
            d.rectangle([cx, y+2, cx+5, y+h], fill=(236,239,241))
    ws = 8 if big else 6; px2 = 12 if big else 8; py2 = 18 if big else 12
    cols = max(1, (w - px2*2) // (ws + 6)); rows = max(1, (h - py2 - 10) // (ws + 6))
    for r in range(rows):
        for c in range(cols):
            wx = x + px2 + c * (ws + 6); wy = y + py2 + r * (ws + 6)
            d.rectangle([wx, wy, wx+ws, wy+ws], fill=(187,222,251), outline=trim, width=1)
            d.line([wx+ws//2, wy, wx+ws//2, wy+ws], fill=trim, width=1)
            d.line([wx, wy+ws//2, wx+ws, wy+ws//2], fill=trim, width=1)
            d.rectangle([wx+1, wy+1, wx+3, wy+3], fill=(255,255,255))
    dw = 10 if big else 8; dh = 16 if big else 12
    dx = x + w//2 - dw//2; dy = y + h - dh - 2
    d.rectangle([dx, dy, dx+dw, dy+dh], fill=trim)
    d.ellipse([dx+dw-3, dy+dh//2-1, dx+dw-1, dy+dh//2+1], fill=(255,213,79))
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14 if big else 11)
    except: font = ImageFont.load_default()
    lw = d.textlength(b["lbl"], font=font)
    lx = x + w//2 - int(lw)//2; ly = y - 24 if rt in ("gable","hip") else y - 14
    d.rectangle([lx-4, ly-2, lx+int(lw)+4, ly+16], fill=(255,255,255))
    d.text((lx, ly), b["lbl"], fill=(55,71,79), font=font)
    if bid == "medical_center":
        cx, cy = x + w//2, y - 16
        d.rectangle([cx-2, cy-8, cx+2, cy+8], fill=(255,0,0))
        d.rectangle([cx-8, cy-2, cx+8, cy+2], fill=(255,0,0))
    if bid == "school":
        fx = x + w - 14
        d.rectangle([fx, y-28, fx+3, y], fill=(121,85,72))
        d.polygon([(fx+3, y-28), (fx+3, y-20), (fx+14, y-24)], fill=(21,101,192))

def generate():
    img = Image.new("RGBA", (W, H), GRASS_BASE)
    d = ImageDraw.Draw(img)
    # Grass texture
    for _ in range(200):
        gx, gy = random.randint(0,W), random.randint(0,H)
        r = random.randint(10,40)
        d.ellipse([gx-r,gy-r,gx+r,gy+r], fill=random.choice([GRASS_DARK, GRASS_LIGHT]))
    # Roads
    for rx,ry,rw,rh in H_ROADS + V_ROADS:
        d.rectangle([t(rx)+2,t(ry)+2,t(rx+rw)+2,t(ry+rh)+2], fill=(0,0,0,20))
        d.rectangle([t(rx),t(ry),t(rx+rw),t(ry+rh)], fill=ROAD)
        d.rectangle([t(rx),t(ry),t(rx+rw),t(ry)+2], fill=ROAD_DARK)
        d.rectangle([t(rx),t(ry+rh)-2,t(rx+rw),t(ry+rh)], fill=ROAD_DARK)
    for rx,ry,rw,rh in H_ROADS:
        cy = t(ry + rh/2)
        for x in range(t(rx), t(rx+rw), 24): d.rectangle([x,cy-1,x+14,cy+1], fill=LINE_MARK)
    for rx,ry,rw,rh in V_ROADS:
        cx = t(rx + rw/2)
        for y in range(t(ry), t(ry+rh), 24): d.rectangle([cx-1,y,cx+1,y+14], fill=LINE_MARK)
    # Sidewalks
    for rx,ry,rw,rh in H_ROADS:
        d.rectangle([t(rx),t(ry-0.4),t(rx+rw),t(ry)], fill=SIDEWALK)
        d.rectangle([t(rx),t(ry+rh),t(rx+rw),t(ry+rh+0.4)], fill=SIDEWALK)
    for rx,ry,rw,rh in V_ROADS:
        d.rectangle([t(rx-0.4),t(ry),t(rx),t(ry+rh)], fill=SIDEWALK)
        d.rectangle([t(rx+rw),t(ry),t(rx+rw+0.4),t(ry+rh)], fill=SIDEWALK)
    # Park
    px,py,pw,ph = t(14),t(0),t(22),t(7)
    d.rectangle([px,py,px+pw,py+ph], fill=(129,199,132))
    for _ in range(20):
        gx,gy = px+random.randint(10,pw-10), py+random.randint(10,ph-10)
        r = random.randint(8,25)
        d.ellipse([gx-r,gy-r,gx+r,gy+r], fill=(165,214,167))
    for i in range(4):
        x1 = px+20+i*50; y1 = py+ph-15 if i%2==0 else py+25
        x2 = px+70+i*50; y2 = py+25 if i%2==0 else py+ph-15
        d.line([(x1,y1),(x2,y2)], fill=(200,192,184), width=6)
    d.ellipse([px+80,py+20,px+140,py+60], fill=(79,195,247))
    d.ellipse([px+90,py+25,px+125,py+50], fill=(129,212,250))
    gx,gy = px+200,py+30
    d.ellipse([gx-22,gy-8,gx+22,gy+22], fill=(93,64,55))
    d.ellipse([gx-16,gy-2,gx+16,gy+16], fill=(141,110,99))
    for bx,by in [(px+40,py+ph-20),(px+160,py+ph-18),(px+240,py+ph-20)]:
        d.rectangle([bx,by,bx+20,by+5], fill=(109,76,65))
        d.rectangle([bx+2,by+5,bx+4,by+10], fill=(109,76,65))
        d.rectangle([bx+16,by+5,bx+18,by+10], fill=(109,76,65))
    for _ in range(18):
        tx, ty = px+random.randint(15,pw-15), py+random.randint(12,ph-20)
        if abs(tx-px-100)<40 and abs(ty-py-40)<25: continue
        if abs(tx-px-200)<30 and abs(ty-py-35)<30: continue
        draw_tree(d, tx, ty, 0.8+random.random()*0.5)
    fc = [(255,82,82),(255,215,64),(255,64,129),(224,64,251),(68,138,255)]
    for _ in range(30):
        fx, fy = px+random.randint(8,pw-8), py+ph-20+random.randint(0,15)
        d.ellipse([fx-2, fy-2, fx+2, fy+2], fill=random.choice(fc))
    try: font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    except: font = ImageFont.load_default()
    d.text((px+pw//2-30, py+6), "Elm Park", fill=(27,94,32), font=font)
    # Buildings
    for bid, binfo in BUILDINGS.items(): draw_building(d, bid, binfo)
    # Decorations
    cc = [(21,101,192),(198,40,40),(46,125,50),(55,71,79),(245,127,23),(69,39,160)]
    for i in range(5):
        cx,cy = t(9+i*11), t(10.8)
        d.rectangle([cx,cy,cx+14,cy+7], fill=cc[i%6])
        d.rectangle([cx+2,cy+1,cx+6,cy+4], fill=(144,202,249))
        d.ellipse([cx+1,cy+6,cx+4,cy+9], fill=(33,33,33))
        d.ellipse([cx+10,cy+6,cx+13,cy+9], fill=(33,33,33))
    for i in range(4):
        cx,cy = t(12+i*15), t(27.5)
        d.rectangle([cx,cy,cx+14,cy+7], fill=cc[(i+3)%6])
        d.rectangle([cx+2,cy+1,cx+6,cy+4], fill=(144,202,249))
        d.ellipse([cx+1,cy+6,cx+4,cy+9], fill=(33,33,33))
        d.ellipse([cx+10,cy+6,cx+13,cy+9], fill=(33,33,33))
    for i in range(6):
        mx,my = t(11+i*8), t(10.2)
        d.rectangle([mx,my,mx+4,my+7], fill=(21,101,192))
        d.rectangle([mx-1,my,mx+5,my+2], fill=(21,101,192))
        d.rectangle([mx+1,my+7,mx+3,my+12], fill=(121,85,72))
    for x in range(5,70,8):
        lx,ly = t(x), t(25)
        d.rectangle([lx,ly,lx+2,ly+16], fill=(117,117,117))
        d.rectangle([lx-3,ly-3,lx+5,ly+1], fill=(66,66,66))
    # Street trees
    for x in range(3,72,4):
        if random.random()>0.2:
            draw_tree(d, t(x), t(6.3), 0.6)
            draw_tree(d, t(x), t(10.6), 0.6)
    for x in range(3,72,5):
        if random.random()>0.3:
            draw_tree(d, t(x), t(25.3), 0.6)
            draw_tree(d, t(x), t(30.5), 0.6)
    # Save
    out = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "assets", "map_bg.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out, "PNG")
    print(f"Saved: {out} ({W}x{H})")

if __name__ == "__main__":
    generate()
