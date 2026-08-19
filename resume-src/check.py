#!/usr/bin/env python3
"""Read a rendered resume PDF back the way a scanner does."""
import re, sys

path   = sys.argv[1]
expect = sys.argv[2] if len(sys.argv) > 2 else 'text'   # 'text' | 'drawn'
d = open(path, 'rb').read()

pages = len(re.findall(rb'/Type\s*/Page[^s]', d))
subs  = sorted(set(x.decode() for x in re.findall(rb'/Subtype\s*/(Type3|TrueType|Type0|Type1)', d)))
names = sorted(set(x.decode().split('+')[-1] for x in re.findall(rb'/FontName\s*/([A-Za-z0-9+._-]+)', d)))
links = len(re.findall(rb'/Subtype\s*/Link', d))
title = re.search(rb'/Title\s*\(((?:\\.|[^\\()])*)\)', d)
fails = []

if pages != 1:
    fails.append(f'{pages} pages — one page is a hard constraint')

if expect == 'text':
    if 'Type3' in subs:
        fails.append('Type3 font — glyphs are drawn, there is no text to extract')
    if not any('Inter' in n for n in names):
        fails.append(f'Inter did not load, fell back to {", ".join(names) or "nothing"}')
else:
    if 'Type3' not in subs:
        fails.append(f'expected SF Pro (Type3), got {", ".join(names)}')

print(f'  {path}')
print(f'    pages    {pages}')
print(f'    fonts    {", ".join(subs)} / {", ".join(names)}')
print(f'    links    {links}')
import re as _re
_t = _re.sub(r'\\(.)', r'\1', title.group(1).decode('latin-1')) if title else '(none)'
print(f'    title    {_t}')
print(f'    size     {len(d)/1024:.0f} KB')
if expect == 'drawn' and not fails:
    print('    note     no text layer by design — human eyes only, never a scanner')
for f in fails:
    print(f'    FAIL     {f}')
sys.exit(1 if fails else 0)
