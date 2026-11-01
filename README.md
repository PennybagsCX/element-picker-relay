# Picker Relay

A Chrome extension + local watcher that turns "point at any element on any
webpage and type a note" into a compiled feedback package: element selector,
text, your note, and an auto-cropped screenshot of exactly the element you
picked, delivered in one click.

Built for agent-assisted workflows (the relay hands feedback to your local AI
assistant), but works for any team: picks land as files + images on your own
machine, and a notify hook of your choice decides where they go.

## What it does

- Floating **Picker: ON/OFF** button on every page (nothing to arm, survives restarts)
- Click any element -> type a note -> Enter. Wrong element? Just click another one, the note is kept
- Screenshots are captured at pick time and cropped to the element (DPR-aware)
- A panel lists all picks with thumbnail previews (click to zoom), per-item remove
- One click on **Send** compiles everything and drops it as a JSON file on disk
- A local watcher process picks it up, saves the screenshots, and calls your notify hook

Nothing ever leaves your machine except through the notify command you configure.

## Install (extension)

1. Download or clone this repo
2. Chrome -> `chrome://extensions` -> enable **Developer mode**
3. **Load unpacked** -> select the repo folder (the one containing `manifest.json`)

Note: Chrome 137+ silently ignores the `--load-extension` flag, so "Load unpacked"
is the way. Chrome for Testing / Chromium builds honor both.

## Install (watcher)

```bash
python3 relay.py                       # defaults: watch ~/Downloads/picker-relay
```

Configure with environment variables:

```bash
export PICKER_WATCH_DIR="$HOME/Downloads/picker-relay"   # extension drop folder
export PICKER_INBOX_DIR="$HOME/.picker-relay"            # processed payloads + PNGs
export PICKER_NOTIFY_CMD='curl -s -X POST -H "Content-Type: application/json" \
  -d "$(jq -Rs {content:.} %f | jq .content=.. )" https://discord.com/api/webhooks/XXX'
```

`PICKER_NOTIFY_CMD` gets `%f` (path to the compiled message text) and `%m`
(space-separated PNG paths). Examples: a Discord/Slack webhook via curl, a
`notify-send`/`osascript` desktop notification, an email script, or the CLI of
your AI agent.

Run it forever with launchd (macOS) or systemd (Linux). Sample launchd plist:

```xml
<plist version="1.0"><dict>
  <key>Label</key><string>com.example.picker-relay</string>
  <key>ProgramArguments</key><array><string>python3</string><string>/path/to/relay.py</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
```

## Daily cleanup

Screenshots and payloads accumulate. Prune with cron/launchd:

```bash
find ~/.picker-relay ~/Downloads/picker-relay -type f \
  \( -name '*.png' -o -name 'picks_*.json' \) -mmin +2880 -delete
```

## Files

- `manifest.json` - MV3 manifest (permissions: tabs, downloads; host: <all_urls>)
- `picker.js` - content script: button, picker, note box, panel, thumbnails, Send
- `background.js` - service worker: full-tab capture + element crop, downloads-based relay
- `relay.py` - stdlib-only watcher (no dependencies)

## Privacy

No telemetry, no network calls from the extension, no accounts. The only
network request is whatever your own `PICKER_NOTIFY_CMD` makes.

## License

MIT
