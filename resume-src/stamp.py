#!/usr/bin/env python3
"""Stamp real document metadata into a Chrome-exported PDF.

Chrome's --print-to-pdf writes an /Info dict with only Producer and Creator —
no Title, no Author. Document-management systems and some resume ingestors
read those fields, and a PDF whose title is blank is a small avoidable gap.

This is a standard PDF *incremental update*: the original bytes are left
untouched, a replacement object 1 is appended, and a new xref section points
at it with /Prev chaining back to the original table. Nothing is rewritten in
place, so a failure here cannot corrupt the existing content.
"""
import re, sys

def esc(t):
    return t.replace('\\', r'\\').replace('(', r'\(').replace(')', r'\)')

def stamp(path, title, author, subject, keywords):
    d = open(path, 'rb').read()

    m = re.search(rb'trailer\s*<<(.*?)>>\s*startxref\s+(\d+)', d, re.S)
    if not m:
        raise SystemExit(f'{path}: no classic trailer — refusing to touch it')
    trailer, prev = m.group(1), int(m.group(2))

    size = int(re.search(rb'/Size\s+(\d+)', trailer).group(1))
    root = re.search(rb'/Root\s+(\d+\s+\d+\s+R)', trailer).group(1).decode()
    info = re.search(rb'/Info\s+(\d+)\s+\d+\s+R', trailer)
    num  = int(info.group(1)) if info else size

    # keep whatever Producer/Creator the original object carried
    keep = ''
    if info:
        body = re.search(rb'(?<![0-9])' + str(num).encode() + rb'\s+0\s+obj(.*?)endobj', d, re.S)
        if body:
            for k in (b'Producer', b'Creator'):
                v = re.search(rb'/' + k + rb'\s*\(((?:\\.|[^\\()])*)\)', body.group(1))
                if v:
                    keep += f'/{k.decode()} ({v.group(1).decode("latin-1")}) '

    obj = (f'{num} 0 obj\n<< {keep}/Title ({esc(title)}) /Author ({esc(author)}) '
           f'/Subject ({esc(subject)}) /Keywords ({esc(keywords)}) >>\nendobj\n')

    out = bytearray(d)
    if not out.endswith(b'\n'):
        out += b'\n'
    off = len(out)
    out += obj.encode('latin-1')
    xref = len(out)
    out += (f'xref\n{num} 1\n{off:010d} 00000 n \n'
            f'trailer\n<</Size {max(size, num + 1)} /Root {root} /Info {num} 0 R '
            f'/Prev {prev}>>\nstartxref\n{xref}\n%%EOF\n').encode('latin-1')
    open(path, 'wb').write(bytes(out))

if __name__ == '__main__':
    stamp(*sys.argv[1:6])
