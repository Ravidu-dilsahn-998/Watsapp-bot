# 🤖 IP DILSAHN — WhatsApp Bot

A complete, **real** WhatsApp bot built on **Node.js 20** + **[@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)**, with a mobile-first web dashboard that gives you a genuine **8-digit pairing code** (no QR required). It is **not** a mock UI, **not** an Android APK, and **not** the WhatsApp Business Cloud API — it connects to WhatsApp like WhatsApp Web / Desktop does, using the multi-device protocol.

| | |
|---|---|
| **Bot name** | IP DILSAHN |
| **Default prefix** | `.` (change with `.prefix set <char>`) |
| **Commands** | **380 registered** across 12 categories + 456 aliases |
| **Dashboard** | Express server on `process.env.PORT \|\| 3000` |
| **Pairing** | `requestPairingCode()` — real codes from WhatsApp |
| **Reconnect** | Automatic, with `DisconnectReason` handling |
| **Hosting** | Koyeb · Render · Railway · any VPS · Termux (Android) |

---

## ✨ What you get on connection

The **exact moment** the session opens (`connection === "open"`), IP DILSAHN sends a rich connection notification to the bot's own chat **and** every configured owner number:

```
╭━━〔 *IP DILSAHN* 〕━━╮
┃ ✅ *CONNECTED SUCCESSFULLY*
┃
┃ 🟢 Status   : *Online*
┃ 🤖 Bot      : *IP DILSAHN*
┃ 🔑 Prefix   : *.*
┃ 📦 Commands : *380*
┃ 📱 Number   : *+947XXXXXXXX*
┃ ⚙️ Version  : *v1.0.0*
┃ 🕒 Time     : *21 Nov 2026, 07:47:25 pm*
┃
┃ Your bot is live and ready.
┃ Type *.menu* to open the menu.
╰━━━━━━━━━━━━━━━━━━━━╯
```

---

## 📁 Project structure

```
ip-dilsahn/
├── index.js              # entry point: loads commands, starts web + WhatsApp
├── config.js             # central config (env-overridable)
├── package.json
├── assets/font.ttf       # font used for rendered images
├── commands/             # 12 modular command files — 380 commands
│   ├── general.js        # menu, ping, alive, botinfo, prefix, …
│   ├── users.js          # adduser, addprem, addsudo, listusers, myinfo, ban, …
│   ├── download.js       # ytmp4, ytmp3, tiktok, instagram, telegram, fetch, …
│   ├── media.js          # sticker, toimg, tomp3, blur, emojimix, qr, …
│   ├── group.js          # promote, kick, tagall, antilink, welcome, …
│   ├── admin.js          # broadcast, backup, toggles, triggers, diagnostics
│   ├── fun.js            # joke, meme, 8ball, trivia, ship, slot, …
│   ├── text.js           # case tools, base64, hashes, morse-ish, zalgo, …
│   ├── tools.js          # weather, ip, wiki, translate, tts, qr, remind, …
│   ├── status.js         # botstatus, healthcheck, leaderboards, …
│   ├── anime.js          # neko, waifu, hug, pat, animals, animeverse …
│   └── converter.js      # temp, length, currency, roman, bmi, emi, …
├── lib/
│   ├── bot.js            # Baileys socket, pairing, reconnect, router, alert
│   ├── context.js        # rich ctx object for every command
│   ├── registry.js       # command registry + validation
│   ├── commands.js       # dynamic loader
│   ├── features.js       # auto-reply, anti-link, welcome/goodbye, chat-bot
│   ├── media.js          # yt-dlp, tikwm, telegram, direct download, ffmpeg
│   ├── render.js         # SVG → PNG menu/status/welcome cards
│   ├── msg.js            # message builders
│   ├── users.js          # roles: owner / sudo / premium / user / guest
│   ├── db.js             # safe JSON stores with auto-persist
│   ├── server.js         # Express dashboard + JSON API
│   ├── helpers.js
│   └── logger.js
├── public/index.html     # mobile dashboard (pairing + live status)
├── data/                 # users.json, settings.json, groups.json, …
├── auth/                 # WhatsApp credentials (created on pairing) — KEEP SECRET
└── README.md
```

