import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBgCX09RWBq47Y6bWCIB5IAUj5Ws-I1m-I",
    authDomain: "betbazzzi-aba25.firebaseapp.com",
    projectId: "betbazzzi-aba25",
    storageBucket: "betbazzzi-aba25.firebasestorage.app",
    messagingSenderId: "644113043164",
    appId: "1:644113043164:web:5d6d2d0f3fb34cdde16e19",
    measurementId: "G-6VNTCJEMP9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const WHEEL_NUMBERS = [1,2,3,4,5,6,7,8,9,10];
const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

let selectedNumber = null;
let currentUser = null;
let usersCache = {};
let gameConfig = { minBet: 10, minPointsToPlay: 50, riggedNextResult: null };
let currentAngle = 0;
let isSpinning = false;
let heartbeatTimer = null;

const authScreen = document.getElementById("authScreen");
const gameScreen = document.getElementById("gameScreen");
const authMessage = document.getElementById("authMessage");
const numbersWrap = document.getElementById("numbers");
const canvas = document.getElementById("spinWheel");
const ctx = canvas.getContext("2d");

function isAdmin(userId) {
    return userId?.toLowerCase() === "admin";
}

function showAuthScreen() {
    authScreen.classList.add("active");
    gameScreen.classList.remove("active");
}

function showGameScreen() {
    authScreen.classList.remove("active");
    gameScreen.classList.add("active");
}

function saveSession(userId) {
    localStorage.setItem("bet_user", userId);
}

function clearSession() {
    localStorage.removeItem("bet_user");
}

function getSession() {
    return localStorage.getItem("bet_user");
}

function setMessage(message, isError = true) {
    authMessage.textContent = message;
    authMessage.style.color = isError ? "#fda4af" : "#86efac";
}

function makeNumberButtons() {
    numbersWrap.innerHTML = "";
    WHEEL_NUMBERS.forEach((num) => {
        const btn = document.createElement("button");
        btn.className = "num-btn";
        btn.textContent = num;
        btn.dataset.num = String(num);
        btn.addEventListener("click", () => {
            selectedNumber = num;
            document.querySelectorAll(".num-btn").forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");
        });
        numbersWrap.appendChild(btn);
    });
}

function drawWheel(angleOffset = 0) {
    const radius = canvas.width / 2;
    const anglePer = (Math.PI * 2) / WHEEL_NUMBERS.length;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(angleOffset);

    for (let i = 0; i < WHEEL_NUMBERS.length; i += 1) {
        const start = i * anglePer;
        const end = start + anglePer;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius - 6, start, end);
        ctx.closePath();
        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.fill();

        ctx.save();
        ctx.rotate(start + anglePer / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText(String(WHEEL_NUMBERS[i]), radius - 20, 8);
        ctx.restore();
    }

    ctx.restore();

    ctx.beginPath();
    ctx.arc(radius, radius, 28, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
}

function animateSpinTo(resultNumber) {
    const index = WHEEL_NUMBERS.indexOf(resultNumber);
    const anglePer = (Math.PI * 2) / WHEEL_NUMBERS.length;
    const targetAngle = (Math.PI * 1.5) - (index * anglePer + anglePer / 2);
    const extraSpins = Math.PI * 2 * 6;
    const finalAngle = extraSpins + targetAngle;

    const duration = 2500;
    const start = performance.now();
    const startAngle = currentAngle % (Math.PI * 2);

    return new Promise((resolve) => {
        function step(timestamp) {
            const progress = Math.min((timestamp - start) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            currentAngle = startAngle + finalAngle * easeOut;
            drawWheel(currentAngle);

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                currentAngle = currentAngle % (Math.PI * 2);
                resolve();
            }
        }

        requestAnimationFrame(step);
    });
}

async function getUser(userId) {
    const snap = await getDoc(doc(db, "users", userId));
    return snap.exists() ? snap.data() : null;
}

async function createUser(userId, password) {
    await setDoc(doc(db, "users", userId), {
        id: userId,
        password,
        points: 100,
        online: true,
        lastSeen: Date.now(),
        updatedAt: serverTimestamp()
    });
}

async function updateUser(userId, data) {
    await updateDoc(doc(db, "users", userId), { ...data, updatedAt: serverTimestamp() });
}

async function heartbeat() {
    if (!currentUser) return;
    await updateUser(currentUser, { lastSeen: Date.now(), online: true });
}

async function ensureGameConfig() {
    const ref = doc(db, "config", "game");
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, {
            minBet: 10,
            minPointsToPlay: 50,
            riggedNextResult: null,
            updatedAt: serverTimestamp()
        });
    }
}

