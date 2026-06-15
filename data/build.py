#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""بناء مجموعة بيانات تحليلية للقرآن الكريم من المصادر الخام."""
import json, re, unicodedata, os, glob

ROOT = os.path.dirname(os.path.abspath(__file__))
def p(*a): return os.path.join(ROOT, *a)

# ---------- 1) النص (من الملفات المحمّلة سابقاً) ----------
surahs = []
for n in range(1, 115):
    surahs.append(json.load(open(p("..", "quran", "surahs", f"{n}.json"), encoding="utf-8")))

AR_DIAC = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ࣓-ࣿ]")
TATWEEL = "ـ"
def strip_diacritics(s):
    return AR_DIAC.sub("", s).replace(TATWEEL, "")
def normalize(s):
    s = strip_diacritics(s)
    s = re.sub("[إأآٱ]", "ا", s)
    s = s.replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي").replace("ة", "ه")
    s = re.sub(r"\s+", " ", s).strip()
    return s

# ---------- 2) الصرف (Quranic Corpus) ----------
# الصيغة: surah:ayah:word:seg \t form \t POS \t features(|-separated)
POS_AR = {
 "N":"اسم","PN":"اسم علم","ADJ":"صفة","V":"فعل","P":"حرف جر","PRON":"ضمير",
 "DEM":"اسم إشارة","REL":"اسم موصول","T":"ظرف زمان","LOC":"ظرف مكان","ACC":"حرف نصب",
 "COND":"أداة شرط","CONJ":"حرف عطف","SUB":"حرف مصدري","DET":"أداة تعريف","INTG":"أداة استفهام",
 "NEG":"أداة نفي","EMPH":"لام التوكيد","IMPV":"لام الأمر","PRP":"لام التعليل","VOC":"أداة نداء",
 "RES":"أداة حصر","INL":"حروف مقطعة","CIRC":"واو الحال","FUT":"حرف استقبال","INC":"حرف ابتداء",
 "EXP":"أداة استثناء","AMD":"حرف استدراك","SUR":"أداة فجاءة","CERT":"حرف تحقيق","RET":"حرف إضراب",
 "PREV":"حرف كف","ANS":"حرف جواب","EXH":"حرف تحضيض","INT":"حرف تفسير","SUP":"أداة","PRO":"حرف نهي",
 "ACT":"اسم فاعل","PASS":"اسم مفعول","INTG_":"استفهام",
}
morph = {}   # (s,a) -> list of words; each word -> list of segments
for line in open(p("_raw", "morphology.txt"), encoding="utf-8"):
    line = line.rstrip("\n")
    if not line or line.startswith("#") or ":" not in line.split("\t")[0]:
        continue
    parts = line.split("\t")
    if len(parts) < 3:
        continue
    loc, form, pos = parts[0], parts[1], parts[2]
    feats = parts[3] if len(parts) > 3 else ""
    try:
        s, a, w, seg = map(int, loc.split(":"))
    except ValueError:
        continue
    fdict = {}
    root = lemma = None
    flags = []
    for f in feats.split("|"):
        if f.startswith("ROOT:"): root = f[5:]
        elif f.startswith("LEM:"): lemma = f[4:]
        elif ":" in f:
            k, v = f.split(":", 1); fdict[k] = v
        else: flags.append(f)
    seg_obj = {"form": form, "pos": pos, "pos_ar": POS_AR.get(pos, pos),
               "root": root, "lemma": lemma, "features": flags, "tags": fdict}
    key = (s, a)
    morph.setdefault(key, {})
    morph[key].setdefault(w, []).append(seg_obj)

# ---------- 3) الميتاداتا (fawazahmed0 info.json) ----------
info = json.load(open(p("_raw", "info.json"), encoding="utf-8"))
ayah_meta = {}   # (s,a) -> {juz,page,manzil,...}
for ch in info["chapters"]:
    s = ch["chapter"]
    for v in ch["verses"]:
        ayah_meta[(s, v["verse"])] = {k: v[k] for k in v if k != "verse"}
sajda_set = {(r["chapter"], r["verse"]): r for r in info["sajdas"]["references"]}
chapters_meta = {ch["chapter"]: {
    "name_en": ch.get("englishname"), "name_ar": ch.get("arabicname"),
    "revelation": ch.get("revelation")} for ch in info["chapters"]}

# ترتيب النزول من surah_meta إن توفّر
surah_extra = {}
try:
    sm = json.load(open(p("_raw", "surah_meta.json"), encoding="utf-8"))
    for i, o in enumerate(sm, 1):
        surah_extra[i] = {"place": o.get("place"), "type": o.get("type"), "pages": o.get("pages")}
