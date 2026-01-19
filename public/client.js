const socket = io();
let myNick = "";
let currentRoom = "";
let lastMention = 0;

// --- 音楽ファイルの定義 ---
const bgmTitle = new Audio('/sounds/title.mp3');   // タイトル画面
const bgmWait  = new Audio('/sounds/battle.mp3');  // 承認待ち
const bgmJoin  = new Audio('/sounds/ketsui.mp3');  // 主催者への通知
bgmTitle.loop = true;
bgmWait.loop = true;

// --- 1. 最初のクリックで音楽開始 ---
document.getElementById('screen-start').addEventListener('click', () => {
    document.getElementById('screen-start').classList.add('hidden');
    document.getElementById('screen-title').classList.remove('hidden');
    bgmTitle.play().catch(e => console.log("再生制限:", e));
    updateBG();
});

// --- 2. 昼夜背景 ---
function updateBG() {
    const h = new Date().getHours();
    document.body.className = (h >= 5 && h < 17) ? 'day-bg' : 'night-bg';
}
setInterval(updateBG, 60000);

// --- 3. 九九認証 ---
let ans = 0;
function startCaptcha() {
    const a = Math.floor(Math.random()*9)+1;
    const b = Math.floor(Math.random()*9)+1;
    ans = a * b;
    document.getElementById('kuku-q').innerText = `${a} × ${b} = ?`;
    show('screen-captcha');
}
function checkCaptcha() {
    if(parseInt(document.getElementById('kuku-a').value) === ans) {
        show('screen-nick');
    } else {
        alert("不正解！"); startCaptcha();
    }
}

// --- 4. ニックネーム決定 ---
function setNick() {
    const n = document.getElementById('my-nick').value;
    if(!n) return alert("入力してください");
    myNick = n;
    show('screen-menu');
}

// --- 5. 通話関連 ---
function showJoin() { show('screen-join'); }

function createRoom() {
    const id = Math.random().toString(36).substring(2,8);
    socket.emit('create-room', id);
}
function joinRoom() {
    const id = document.getElementById('room-id').value;
    if(!id) return;
    currentRoom = id;
    socket.emit('request-join', { roomId: id, nickname: myNick });
    
    // 承認待ち画面へ＆音楽切り替え
    bgmTitle.pause();
    bgmWait.play();
    show('screen-wait');
}

// サーバーからの応答
socket.on('room-created', (id) => {
    currentRoom = id;
    bgmTitle.pause(); // 通話に入るときはタイトル曲を止める
    startCall(id);
});

socket.on('admin-approval-request', (data) => {
    bgmJoin.play(); // 主催者に通知音
    if(confirm(`${data.nickname}さんが参加を希望しています。承認しますか？`)) {
        socket.emit('approve-user', data.senderId);
    }
});

socket.on('join-approved', () => {
    bgmWait.pause(); // 承認されたら待機音ストップ
    startCall(currentRoom);
});

// --- 6. 通話開始処理 ---
async function startCall(id) {
    show('screen-call');
    document.getElementById('disp-id').innerText = "ID: " + id;
    
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('main-video').srcObject = stream;
    
    setInterval(() => {
        document.getElementById('clock').innerText = new Date().toLocaleTimeString();
    }, 1000);
}

// --- 7. チャット・管理 ---
function toggleSidebar(id) {
    document.getElementById(`side-${id}`).classList.toggle('open');
}

function sendChat() {
    const text = document.getElementById('chat-in').value;
    if(text.includes('@')) {
        const now = Date.now();
        if(now - lastMention < 60000) return alert("メンション制限中");
        lastMention = now;
    }
    socket.emit('send-chat', { roomId: currentRoom, sender: myNick, text: text });
    document.getElementById('chat-in').value = "";
}

socket.on('receive-chat', (data) => {
    const p = document.createElement('p');
    p.innerText = `${data.sender}: ${data.text}`;
    document.getElementById('chat-box').appendChild(p);
});

socket.on('force-exit', () => {
    alert("主催者により通話が終了されました");
    location.reload();
});

function adminAction(type) {
    socket.emit('admin-action', { roomId: currentRoom, type: type });
}

// 画面切り替え用
function show(id) {
    document.querySelectorAll('.full-screen').forEach(e => e.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}