function applyHeaderUI() {
    const user = usersCache[currentUser];
    document.getElementById("playerName").textContent = currentUser || "";
    document.getElementById("playerPoints").textContent = user?.points ?? 0;
    document.getElementById("minBetLabel").textContent = gameConfig.minBet ?? 0;
    document.getElementById("minPointsLabel").textContent = gameConfig.minPointsToPlay ?? 0;

    const now = Date.now();
    const onlineCount = Object.values(usersCache).filter((u) => {
        if (!u.online) return false;
        if (!u.lastSeen) return true;
        return now - u.lastSeen < 60000;
    }).length;
    document.getElementById("onlineCount").textContent = String(onlineCount);

    const adminBtn = document.getElementById("toggleAdmin");
    if (isAdmin(currentUser)) {
        adminBtn.classList.remove("hidden");
    } else {
        adminBtn.classList.add("hidden");
        document.getElementById("adminPanel").classList.add("hidden");
    }
}

function fillAdminUsers() {
    const select = document.getElementById("adminSelectPlayer");
    select.innerHTML = "";
    Object.keys(usersCache).sort().forEach((userId) => {
        const option = document.createElement("option");
        option.value = userId;
        option.textContent = `${userId} (${usersCache[userId].points ?? 0} pts)`;
        select.appendChild(option);
    });
}

function listenUsers() {
    return onSnapshot(collection(db, "users"), (snapshot) => {
        usersCache = {};
        snapshot.forEach((docSnap) => {
            usersCache[docSnap.id] = docSnap.data();
        });
        applyHeaderUI();
        fillAdminUsers();
    });
}

function listenConfig() {
    return onSnapshot(doc(db, "config", "game"), (snap) => {
        if (snap.exists()) {
            gameConfig = snap.data();
            applyHeaderUI();
            document.getElementById("rigStatus").textContent = gameConfig.riggedNextResult
                ? `Current mode: Forced ${gameConfig.riggedNextResult}`
                : "Current mode: Random";
            document.getElementById("adminMinBet").value = gameConfig.minBet ?? 10;
            document.getElementById("adminMinPoints").value = gameConfig.minPointsToPlay ?? 50;
            document.getElementById("rigNumber").value = gameConfig.riggedNextResult ?? "";
        }
    });
}

async function startSession(userId) {
    currentUser = userId;
    saveSession(userId);
    showGameScreen();
    await updateUser(userId, { online: true, lastSeen: Date.now() });
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(heartbeat, 15000);
    applyHeaderUI();
}

async function handleRegister(event) {
    event.preventDefault();
    const userId = document.getElementById("regId").value.trim();
    const password = document.getElementById("regPassword").value.trim();

    if (!userId || !password) {
        setMessage("ID and password are required.");
        return;
    }
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(userId)) {
        setMessage("ID must be 3-24 characters (letters, numbers, underscore).");
        return;
    }

    const existing = await getUser(userId);
    if (existing) {
        setMessage("Player ID already exists.");
        return;
    }

    await createUser(userId, password);
    setMessage("Account created.", false);
    await startSession(userId);
}

async function handleLogin(event) {
    event.preventDefault();
    const userId = document.getElementById("loginId").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    const user = await getUser(userId);
    if (!user || user.password !== password) {
        setMessage("Invalid ID or password.");
        return;
    }

    setMessage("Login successful.", false);
    await startSession(userId);
}

