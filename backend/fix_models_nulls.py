#!/usr/bin/env python
# Temporary script to remove null bytes from models.py

import os

target = "backend/formular/models.py"

with open(target, "rb") as f:
    data = f.read()

original_len = len(data)
data = data.replace(b"\x00", b"")

if len(data) != original_len:
    with open(target, "wb") as f:
        f.write(data)
    print(f"Removed {original_len - len(data)} null bytes from {target}")
else:
    print(f"No null bytes found in {target}")

# Also ensure it ends with a single newline and no trailing junk
with open(target, "rb") as f:
    data = f.read()

# Strip trailing whitespace/newlines and add one clean newline
text = data.decode("utf-8", errors="ignore")
text = text.rstrip() + "\n"

with open(target, "w", encoding="utf-8", newline="\n") as f:
    f.write(text)

print("File normalized and cleaned.")
print("Last 80 chars:", repr(text[-80:]))