---

## 🚀 Deployment — pick ONE route

### ⚡ Route A — Koyeb (free, recommended)

1. **Get the code online.** Create a free [GitHub](https://github.com) account → *New repository* → upload the **contents** of this folder (you can drag-and-drop the unzipped files; do **not** upload `node_modules` or your `auth` folder).
2. Go to [koyeb.com](https://app.koyeb.com) → sign in with GitHub → **Create Service** → **GitHub** → pick your repo.
3. Settings:
   - **Builder:** Buildpack
   - **Run command:** `npm start`
   - **Port:** `3000` (Koyeb sets `PORT` automatically — the bot uses it)
   - **Instance:** Nano (free)
4. **Environment variables** (Service → Settings → Environment):
   ```
   OWNER_NUMBER=947XXXXXXXX        ← your number, country code, digits only
   DASHBOARD_PASSWORD=MySecret123  ← protects the panel
   BOT_NAME=IP DILSAHN
   BOT_PREFIX=.
   ```
5. **Deploy.** Open the public URL Koyeb gives you → the **IP DILSAHN WhatsApp Bot Panel** loads.
6. Enter your number → **Get Pairing Code** → in WhatsApp open **Settings → Linked devices → Link a device → Link with phone number** → type the 8 digits.
7. Within seconds the bot messages you the *CONNECTED SUCCESSFULLY* card. 🎉

> ⚠️ **Free instances sleep / restart.** Koyeb's free tier stops idle services after a while, and some hosts wipe the filesystem on redeploy. Your WhatsApp session lives in `auth/`. If the session is lost after a redeploy, just open the dashboard and pair again (takes 10 seconds). If you want a session that survives forever, attach a persistent volume or use Route D.

---

### 🟣 Route B — Render (free)

1. Push the project to GitHub (same as above).
2. [render.com](https://render.com) → **New → Web Service** → connect the repo.
3. Fill in:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
4. Add the environment variables from Route A step 4.
5. Deploy → open the `.onrender.com` URL → pair with your number.

> 📝 Render free services sleep after ~15 min of inactivity; the first request after sleeping takes ~30s to wake. Pairing still works normally.

---

### 🚂 Route C — Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
2. Railway auto-detects Node. If it asks, set **Start command** to `npm start`.
3. **Variables** tab → add `OWNER_NUMBER`, `DASHBOARD_PASSWORD`, etc.
4. **Settings → Networking → Generate Domain** → open the URL → pair.

> Note: Railway's free trial credit is limited; check current pricing. Adding a **Volume** mounted at `/app/auth` makes the WhatsApp session persistent.

---

### 📱 Route D — Termux on your phone (no PC, no cloud)

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs-lts git zip unzip ffmpeg -y
termux-wake-lock

mkdir -p ~/bot && cd ~/bot
# copy whatsapp-bot.zip into your phone Downloads, then:
cp /sdcard/Download/whatsapp-bot.zip ~/bot/
unzip whatsapp-bot.zip && cd ip-dilsahn
npm install
OWNER_NUMBER=947XXXXXXXX npm start
```

Open **http://localhost:3000** in your phone browser → enter your number → **Get Pairing Code** → link with WhatsApp.

Keep it alive when the screen is off:
```bash
pkg install termux-services -y     # or use tmux
tmux new -s dilsahn
node index.js
# detach with Ctrl+B then D  ·  reattach: tmux attach -t dilsahn
```

> 💡 Termux installs the Node 20 long-term-support build. On 32-bit ARM phones, `sharp`/`ffmpeg-static` fall back gracefully — sticker/download commands still work via WhatsApp's own media handling; if `sharp` cannot build, run `pkg install sharp` alternatives or use Route A/B.

---

## 🔑 Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `OWNER_NUMBER` | *(empty)* | Your number(s), comma-separated — **set this!** Owner access + connection alerts |
| `OWNER_NAME` | `IP DILSAHN Owner` | Shown in `.owner` |
| `BOT_NAME` | `IP DILSAHN` | Branding in menus |
| `BOT_PREFIX` | `.` | Default command prefix |
| `DASHBOARD_PASSWORD` | *(empty)* | Protects `/api/pair`, `/api/logout`, `/api/stats` |
| `PUBLIC_URL` | _(empty)_ | Your deployed URL, e.g. `https://mybot.koyeb.app` — used by `.animeverse` to build the shareable link |

## 🎴 AnimeVerse — animated character app

The bot also serves a **self-contained animated web app**: six characters, each with its own
animation, colour palette, particle effect and procedurally generated soundscape.

* **Open it at** `https://your-deployment-url/anime`
* **From WhatsApp:** send `.animeverse` (or `.av`) to list the six characters;
  `.animeverse 4` shows a single profile. Set `PUBLIC_URL` and the link is included automatically.
* **No assets, no CDN, no network:** images are inlined as data URIs and all music/SFX are
  synthesised live with the Web Audio API, so it works fully offline and inside restrictive webviews.
* **Six sounds, six animations:** every character has its own musical root/scale/tempo/pluck timbre,
  its own tap SFX, and its own particle system (feathers, petals, snow, embers, neon, blossom).

| `PORT` | `3000` | Set automatically by most hosts |
| `MAX_DOWNLOAD_MB` | `120` | Max media size for downloaders |
| `MAX_FETCH_MB` | `100` | Max size for `.fetch` |
| `LOG_LEVEL` | `info` | `debug` for verbose logs |
| `TERMINAL_QR` | `true` | Also print a QR in the console as fallback |

---

## 🧩 Command reference (selection)

### Users & access
| Command | Role | What it does |
|---|---|---|
| `.adduser 94712345678` | sudo | Authorise a user |
| `.addprem 94712345678` | sudo | Grant premium (bigger limits) |
| `.addsudo 94712345678` | owner | Grant sudo (trusted admin) |
| `.deluser` / `.delprem` / `.delsudo` | — | Revoke access |
| `.listusers` | sudo | Show owners / sudo / premium / users / bans |
| `.myinfo` · `.profile` · `.role` | — | Roles and profiles |
| `.ban` / `.unban` / `.listbans` | sudo | Block abusers |

### Downloaders (send command + link)
```bash
.ytmp4 https://youtu.be/XXXX     # YouTube video (480p MP4)
.ytvhd https://youtu.be/XXXX     # YouTube 720p (premium)
.ytmp3 https://youtu.be/XXXX     # YouTube MP3
.tiktok https://vm.tiktok.com/XXXX   # TikTok, no watermark
.instagram https://instagram.com/reel/XXXX
.telegram https://t.me/channel/123
.fetch https://example.com/file.pdf   # any direct file (PDF/ZIP/APK/MP4…)
.tourl                          # reply to a file → upload → get link
```
Also: `facebook`, `twitter`, `threads`, `soundcloud`, `reddit`, `vimeo`, `dailymotion`, `pinterest`, `spotify`, `mediafire`, `apk`, `ytsearch`, `ytplay`, `ytinfo`.

### Media & stickers
`.sticker` (reply to image/video) · `.toimg` · `.tovideo` · `.tomp3` · `.tovn` · `.togif` · `.take <pack>` · `.emojimix 😂 😍` · `.blur` `.grayscale` `.invert` `.rotate` `.circle` `.resize` `.thumbnail` `.watermark` `.removebg`

### Group management (bot must be admin)
`.groupinfo` `.admins` `.members` `.promote` `.demote` `.kick` `.addmember` `.tagall` `.hidetag` `.setsubject` `.setdesc` `.setsicon` `.mute` `.unmute` `.lock` `.unlock` `.revoke` `.antilink on|warn|kick` `.warn @user` `.welcome on|off` `.goodbye on|off` `.setwelcome <text with @user>` `.previewwelcome` `.requests` `.approve` `.reject`

### Admin / owner
`.broadcast <text>` `.backup` `.sessions` `.diag` `.config` `.reload` `.setpp` `.setbio` `.block` `.unblock` `.setpresence` `.addtrigger keyword | reply` `.listtriggers` `.setloglevel` `.shutdown`

### Features (toggle from WhatsApp)
`.toggles` — list features · `.toggles autoread` — switch one
Available: `autoReply`, `autoRead`, `autoViewStatus`, `autoReactStatus`, `antiLink`, `antiDelete`, `antiCall`, `welcome`, `goodbye`, `chatBot`, `keepOnline`

### Fun & tools
`.menu` `.ping` `.alive` `.botinfo` `.stats` `.joke` `.meme` `.8ball` `.trivia` `.ship @a @b` `.rps rock` `.slot` `.quote` `.fact` `.weather Colombo` `.ip 8.8.8.8` `.wiki WhatsApp` `.translate es hello` `.currency 100 USD LKR` `.bmi 70 175` `.tts hello` `.qr https://…` `.remind 10 call mum` `.calc (2+3)*7`

`.menu` shows **all 380 commands** grouped by category — the count in the menu, the dashboard and `.totalcommands` is read from the live registry, so it can never drift from reality.

---

## 🛠️ How it works (short version)

- **`lib/bot.js`** creates the Baileys socket with `useMultiFileAuthState('./auth')`, fetches the latest WA version, and listens to `connection.update`. On `open` it fires the connection notice; on `close` it inspects `DisconnectReason` — `loggedOut` (401) stops and asks for a new pairing, `restartRequired` (515) restarts immediately, everything else reconnects with exponential backoff.
- **`requestPairingCode(number)`** is called only from `POST /api/pair`. The 8-digit code you see on the dashboard is produced by WhatsApp's servers via Baileys — there are no fake or hardcoded codes anywhere in the codebase.
- **Message pipeline:** `messages.upsert` → banned check → auto-read/status handling → `buildContext()` (roles, mentions, quoted media, group admin state) → `lib/features.js` (anti-link, triggers, chatbot) → command registry lookup → role/scope/cooldown checks → `command.run(ctx)` with a 180s timeout.
- **Downloaders:** `youtube-dl-exec` ships a bundled `yt-dlp` binary; `ffmpeg-static` provides ffmpeg for merging/extraction. TikTok uses the public `tikwm` API (no watermark); Telegram parses public `?embed=1` pages; `.fetch` streams any direct URL with a size cap.
- **Storage:** plain JSON in `data/`, written atomically (temp file + rename) so a crash can't corrupt them. No database needed.

---

## ❓ Troubleshooting

| Problem | Fix |
|---|---|
| *"Pairing failed"* | Number must include the country code, digits only (`947XXXXXXXX`, not `+94 7X…`). Wait ~10s after the page loads before requesting. |
| *Code expired* | Codes last a few minutes. Request a new one from the panel. |
| *Bot connects then drops* | Normal after pairing — it auto-reconnects. If it loops, check logs; usually a duplicate bot using the same session. |
| *"Already connected"* | One number per instance. Use **Reset session** on the panel to switch numbers. |
| *Bot silent* | Check `.menu` works; if not, ensure your number is in `OWNER_NUMBER` or the bot is `public` (`.setpublic on`). |
| *Free host wiped my session* | Re-pair (10s), or attach a persistent volume mounted at `/app/auth`. |
| *Downloads fail* | Some videos are private/region-locked. Try again or use a direct link with `.fetch`. |

---

## ⚠️ Disclaimer

This is an **unofficial** WhatsApp client. It is not affiliated with, endorsed by, or supported by WhatsApp or Meta. Automating a WhatsApp account can lead to a temporary or permanent ban — **use a secondary number**. Respect the Terms of Service of WhatsApp and of any site you download from.

---

*Built with ❤️ for IP DILSAHN · Baileys 7 · Express · Node.js 20*
