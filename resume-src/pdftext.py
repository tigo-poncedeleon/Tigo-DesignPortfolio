#!/usr/bin/env python3
"""Minimal PDF text extractor: what a resume parser sees.
Parses xref-free (brute force object scan), inflates streams, reads
ToUnicode CMaps, and replays Tj/TJ/'/" with Td/TD/Tm/T* positioning.
Emits text in content-stream (paint) order, with line breaks."""
import re, sys, zlib

data = open(sys.argv[1], 'rb').read()

# ---- collect all indirect objects by brute force -------------------------
objs = {}
for m in re.finditer(rb'(\d+)\s+(\d+)\s+obj\b', data):
    num = int(m.group(1))
    start = m.end()
    e = data.find(b'endobj', start)
    objs[num] = data[start:e if e != -1 else len(data)]

def stream_bytes(body):
    i = body.find(b'stream')
    if i == -1: return None
    j = i + 6
    if body[j:j+2] == b'\r\n': j += 2
    elif body[j:j+1] in (b'\n', b'\r'): j += 1
    k = body.find(b'endstream', j)
    raw = body[j:k]
    if b'FlateDecode' in body[:i]:
        try: raw = zlib.decompress(raw)
        except Exception:
            try: raw = zlib.decompressobj().decompress(raw)
            except Exception: return None
    return raw

# ---- ToUnicode CMaps: font resource name -> {code: unicode} --------------
cmaps = {}   # object number -> mapping
for num, body in objs.items():
    s = stream_bytes(body)
    if not s: continue
    if b'beginbfchar' not in s and b'beginbfrange' not in s: continue
    mp = {}
    csr = 1
    import re as _re
    m2 = _re.search(rb'begincodespacerange\s*<([0-9A-Fa-f]+)>', s)
    if m2: csr = len(m2.group(1)) // 2
    for blk in re.findall(rb'beginbfchar(.*?)endbfchar', s, re.S):
        for a, b in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', blk):
            mp[int(a, 16)] = ''.join(chr(int(b[i:i+4], 16)) for i in range(0, len(b), 4))
    for blk in re.findall(rb'beginbfrange(.*?)endbfrange', s, re.S):
        for a, b, c in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', blk):
            lo, hi, dst = int(a, 16), int(b, 16), int(c, 16)
            for k in range(lo, min(hi, lo + 512) + 1):
                mp[k] = chr(dst + (k - lo))
    if mp: cmaps[num] = (mp, csr)

# ---- font resource names -> cmap ----------------------------------------
fontmap = {}
for num, body in objs.items():
    if b'/Type' in body and b'/Font' in body:
        t = re.search(rb'/ToUnicode\s+(\d+)\s+\d+\s+R', body)
        if t and int(t.group(1)) in cmaps:
            fontmap[num] = cmaps[int(t.group(1))]
res = {}
for num, body in objs.items():
    for name, ref in re.findall(rb'/(F\d+|[A-Za-z0-9#_+.-]+)\s+(\d+)\s+0\s+R', body):
        if int(ref) in fontmap: res[name.decode('latin-1')] = fontmap[int(ref)]

# ---- content streams (page order) ---------------------------------------
pages = []
for m in re.finditer(rb'/Type\s*/Page[^s]', data):
    seg = data[max(0, m.start()-1200):m.start()+1200]
    c = re.search(rb'/Contents\s+(\d+)\s+0\s+R', seg)
    if c: pages.append(int(c.group(1)))
if not pages:
    pages = [n for n, b in objs.items() if stream_bytes(b) and b'BT' in (stream_bytes(b) or b'')]

TOKEN = re.compile(rb'(\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>|/[^\s/\[\]<>()]+|[-+]?[\d.]+|\[|\]|[A-Za-z\'"*]+)')

def unescape(s):
    out, i = bytearray(), 0
    while i < len(s):
        ch = s[i]
        if ch == 0x5c:
            i += 1
            nxt = s[i]
            mapping = {0x6e: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12}
            if nxt in mapping: out.append(mapping[nxt])
            elif 0x30 <= nxt <= 0x37:
                oct_ = bytes(s[i:i+3]); out.append(int(oct_, 8) & 0xFF); i += 2
            else: out.append(nxt)
        else: out.append(ch)
        i += 1
    return bytes(out)

def decode(raw, cmap, hexmode):
    if cmap:
        mp, w = cmap
        codes = [int.from_bytes(raw[i:i+w], 'big') for i in range(0, len(raw) - w + 1, w)]
        return ''.join(mp.get(c, '\ufffd') for c in codes)
    return raw.decode('latin-1')

for pnum, pref in enumerate(pages, 1):
    body = objs.get(pref)
    s = stream_bytes(body) if body else None
    if not s: continue
    toks = [t.group(1) for t in TOKEN.finditer(s)]
    stack, cur, lasty, out, cmap = [], [], None, [], None
    ty = 0.0
    def flush():
        global cur
        if cur:
            out.append(''.join(cur)); cur = []
    for i, t in enumerate(toks):
        if t == b'Tf':
            name = None
            for back in (stack[-2:] if len(stack) >= 2 else stack):
                if back.startswith(b'/'): name = back[1:].decode('latin-1')
            cmap = res.get(name) if name else None
        elif t in (b'Td', b'TD'):
            if len(stack) >= 2:
                try: y = float(stack[-1])
                except ValueError: y = 0.0
                ty += y
                if abs(y) > 0.5: flush()
        elif t == b'Tm':
            if len(stack) >= 6:
                try: y = float(stack[-1])
                except ValueError: y = 0.0
                if lasty is None or abs(y - lasty) > 0.5: flush()
                lasty = y
        elif t == b'T*':
            flush()
        elif t in (b'Tj', b"'", b'"'):
            if stack and (stack[-1].startswith(b'(') or stack[-1].startswith(b'<')):
                raw = stack[-1]
                if raw.startswith(b'('): cur.append(decode(unescape(raw[1:-1]), cmap, False))
                else: cur.append(decode(bytes.fromhex(re.sub(rb'\s', b'', raw[1:-1]).decode()), cmap, True))
        elif t == b'TJ':
            j = len(stack) - 1
            depth, items = 0, []
            while j >= 0:
                if stack[j] == b']': depth += 1
                elif stack[j] == b'[':
                    depth -= 1
                    if depth == 0: break
                items.append(stack[j]); j -= 1
            for it in reversed(items):
                if it.startswith(b'('): cur.append(decode(unescape(it[1:-1]), cmap, False))
                elif it.startswith(b'<'):
                    try: cur.append(decode(bytes.fromhex(re.sub(rb'\s', b'', it[1:-1]).decode()), cmap, True))
                    except Exception: pass
                else:
                    try:
                        if float(it) < -120: cur.append(' ')
                    except ValueError: pass
        stack.append(t)
    flush()
    print(f'===== page {pnum} =====')
    for line in out:
        line = line.rstrip()
        if line.strip(): print(line)