except Exception:
    pass

# ---------- 4) التفسير الميسّر ----------
tafsir = {}
for n in range(1, 115):
    for it in json.load(open(p("..", "quran", "tafsir_muyassar", f"{n}.json"), encoding="utf-8")):
        a = it.get("ayah")
        if isinstance(a, int) and a >= 1:
            tafsir[(n, a)] = it.get("text", "").strip()

# ---------- بناء الملفات المُخرجة ----------
os.makedirs(p("..", "data", "out"), exist_ok=True) if False else None
TYPE_AR = {"meccan": "مكية", "medinan": "مدنية"}

# (أ) النص: عثماني + مجرّد + مطبّع
text_out = {"description": "نص القرآن: عثماني، ومجرّد من التشكيل، ومطبّع للبحث",
            "total_verses": 6236, "surahs": []}
roots_index = {}   # root -> [ "s:a:w", ... ]
master = {"description": "القرآن الكريم — مجموعة بيانات تحليلية شاملة",
          "layers": ["text", "metadata", "morphology", "tafsir_muyassar"],
          "total_surahs": 114, "total_verses": 6236, "surahs": []}

for s in surahs:
    sid = s["id"]
    sx = surah_extra.get(sid, {})
    cm = chapters_meta.get(sid, {})
    surah_block_text = {"id": sid, "name": s["name"], "transliteration": s["transliteration"],
                        "type": TYPE_AR.get(s["type"], s["type"]), "verses": []}
    surah_block_master = {"id": sid, "name": s["name"], "transliteration": s["transliteration"],
                          "type": TYPE_AR.get(s["type"], s["type"]),
                          "name_en": cm.get("name_en"), "revelation_place": cm.get("revelation"),
                          "total_verses": s["total_verses"], "verses": []}
    for v in s["verses"]:
        a = v["id"]; uth = v["text"]
        plain = strip_diacritics(uth); norm = normalize(uth)
        surah_block_text["verses"].append({"id": a, "uthmani": uth, "plain": plain, "normalized": norm})
        # morphology words
        words = []
        wm = morph.get((sid, a), {})
        for wi in sorted(wm):
            segs = wm[wi]
            for seg in segs:
                if seg["root"]:
                    roots_index.setdefault(seg["root"], []).append(f"{sid}:{a}:{wi}")
            words.append({"n": wi, "segments": segs})
        md = ayah_meta.get((sid, a), {})
        vobj = {"id": a, "uthmani": uth, "plain": plain, "normalized": norm,
                "juz": md.get("juz"), "page": md.get("page"), "manzil": md.get("manzil"),
                "line": md.get("line"),
                "sajda": True if (sid, a) in sajda_set else False,
                "tafsir_muyassar": tafsir.get((sid, a)),
                "morphology": words}
        surah_block_master["verses"].append(vobj)
    text_out["surahs"].append(surah_block_text)
    master["surahs"].append(surah_block_master)

# روابط الجذور: ترتيب + إحصاء
roots_sorted = {r: {"count": len(locs), "occurrences": locs}
                for r, locs in sorted(roots_index.items(), key=lambda x: -len(x[1]))}

json.dump(text_out, open(p("..", "data", "text.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"description": "فهرس جذور الكلمات وموضع كل ورود (سورة:آية:كلمة)",
           "total_roots": len(roots_sorted), "roots": roots_sorted},
          open(p("..", "data", "roots_index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"description": "البيانات الوصفية للسور والآيات",
           "sajdas": info["sajdas"]["references"],
           "juz_count": info["juzs"]["count"] if isinstance(info.get("juzs"), dict) else None,
           "pages_count": info["pages"]["count"] if isinstance(info.get("pages"), dict) else None,
           "chapters": chapters_meta, "surah_extra": surah_extra},
          open(p("..", "data", "metadata.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"description": "التفسير الميسّر لكل آية", "edition": "التفسير الميسّر",
           "verses": {f"{s}:{a}": t for (s, a), t in sorted(tafsir.items())}},
          open(p("..", "data", "tafsir_muyassar.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(master, open(p("..", "data", "quran_full.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# تقرير
print("text.json verses:", sum(len(x["verses"]) for x in text_out["surahs"]))
print("roots:", len(roots_sorted), "| sample top:", list(roots_sorted.items())[0][0], list(roots_sorted.items())[0][1]["count"])
print("tafsir verses:", len(tafsir))
print("morphology ayat covered:", len(morph))
for f in ["text.json","roots_index.json","metadata.json","tafsir_muyassar.json","quran_full.json"]:
    print(f, os.path.getsize(p("..","data",f)), "bytes")
