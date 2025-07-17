let socket, key;
function login() {
    key = document.getElementById('keyInput').value.trim();
    socket = io('https://specialcommunity.github.io/remove-control/'); // <- tu wstaw adres backendu!
    socket.emit('connect_with_key', {key});
    socket.on('connected_to_pc', () => {
        document.getElementById('loginSection').style.display='none';
        document.getElementById('controlSection').style.display='block';
    });
    socket.on('error', msg => document.getElementById('loginError').innerText = msg);
    socket.on('screen_frame', img => document.getElementById('screenImg').src = 'data:image/jpeg;base64,'+img);
    socket.on('camera_frame', img => document.getElementById('cameraImg').src = 'data:image/jpeg;base64,'+img);
    // obsługa innych eventów...
}

function send(command, data={}) {
    socket.emit('control_command', {key, command, data});
}

// Pomocnicze funkcje do pobierania wartości z inputów
function getUrl() { return document.getElementById('urlInput').value; }
function getProgram() { return document.getElementById('programInput').value; }
function getFileName() { 
    let file = document.getElementById('fileInput').files[0];
    return file ? file.name : document.getElementById('newFileNameInput').value; 
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
function getWidth() { return +document.getElementById('widthInput').value || 800; }
function getHeight() { return +document.getElementById('heightInput').value || 600; }
function getCmd() { return document.getElementById('cmdInput').value; }
function getChat() { return document.getElementById('chatInput').value; }
function getFolder() { return document.getElementById('folderInput').value; }
function getNewFileName() { return document.getElementById('newFileNameInput').value; }
function getAlertText() { return document.getElementById('alertInput').value; }
function getSpecialKey() { return document.getElementById('specialKeyInput').value; }
function getBrightness() { return +document.getElementById('brightnessInput').value || 50; }
function getFan() { return +document.getElementById('fanInput').value || 1000; }
function getPID() { return +document.getElementById('pidInput').value || 0; }
function getDest() { return document.getElementById('destInput').value; }
function getSeconds() { return +document.getElementById('secondsInput').value || 60; }
