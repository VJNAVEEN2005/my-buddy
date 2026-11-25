<p align="center">
  <img src="showcase/tauri/src-tauri/icons/128x128@2x.png" width="128" alt="My Buddy icon">
</p>

<h1 align="center">My Buddy</h1>

<p align="center">A glowing AI buddy that lives on your desktop, talks with you, and runs errands in your own Chrome.</p>

## What it does

- **Talk or type.** Hold Ctrl+Alt and speak, or tap Ctrl+Shift to type. Say **"Hey Buddy"** with the wake word on.
- **Sees your screen.** Ask about anything in front of you; it points at the right button and walks you through steps.
- **Errands in your own Chrome.** With the My Buddy extension on, it works your signed-in Chrome in a background
  tab: cancel a subscription, fill a form, look something up. Risky clicks (cancel, pay, delete, send) always ask you
  first, and it never types passwords or card numbers.
- **Remembers.** Commitments, reminders ("every weekday at 9") and what matters to you.
- **Your model.** Sign in with Claude or ChatGPT, use an API key, or a local model (Ollama, LM Studio).

## Set up the Chrome extension

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Click **Load unpacked** and pick the `showcase/chrome-extension` folder.
3. Keep My Buddy running. The extension connects to it on this computer only (`127.0.0.1:47821`), and only this
   extension's ID is accepted, so web pages can't send it commands.

## Build (Windows)

Needs Node.js 22+, Rust, the MSVC build tools and the Tauri CLI (`cargo install tauri-cli --version "^2" --locked`).
Run these in Git Bash:

```bash
cd showcase/tauri
(cd sidecar && npm ci && npm test)
TAURI_BUNDLES=nsis ./build.sh     # installer in src-tauri/target/release/bundle/nsis/
```

Updates are off: My Buddy has no update feed of its own yet (see `update()` in `src-tauri/src/main.rs`).

## Author

Made by **Naveen VJ**: [GitHub @VJNAVEEN2005](https://github.com/VJNAVEEN2005) ·
[Portfolio](https://vjnaveen.netlify.app/)

## Credits and license

Copyright (C) 2026 Naveen VJ, for My Buddy's own changes and features.
Built on [Roamies](https://github.com/KenKaiii/Roamies), Copyright (C) Ken Kai.

My Buddy keeps Roamies' license, **AGPL-3.0** (see [LICENSE](LICENSE)). If you share My Buddy, or run it as a service for others, you must offer
them its source code. Third-party parts and their licences are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
