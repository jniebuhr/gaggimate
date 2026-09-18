#!/usr/bin/env python3
"""Emit no-op definitions for every ui_events.h callback the simulator doesn't
implement itself (the generated screens reference all of them)."""
import re
import sys

header, out, *manual = sys.argv[1:]
names = re.findall(r"void\s+(on\w+)\s*\(lv_event_t\s*\*\s*\w*\)\s*;", open(header).read())
skip = set(manual)
with open(out, "w") as f:
    f.write('#include "lvgl/ui.h"\n')
    for n in names:
        if n in skip:
            continue
        f.write(f"void {n}(lv_event_t *e) {{ (void)e; }}\n")
print(f"generated {out}: {len(names) - len(skip)} stubs, {len(skip)} manual")
