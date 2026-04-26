 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/script.js b/script.js
index 1f224e3cd64304846f2b1f8d7986d611142f7af1..072cc73f4fc9f60697bba16917e2d0b5ec74065e 100644
--- a/script.js
+++ b/script.js
@@ -1,136 +1,561 @@
+const WHEEL_NUMBERS = [1,2,3,4,5,6,7,8,9,10];
+const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];
+
 let selectedNumber = null;
-let riggedNumber = 0;
+let currentUser = null;
+let usersCache = {};
+let gameConfig = { minBet: 10, minPointsToPlay: 50, riggedNextResult: null };
+let currentAngle = 0;
+let isSpinning = false;
+let heartbeatTimer = null;
+let backend = null;
+
+const authScreen = document.getElementById("authScreen");
+const gameScreen = document.getElementById("gameScreen");
+const authMessage = document.getElementById("authMessage");
+const numbersWrap = document.getElementById("numbers");
+const canvas = document.getElementById("spinWheel");
+const ctx = canvas.getContext("2d");
+
+function isAdmin(userId) {
+    return userId?.toLowerCase() === "admin";
+}
+
+function showAuthScreen() {
+    authScreen.classList.add("active");
+    gameScreen.classList.remove("active");
+}
 
-const authScreen = document.getElementById('authScreen');
-const gameScreen = document.getElementById('gameScreen');
+function showGameScreen() {
+    authScreen.classList.remove("active");
+    gameScreen.classList.add("active");
+}
 
