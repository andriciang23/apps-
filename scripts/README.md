# Keeping it running

Without this, the assistant dies when you close the terminal or reboot — and you
only find out when it stops answering. These scripts make it start on boot and
restart itself if it crashes.

Do this **once**, after the assistant is working when you start it by hand.

---

## Step 1 — A permanent web address

Skip this and everything else breaks after the first reboot.

The quick command from the main README (`cloudflared tunnel --url ...`) gives you
a **new random web address every time it starts**. WhatsApp is configured to send
messages to one fixed address. So after a reboot, WhatsApp keeps sending messages
to an address that no longer exists — no error, no warning, just silence.

A *named* tunnel keeps the same address forever. Run these once:

```powershell
cloudflared tunnel login
cloudflared tunnel create hojichaya-ops
cloudflared tunnel route dns hojichaya-ops ops.hojichaya.com
```

Then create `C:\Users\<you>\.cloudflared\config.yml`:

```yaml
tunnel: hojichaya-ops
credentials-file: C:\Users\<you>\.cloudflared\<tunnel-id>.json

ingress:
  - hostname: ops.hojichaya.com
    service: http://localhost:3000
  - service: http_status:404
```

`<tunnel-id>` is printed by the `create` command. Your address is now
`https://ops.hojichaya.com` and it never changes.

**This requires hojichaya.com to be on Cloudflare.** If it isn't, tell me and
I'll set up the alternative.

---

## Step 2 — Install the services

Open PowerShell **as administrator** (right-click → Run as administrator), then:

```powershell
cd C:\path\to\apps-\whatsapp-shopify-agent
npm install
npm run build
..\scripts\install-service.ps1 -TunnelName hojichaya-ops
```

It should print two lines both saying `Running`. If not, look in `logs\assistant.err.log`.

Safe to re-run any time you update the code.

---

## Step 3 — Point WhatsApp at the permanent address

Meta app → WhatsApp → Configuration → Callback URL:

```
https://ops.hojichaya.com/webhook
```

Because the address is now permanent, this is the last time you touch it.

---

## Step 3b — If your files are on a mapped drive (W:)

The wholesale pricelist and catalogue live on **W:**. A Windows service normally
runs as LOCAL SYSTEM, which **cannot see drive letters you mapped in Explorer**.
Left alone, asking for the pricelist returns "not found" even though the file is
obviously there.

Fix it once, after installing the services:

1. Press `Windows key`, type `services.msc`, press Enter
2. Find **hojichaya-ops-assistant** → right-click → **Properties**
3. **Log On** tab → **This account** → enter your Windows username and password
4. **OK**, then right-click the service → **Restart**

Alternatively, use the UNC path (`\\server\share\...`) in `FILE_REGISTRY_ROOTS`
and `files.registry.json` instead of `W:\`, which works as LOCAL SYSTEM.

To confirm it worked, check `logs\assistant.out.log` for:

```
[startup] OK   file registry: 2 files present
```

`FAIL … missing:` means the service still cannot see the drive.

---

## Step 4 — Automatic down-alert

Tells you on WhatsApp if the assistant stops working, instead of you finding out
by messaging it and getting nothing back.

In Task Scheduler → Create Task:

- **General:** Run whether user is logged on or not, Run with highest privileges
- **Trigger:** Daily, repeat every 15 minutes, indefinitely
- **Action:** Start a program
  - Program: `powershell.exe`
  - Arguments:
    ```
    -ExecutionPolicy Bypass -File "C:\path\to\apps-\scripts\health-check.ps1" -PublicUrl "https://ops.hojichaya.com" -NotifyOnFailure
    ```

**One caveat:** WhatsApp only lets a business message you for free within 24
hours of you messaging it. If the assistant goes down and you haven't messaged it
that day, the alert cannot reach you. Two options — tell me which you'd prefer:

- Register a utility message template with Meta (~RM 0.06 per alert), which works
  any time; or
- Have the alert go to email instead, which has no such restriction.

---

## Everyday commands

| What | Command |
|---|---|
| Is it running? | `.\scripts\health-check.ps1 -PublicUrl https://ops.hojichaya.com` |
| Restart it | `Restart-Service hojichaya-ops-assistant` |
| Read the log | `Get-Content .\whatsapp-shopify-agent\logs\assistant.err.log -Tail 50` |
| After a code update | `npm run build; Restart-Service hojichaya-ops-assistant` |
| Remove everything | `.\scripts\uninstall-service.ps1` |

---

## What the two services do

| Service | Job | If it stops |
|---|---|---|
| `hojichaya-ops-assistant` | The assistant itself | It stops replying |
| `hojichaya-ops-tunnel` | Connects it to the internet | WhatsApp messages silently vanish |

They're separate on purpose: if the tunnel drops, the assistant stays up and
keeps its state. Both restart themselves 10 seconds after a crash.

---

## What the assistant checks when it starts

Look for these in `logs\assistant.out.log` after a restart:

```
[startup] OK   ops bridge: facts.py reachable
[startup] OK   shopify: connected to HojichaYa
[startup] OK   file registry: 4 files present
```

A `FAIL` line means that part won't work. The assistant keeps serving and will
tell you "could not check" rather than guessing a number — but the log is where
you find out why.

---

## Status of these scripts

Written but **not yet run on Windows** — there's no Windows machine in the
environment they were built in. Expect to hit at least one small thing on first
run. Send me the error and I'll fix it.

Verify after installing:

1. Reboot the PC. Both services should come back without you logging in.
2. End the `node.exe` task in Task Manager. It should restart within ~10 seconds.
3. Check `https://ops.hojichaya.com/healthz` in a browser — should say `ok`.
4. Message the assistant after a reboot, with no manual steps, and get a reply.
