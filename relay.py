#!/usr/bin/env python3
"""Picker relay watcher.

Polls a drop folder for JSON payloads saved by the Picker Relay browser
extension, decodes the element screenshots, and hands the compiled feedback
to a notify command of your choice (webhook, CLI, script...).

Usage:
  python3 relay.py

Configuration (environment variables):
  PICKER_WATCH_DIR   folder the extension downloads into
                     (default: ~/Downloads/picker-relay)
  PICKER_INBOX_DIR   folder for processed payloads + PNGs
                     (default: ~/.picker-relay)
  PICKER_NOTIFY_CMD  command template invoked per delivery; '%f' is replaced
                     with the path to a text file containing the compiled
                     message, '%m' with a space-separated list of PNG paths.
                     (default: cat %f)
"""
import base64
import glob
import json
import os
import subprocess
import threading
import time

WATCH = os.environ.get('PICKER_WATCH_DIR', os.path.expanduser('~/Downloads/picker-relay'))
INBOX = os.environ.get('PICKER_INBOX_DIR', os.path.expanduser('~/.picker-relay'))
NOTIFY_CMD = os.environ.get('PICKER_NOTIFY_CMD', 'cat %f')


def notify(lines, media):
    msg_path = os.path.join(INBOX, 'msg.txt')
    out = '\n'.join(lines)
    if media:
        out += '\n\n' + '\n'.join('MEDIA:' + m for m in media)
    with open(msg_path, 'w') as f:
        f.write(out)
    cmd = NOTIFY_CMD.replace('%f', msg_path).replace('%m', ' '.join(media))
    subprocess.run(cmd, shell=True, capture_output=True, timeout=120)  # ponytail: shell=True by design, NOTIFY_CMD is operator-configured


def process(path):
    with open(path) as f:
        payload = json.load(f)
    ts = os.path.basename(path).replace('picks_', '').replace('.json', '')
    dst = os.path.join(INBOX, f'picks_{ts}.json')
    with open(dst, 'w') as f:
        json.dump(payload, f, indent=1)
    items = payload.get('picks', [])
    media = []
    for i, it in enumerate(items, 1):
        snap = it.get('snap')
        if snap and snap.startswith('data:image/png;base64,'):
            sp = os.path.join(INBOX, f'{ts}_{i}_{it.get("tag", "el")}.png')
            with open(sp, 'wb') as f:
                f.write(base64.b64decode(snap.split(',', 1)[1]))
            media.append(sp)
    lines = [f'Picker relay - {len(items)} pick(s) from {payload.get("url", "?")}', '']
    for i, it in enumerate(items, 1):
        note = f' - "{it["note"]}"' if it.get('note') else ''
        lines.append(f'{i}. `<{it["tag"]}>` {(it.get("text") or it.get("selector", ""))[:80]}{note}')
    lines.append('')
    lines.append(f'Saved to `{dst}`')
    threading.Thread(target=notify, args=(lines, media), daemon=True).start()
    os.rename(path, path + '.done')


def main():
    os.makedirs(INBOX, exist_ok=True)
    os.makedirs(WATCH, exist_ok=True)
    while True:
        try:
            for path in sorted(glob.glob(os.path.join(WATCH, 'picks_*.json'))):
                try:
                    process(path)
                except Exception as e:
                    with open(os.path.join(INBOX, 'relay.err.log'), 'a') as f:
                        f.write(time.strftime('%F %T ') + f'{path}: {e}\n')
                    os.rename(path, path + '.error')
        except Exception:
            pass
        time.sleep(3)


if __name__ == '__main__':
    main()