-function showGame() {
-    authScreen.classList.remove('active');
-    gameScreen.classList.add('active');
+function saveSession(userId) {
+    localStorage.setItem("bet_user", userId);
 }
 
-function showAuth() {
-    authScreen.classList.add('active');
-    gameScreen.classList.remove('active');
+function clearSession() {
+    localStorage.removeItem("bet_user");
 }
 
-async function getUsers() {
-    const snapshot = await window.db.collection("users").get();
-    const users = {};
-    snapshot.forEach(doc => users[doc.id] = doc.data());
-    return users;
+function getSession() {
+    return localStorage.getItem("bet_user");
 }
 
-async function saveUser(username, data) {
-    await window.db.collection("users").doc(username).set(data);
+function setMessage(message, isError = true) {
+    authMessage.textContent = message;
+    authMessage.style.color = isError ? "#fda4af" : "#86efac";
 }
 
-function setCurrentUser(u) {
-    localStorage.setItem("user", u);
+function setBackendLabel(text) {
+    const el = document.getElementById("backendMode");
+    if (el) el.textContent = text;
 }
 
-function getCurrentUser() {
-    return localStorage.getItem("user");
+function readLocalUsers() {
+    return JSON.parse(localStorage.getItem("bb_users") || "{}");
 }
 
-// LOGIN
-document.getElementById("loginForm").addEventListener("submit", async (e) => {
-    e.preventDefault();
+function writeLocalUsers(users) {
+    localStorage.setItem("bb_users", JSON.stringify(users));
+}
 
-    const u = loginUsername.value;
-    const p = loginPassword.value;
+function readLocalConfig() {
+    return JSON.parse(localStorage.getItem("bb_config") || "null");
+}
 
-    const users = await getUsers();
+function writeLocalConfig(cfg) {
+    localStorage.setItem("bb_config", JSON.stringify(cfg));
+}
 
-    if (users[u] && users[u].password === p) {
-        setCurrentUser(u);
-        showGame();
-        updateUI();
+function createLocalBackend() {
+    return {
+        mode: "Local",
+        async getUser(userId) {
+            return readLocalUsers()[userId] || null;
+        },
+        async createUser(userId, password) {
+            const users = readLocalUsers();
+            users[userId] = { id: userId, password, points: 100, online: true, lastSeen: Date.now() };
+            writeLocalUsers(users);
+        },
+        async updateUser(userId, data) {
+            const users = readLocalUsers();
+            users[userId] = { ...(users[userId] || {}), ...data };
+            writeLocalUsers(users);
+        },
+        async ensureGameConfig() {
+            if (!readLocalConfig()) {
+                writeLocalConfig({ minBet: 10, minPointsToPlay: 50, riggedNextResult: null });
+            }
+        },
+        async updateConfig(data) {
+            const next = { ...(readLocalConfig() || {}), ...data };
+            writeLocalConfig(next);
+        },
+        subscribeUsers(cb) {
+            let prev = "";
+            const emit = () => {
+                const users = readLocalUsers();
+                const str = JSON.stringify(users);
+                if (str !== prev) {
+                    prev = str;
+                    cb(users);
+                }
+            };
+            emit();
+            const id = setInterval(emit, 800);
+            window.addEventListener("storage", emit);
+            return () => {
+                clearInterval(id);
+                window.removeEventListener("storage", emit);
+            };
+        },
+        subscribeConfig(cb) {
+            let prev = "";
+            const emit = () => {
+                const cfg = readLocalConfig() || { minBet: 10, minPointsToPlay: 50, riggedNextResult: null };
+                const str = JSON.stringify(cfg);
+                if (str !== prev) {
+                    prev = str;
+                    cb(cfg);
+                }
+            };
+            emit();
+            const id = setInterval(emit, 800);
+            window.addEventListener("storage", emit);
+            return () => {
+                clearInterval(id);
+                window.removeEventListener("storage", emit);
+            };
+        }
+    };
+}
+
+async function createFirebaseBackend() {
+    const [{ initializeApp }, firestore] = await Promise.all([
+        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"),
+        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js")
+    ]);
+
+    const {
+        doc,
+        getDoc,
+        setDoc,
+        updateDoc,
+        collection,
+        onSnapshot,
+        serverTimestamp,
+        getFirestore
+    } = firestore;
+
+    const firebaseConfig = {
+        apiKey: "AIzaSyBgCX09RWBq47Y6bWCIB5IAUj5Ws-I1m-I",
+        authDomain: "betbazzzi-aba25.firebaseapp.com",
+        projectId: "betbazzzi-aba25",
+        storageBucket: "betbazzzi-aba25.firebasestorage.app",
+        messagingSenderId: "644113043164",
+        appId: "1:644113043164:web:5d6d2d0f3fb34cdde16e19",
+        measurementId: "G-6VNTCJEMP9"
+    };
+
+    const app = initializeApp(firebaseConfig);
+    const db = getFirestore(app);
+
+    return {
+        mode: "Firebase",
+        async getUser(userId) {
+            const snap = await getDoc(doc(db, "users", userId));
+            return snap.exists() ? snap.data() : null;
+        },
+        async createUser(userId, password) {
+            await setDoc(doc(db, "users", userId), {
+                id: userId,
+                password,
+                points: 100,
+                online: true,
+                lastSeen: Date.now(),
+                updatedAt: serverTimestamp()
+            });
+        },
+        async updateUser(userId, data) {
+            await updateDoc(doc(db, "users", userId), { ...data, updatedAt: serverTimestamp() });
+        },
+        async ensureGameConfig() {
+            const ref = doc(db, "config", "game");
+            const snap = await getDoc(ref);
+            if (!snap.exists()) {
+                await setDoc(ref, {
+                    minBet: 10,
+                    minPointsToPlay: 50,
+                    riggedNextResult: null,
+                    updatedAt: serverTimestamp()
+                });
+            }
+        },
+        async updateConfig(data) {
+            await updateDoc(doc(db, "config", "game"), { ...data, updatedAt: serverTimestamp() });
+        },
+        subscribeUsers(cb) {
+            return onSnapshot(collection(db, "users"), (snapshot) => {
+                const users = {};
+                snapshot.forEach((docSnap) => {
+                    users[docSnap.id] = docSnap.data();
+                });
+                cb(users);
+            });
+        },
+        subscribeConfig(cb) {
+            return onSnapshot(doc(db, "config", "game"), (snap) => {
+                if (snap.exists()) cb(snap.data());
+            });
+        }
+    };
+}
+
+async function initBackend() {
+    try {
+        backend = await createFirebaseBackend();
+        setBackendLabel("Firebase realtime");
+    } catch (error) {
+        backend = createLocalBackend();
+        setBackendLabel("Local mode");
+        console.warn("Falling back to local mode:", error?.message || error);
+    }
+}
+
+function makeNumberButtons() {
+    numbersWrap.innerHTML = "";
+    WHEEL_NUMBERS.forEach((num) => {
+        const btn = document.createElement("button");
+        btn.className = "num-btn";
+        btn.textContent = num;
+        btn.dataset.num = String(num);
+        btn.addEventListener("click", () => {
+            selectedNumber = num;
+            document.querySelectorAll(".num-btn").forEach((b) => b.classList.remove("selected"));
+            btn.classList.add("selected");
+        });
+        numbersWrap.appendChild(btn);
+    });
+}
+
+function drawWheel(angleOffset = 0) {
+    const radius = canvas.width / 2;
+    const anglePer = (Math.PI * 2) / WHEEL_NUMBERS.length;
+    ctx.clearRect(0, 0, canvas.width, canvas.height);
+
+    ctx.save();
+    ctx.translate(radius, radius);
+    ctx.rotate(angleOffset);
+
+    for (let i = 0; i < WHEEL_NUMBERS.length; i += 1) {
+        const start = i * anglePer;
+        const end = start + anglePer;
+
+        ctx.beginPath();
+        ctx.moveTo(0, 0);
+        ctx.arc(0, 0, radius - 6, start, end);
+        ctx.closePath();
+        ctx.fillStyle = COLORS[i % COLORS.length];
+        ctx.fill();
+
+        ctx.save();
+        ctx.rotate(start + anglePer / 2);
+        ctx.textAlign = "right";
+        ctx.fillStyle = "#fff";
+        ctx.font = "bold 24px sans-serif";
+        ctx.fillText(String(WHEEL_NUMBERS[i]), radius - 20, 8);
+        ctx.restore();
+    }
+
+    ctx.restore();
+
+    ctx.beginPath();
+    ctx.arc(radius, radius, 28, 0, Math.PI * 2);
+    ctx.fillStyle = "#0f172a";
+    ctx.fill();
+    ctx.strokeStyle = "#fff";
+    ctx.lineWidth = 3;
+    ctx.stroke();
+}
+
+function animateSpinTo(resultNumber) {
+    const index = WHEEL_NUMBERS.indexOf(resultNumber);
+    const anglePer = (Math.PI * 2) / WHEEL_NUMBERS.length;
+    const targetAngle = (Math.PI * 1.5) - (index * anglePer + anglePer / 2);
+    const extraSpins = Math.PI * 2 * 6;
+    const finalAngle = extraSpins + targetAngle;
+
+    const duration = 2500;
+    const start = performance.now();
+    const startAngle = currentAngle % (Math.PI * 2);
+
+    return new Promise((resolve) => {
+        function step(timestamp) {
+            const progress = Math.min((timestamp - start) / duration, 1);
+            const easeOut = 1 - Math.pow(1 - progress, 3);
+            currentAngle = startAngle + finalAngle * easeOut;
+            drawWheel(currentAngle);
+
+            if (progress < 1) {
+                requestAnimationFrame(step);
+            } else {
+                currentAngle = currentAngle % (Math.PI * 2);
+                resolve();
+            }
+        }
+        requestAnimationFrame(step);
+    });
+}
+
+async function heartbeat() {
+    if (!currentUser) return;
+    await backend.updateUser(currentUser, { lastSeen: Date.now(), online: true });
+}
+
+function applyHeaderUI() {
+    const user = usersCache[currentUser];
+    document.getElementById("playerName").textContent = currentUser || "";
+    document.getElementById("playerPoints").textContent = user?.points ?? 0;
+    document.getElementById("minBetLabel").textContent = gameConfig.minBet ?? 0;
+    document.getElementById("minPointsLabel").textContent = gameConfig.minPointsToPlay ?? 0;
+
+    const now = Date.now();
+    const onlineCount = Object.values(usersCache).filter((u) => {
+        if (!u.online) return false;
+        if (!u.lastSeen) return true;
+        return now - u.lastSeen < 60000;
+    }).length;
+    document.getElementById("onlineCount").textContent = String(onlineCount);
+
+    const adminBtn = document.getElementById("toggleAdmin");
+    if (isAdmin(currentUser)) {
+        adminBtn.classList.remove("hidden");
     } else {
-        alert("Wrong login");
+        adminBtn.classList.add("hidden");
+        document.getElementById("adminPanel").classList.add("hidden");
     }
-});
+}
 
-// REGISTER
-document.getElementById("registerForm").addEventListener("submit", async (e) => {
-    e.preventDefault();
+function fillAdminUsers() {
+    const select = document.getElementById("adminSelectPlayer");
+    select.innerHTML = "";
+    Object.keys(usersCache).sort().forEach((userId) => {
+        const option = document.createElement("option");
+        option.value = userId;
+        option.textContent = `${userId} (${usersCache[userId].points ?? 0} pts)`;
+        select.appendChild(option);
+    });
+}
 
-    const u = regUsername.value;
-    const p = regPassword.value;
+async function startSession(userId) {
+    currentUser = userId;
+    saveSession(userId);
+    showGameScreen();
+    await backend.updateUser(userId, { online: true, lastSeen: Date.now() });
+    if (heartbeatTimer) clearInterval(heartbeatTimer);
+    heartbeatTimer = setInterval(heartbeat, 15000);
+    applyHeaderUI();
+}
 
-    const users = await getUsers();
+async function handleRegister(event) {
+    event.preventDefault();
+    const userId = document.getElementById("regId").value.trim();
+    const password = document.getElementById("regPassword").value.trim();
 
-    if (users[u]) {
-        alert("User exists");
+    if (!userId || !password) {
+        setMessage("ID and password are required.");
+        return;
+    }
+    if (!/^[a-zA-Z0-9_]{3,24}$/.test(userId)) {
+        setMessage("ID must be 3-24 characters (letters, numbers, underscore).");
         return;
     }
 
-    await saveUser(u, { password: p, points: 100 });
+    const existing = await backend.getUser(userId);
+    if (existing) {
+        setMessage("Player ID already exists.");
+        return;
+    }
 
-    setCurrentUser(u);
-    showGame();
-    updateUI();
-});
+    await backend.createUser(userId, password);
+    setMessage("Account created.", false);
+    await startSession(userId);
+}
 
-// UPDATE UI
-async function updateUI() {
-    const u = getCurrentUser();
-    const users = await getUsers();
+async function handleLogin(event) {
+    event.preventDefault();
+    const userId = document.getElementById("loginId").value.trim();
+    const password = document.getElementById("loginPassword").value.trim();
 
-    playerName.textContent = u;
-    playerPoints.textContent = users[u].points;
+    const user = await backend.getUser(userId);
+    if (!user || user.password !== password) {
+        setMessage("Invalid ID or password.");
+        return;
+    }
 
-    if (u === "admin") {
-        toggleAdmin.classList.remove("hidden");
+    setMessage("Login successful.", false);
+    await startSession(userId);
+}
+
+async function spin() {
+    if (isSpinning) return;
+    const bet = Number(document.getElementById("betAmount").value);
+    const resultEl = document.getElementById("spinResult");
+    const user = usersCache[currentUser];
+
+    if (!selectedNumber) {
+        resultEl.textContent = "Please choose a number first.";
+        return;
+    }
+    if (!Number.isInteger(bet) || bet <= 0) {
+        resultEl.textContent = "Enter a valid bet.";
+        return;
+    }
+    if (bet < (gameConfig.minBet ?? 1)) {
+        resultEl.textContent = `Bet must be at least ${gameConfig.minBet}.`;
+        return;
+    }
+    if ((user?.points ?? 0) < (gameConfig.minPointsToPlay ?? 0)) {
+        resultEl.textContent = `Need ${gameConfig.minPointsToPlay} points minimum to play.`;
+        return;
+    }
+    if ((user?.points ?? 0) < bet) {
+        resultEl.textContent = "Not enough points for this bet.";
+        return;
+    }
+
+    const controlled = Number(gameConfig.riggedNextResult);
+    const result = Number.isInteger(controlled) && controlled >= 1 && controlled <= 10
+        ? controlled
+        : WHEEL_NUMBERS[Math.floor(Math.random() * WHEEL_NUMBERS.length)];
+
+    isSpinning = true;
+    document.getElementById("spinBtn").disabled = true;
+
+    try {
+        await animateSpinTo(result);
+        let nextPoints = user.points - bet;
+
+        if (selectedNumber === result) {
+            nextPoints = user.points + (bet * 9);
+            resultEl.textContent = `🎉 Win! Result: ${result}. You gained ${bet * 9} points.`;
+        } else {
+            resultEl.textContent = `❌ Lose! Result: ${result}. You lost ${bet} points.`;
+        }
+
+        await backend.updateUser(currentUser, { points: Math.max(0, nextPoints) });
+
+        if (controlled) {
+            await backend.updateConfig({ riggedNextResult: null });
+        }
+    } finally {
+        isSpinning = false;
+        document.getElementById("spinBtn").disabled = false;
     }
 }
 
-// LOGOUT
-logoutBtn.onclick = () => {
-    localStorage.removeItem("user");
-    showAuth();
-};
+function setupAuthTabs() {
+    document.querySelectorAll(".tab-btn").forEach((button) => {
+        button.addEventListener("click", () => {
+            document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
+            document.querySelectorAll(".auth-form").forEach((f) => f.classList.remove("active"));
+            button.classList.add("active");
+            document.getElementById(`${button.dataset.tab}Form`).classList.add("active");
+        });
+    });
+}
 
-// NUMBER SELECT
-document.querySelectorAll(".num-btn").forEach(btn => {
-    btn.onclick = () => {
-        selectedNumber = parseInt(btn.dataset.num);
-    };
-});
+async function adminSetPoints() {
+    if (!isAdmin(currentUser)) return;
+    const userId = document.getElementById("adminSelectPlayer").value;
+    const points = Number(document.getElementById("adminPointsInput").value);
+    if (!userId || !Number.isFinite(points) || points < 0) return;
+    await backend.updateUser(userId, { points: Math.floor(points) });
+}
 
-// SPIN
-spinBtn.onclick = async () => {
-    const u = getCurrentUser();
-    const users = await getUsers();
-    const bet = parseInt(betAmount.value);
+async function adminSaveRules() {
+    if (!isAdmin(currentUser)) return;
+    const minBet = Number(document.getElementById("adminMinBet").value);
+    const minPoints = Number(document.getElementById("adminMinPoints").value);
+    if (!Number.isFinite(minBet) || minBet < 1 || !Number.isFinite(minPoints) || minPoints < 0) return;
+    await backend.updateConfig({
+        minBet: Math.floor(minBet),
+        minPointsToPlay: Math.floor(minPoints)
+    });
+}
 
-    if (!selectedNumber || !bet) return;
+async function adminSaveRig() {
+    if (!isAdmin(currentUser)) return;
+    const value = document.getElementById("rigNumber").value;
+    const num = Number(value);
+    await backend.updateConfig({
+        riggedNextResult: Number.isInteger(num) && num >= 1 && num <= 10 ? num : null
+    });
+}
 
-    let result = riggedNumber || Math.floor(Math.random()*9)+1;
+async function logout() {
+    if (currentUser) {
+        await backend.updateUser(currentUser, { online: false, lastSeen: Date.now() });
+    }
+    if (heartbeatTimer) {
+        clearInterval(heartbeatTimer);
+        heartbeatTimer = null;
+    }
+    currentUser = null;
+    clearSession();
+    showAuthScreen();
+}
 
-    if (selectedNumber === result) {
-        users[u].points += bet * 9;
-        spinResult.textContent = "WIN " + result;
-    } else {
-        users[u].points -= bet;
-        spinResult.textContent = "LOSE " + result;
+window.addEventListener("beforeunload", async () => {
+    if (currentUser && backend) {
+        await backend.updateUser(currentUser, { online: false, lastSeen: Date.now() });
     }
+});
+
+async function init() {
+    makeNumberButtons();
+    drawWheel();
+    setupAuthTabs();
+
+    await initBackend();
+    await backend.ensureGameConfig();
 
-    await saveUser(u, users[u]);
-    updateUI();
-};
+    backend.subscribeUsers((users) => {
+        usersCache = users;
+        applyHeaderUI();
+        fillAdminUsers();
+    });
 
-// ADMIN
-toggleAdmin.onclick = () => {
-    adminPanel.style.display = adminPanel.style.display === "block" ? "none" : "block";
-};
+    backend.subscribeConfig((config) => {
+        gameConfig = config;
+        applyHeaderUI();
+        document.getElementById("rigStatus").textContent = gameConfig.riggedNextResult
+            ? `Current mode: Forced ${gameConfig.riggedNextResult}`
+            : "Current mode: Random";
+        document.getElementById("adminMinBet").value = gameConfig.minBet ?? 10;
+        document.getElementById("adminMinPoints").value = gameConfig.minPointsToPlay ?? 50;
+        document.getElementById("rigNumber").value = gameConfig.riggedNextResult ?? "";
+    });
 
-rigNumber.onchange = (e) => {
-    riggedNumber = parseInt(e.target.value) || 0;
-};
+    document.getElementById("loginForm").addEventListener("submit", handleLogin);
+    document.getElementById("registerForm").addEventListener("submit", handleRegister);
+    document.getElementById("spinBtn").addEventListener("click", spin);
+    document.getElementById("logoutBtn").addEventListener("click", logout);
+    document.getElementById("toggleAdmin").addEventListener("click", () => {
+        document.getElementById("adminPanel").classList.toggle("hidden");
+    });
+    document.getElementById("adminSetPoints").addEventListener("click", adminSetPoints);
+    document.getElementById("adminSaveRules").addEventListener("click", adminSaveRules);
+    document.getElementById("adminSaveRig").addEventListener("click", adminSaveRig);
 
-// INIT
-if (getCurrentUser()) {
-    showGame();
-    updateUI();
+    const session = getSession();
+    if (session) {
+        const user = await backend.getUser(session);
+        if (user) await startSession(session);
+    }
 }
+
+init();
 
EOF
)