async function spin() {
    if (isSpinning) return;
    const bet = Number(document.getElementById("betAmount").value);
    const resultEl = document.getElementById("spinResult");
    const user = usersCache[currentUser];

    if (!selectedNumber) {
        resultEl.textContent = "Please choose a number first.";
        return;
    }

    if (!Number.isInteger(bet) || bet <= 0) {
        resultEl.textContent = "Enter a valid bet.";
        return;
    }

    if (bet < (gameConfig.minBet ?? 1)) {
        resultEl.textContent = `Bet must be at least ${gameConfig.minBet}.`;
        return;
    }

    if ((user?.points ?? 0) < (gameConfig.minPointsToPlay ?? 0)) {
        resultEl.textContent = `Need ${gameConfig.minPointsToPlay} points minimum to play.`;
        return;
    }

    if ((user?.points ?? 0) < bet) {
        resultEl.textContent = "Not enough points for this bet.";
        return;
    }

    const controlled = Number(gameConfig.riggedNextResult);
    const result = Number.isInteger(controlled) && controlled >= 1 && controlled <= 10
        ? controlled
        : WHEEL_NUMBERS[Math.floor(Math.random() * WHEEL_NUMBERS.length)];

    isSpinning = true;
    document.getElementById("spinBtn").disabled = true;
    try {
        await animateSpinTo(result);

        let nextPoints = user.points - bet;
        if (selectedNumber === result) {
            nextPoints = user.points + (bet * 9);
            resultEl.textContent = `🎉 Win! Result: ${result}. You gained ${bet * 9} points.`;
        } else {
            resultEl.textContent = `❌ Lose! Result: ${result}. You lost ${bet} points.`;
        }

        await updateUser(currentUser, { points: Math.max(0, nextPoints) });

        if (controlled) {
            await updateDoc(doc(db, "config", "game"), {
                riggedNextResult: null,
                updatedAt: serverTimestamp()
            });
        }
    } finally {
        isSpinning = false;
        document.getElementById("spinBtn").disabled = false;
    }
}

function setupAuthTabs() {
    document.querySelectorAll(".tab-btn").forEach((button) => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
            document.querySelectorAll(".auth-form").forEach((f) => f.classList.remove("active"));
            button.classList.add("active");
            document.getElementById(`${button.dataset.tab}Form`).classList.add("active");
        });
    });
}

async function adminSetPoints() {
    if (!isAdmin(currentUser)) return;
    const userId = document.getElementById("adminSelectPlayer").value;
    const points = Number(document.getElementById("adminPointsInput").value);
    if (!userId || !Number.isFinite(points) || points < 0) return;
    await updateUser(userId, { points: Math.floor(points) });
}

async function adminSaveRules() {
    if (!isAdmin(currentUser)) return;
    const minBet = Number(document.getElementById("adminMinBet").value);
    const minPoints = Number(document.getElementById("adminMinPoints").value);
    if (!Number.isFinite(minBet) || minBet < 1 || !Number.isFinite(minPoints) || minPoints < 0) return;

    await updateDoc(doc(db, "config", "game"), {
        minBet: Math.floor(minBet),
        minPointsToPlay: Math.floor(minPoints),
        updatedAt: serverTimestamp()
    });
}

async function adminSaveRig() {
    if (!isAdmin(currentUser)) return;
    const value = document.getElementById("rigNumber").value;
    const num = Number(value);

    await updateDoc(doc(db, "config", "game"), {
        riggedNextResult: Number.isInteger(num) && num >= 1 && num <= 10 ? num : null,
        updatedAt: serverTimestamp()
    });
}

async function logout() {
    if (currentUser) {
        await updateUser(currentUser, { online: false });
    }
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    currentUser = null;
    clearSession();
    showAuthScreen();
}

window.addEventListener("beforeunload", async () => {
    if (currentUser) {
        await updateUser(currentUser, { online: false, lastSeen: Date.now() });
    }
});

async function init() {
    makeNumberButtons();
    drawWheel();
    setupAuthTabs();

    await ensureGameConfig();
    listenUsers();
    listenConfig();

    document.getElementById("loginForm").addEventListener("submit", handleLogin);
    document.getElementById("registerForm").addEventListener("submit", handleRegister);
    document.getElementById("spinBtn").addEventListener("click", spin);
    document.getElementById("logoutBtn").addEventListener("click", logout);

    document.getElementById("toggleAdmin").addEventListener("click", () => {
        document.getElementById("adminPanel").classList.toggle("hidden");
    });

    document.getElementById("adminSetPoints").addEventListener("click", adminSetPoints);
    document.getElementById("adminSaveRules").addEventListener("click", adminSaveRules);
    document.getElementById("adminSaveRig").addEventListener("click", adminSaveRig);

    const session = getSession();
    if (session) {
        const user = await getUser(session);
        if (user) {
            await startSession(session);
        }
    }
}

init();
