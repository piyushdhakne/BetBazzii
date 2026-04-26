// ============================================
// BASIC SAFETY (avoid undefined errors)
// ============================================

function $(id) {
    return document.getElementById(id);
}

// ============================================
// FIREBASE HELPERS
// ============================================

async function getUsers() {
    const snapshot = await window.db.collection("users").get();
    const users = {};
    snapshot.forEach(doc => users[doc.id] = doc.data());
    return users;
}

async function saveUser(username, data) {
    await window.db.collection("users").doc(username).set(data);
}

async function updatePoints(username, points) {
    await window.db.collection("users").doc(username).update({ points });
}

// ============================================
// USER SESSION
// ============================================

function getCurrentUser() {
    return localStorage.getItem("currentUser");
}

function setCurrentUser(username) {
    localStorage.setItem("currentUser", username);
}

// ============================================
// REALTIME PLAYER
// ============================================

function listenToUser(username) {
    window.db.collection("users").doc(username)
    .onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        $("playerName").textContent = username;
        $("playerPoints").textContent = data.points;
    });
}

// ============================================
// ADMIN LIVE USERS
// ============================================

function listenAllUsers() {
    window.db.collection("users").onSnapshot(snapshot => {
        const list = $("playerList");
        const select = $("adminSelectPlayer");

        if (!list || !select) return;

        list.innerHTML = "";
        select.innerHTML = "";

        snapshot.forEach(doc => {
            const user = doc.data();
            const name = doc.id;

            const div = document.createElement("div");
            div.textContent = `${name} - ${user.points}`;
            list.appendChild(div);

            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    });
}

// ============================================
// FORCE RESULT
// ============================================

let forcedResult = 0;

const forceInput = document.getElementById("forceResult");
const forceStatus = document.getElementById("forceStatus");

if (forceInput) {
    forceInput.addEventListener("change", (e) => {
        forcedResult = parseInt(e.target.value) || 0;

        if (forceStatus) {
            forceStatus.textContent =
                forcedResult === 0 ? "Mode: Random" : "Mode: Forced: " + forcedResult;
        }
    });
}

// ============================================
// SHARED GAME
// ============================================

async function spinGame(result, forced) {
    await window.db.collection("game").doc("current").set({
        result,
        forced,
        time: Date.now()
    });
}

function listenGame() {
    window.db.collection("game").doc("current")
    .onSnapshot(doc => {
        if (!doc.exists) return;

        const data = doc.data();
        let text = "Result: " + data.result;

        if (data.forced) text += " (Admin Override)";

        $("spinResult").textContent = text;
    });
}

// ============================================
// BET SYSTEM
// ============================================

let selectedNumber = null;
let bettingOpen = true;

document.querySelectorAll(".num-btn").forEach(btn => {
    btn.onclick = () => {
        selectedNumber = parseInt(btn.dataset.num);
        $("selectedNum").textContent = selectedNumber;
    };
});

async function placeBet(user, number, amount) {
    await window.db.collection("bets").doc(user).set({
        number,
        amount
    });
}

if ($("placeBetBtn")) {
    $("placeBetBtn").onclick = async () => {
        if (!bettingOpen) return alert("Betting closed");

        const user = getCurrentUser();
        const amount = parseInt($("betAmount").value);

        if (!selectedNumber || amount <= 0) return;

        await placeBet(user, selectedNumber, amount);
        alert("Bet placed!");
    };
}

// ============================================
// PROCESS BETS
// ============================================

async function processBets(result) {
    const users = await getUsers();
    const bets = await window.db.collection("bets").get();

    bets.forEach(async doc => {
        const username = doc.id;
        const bet = doc.data();
        const user = users[username];

        if (!user) return;

        if (bet.number === result) {
            user.points += bet.amount * 8;
        } else {
            user.points -= bet.amount;
        }

        await updatePoints(username, user.points);
    });

    // clear bets
    const all = await window.db.collection("bets").get();
    all.forEach(async d => {
        await window.db.collection("bets").doc(d.id).delete();
    });
}

// ============================================
// AUTH
// ============================================

$("loginForm").onsubmit = async (e) => {
    e.preventDefault();

    const username = $("loginUsername").value.trim().toLowerCase();
    const password = $("loginPassword").value;

    const users = await getUsers();

    if (users[username] && users[username].password === password) {
        setCurrentUser(username);
        showGameScreen();
        listenToUser(username);
    } else {
        $("authError").textContent = "Invalid login";
    }
};

$("registerForm").onsubmit = async (e) => {
    e.preventDefault();

    const username = $("regUsername").value.trim().toLowerCase();
    const password = $("regPassword").value;

    const users = await getUsers();

    if (users[username]) return;

    await saveUser(username, { password, points: 100 });

    setCurrentUser(username);
    showGameScreen();
    listenToUser(username);
};

// ============================================
// SCREEN
// ============================================

function showGameScreen() {
    $("authScreen").classList.remove("active");
    $("gameScreen").classList.add("active");

    const user = getCurrentUser();

    if (user === "admin") {
        $("toggleAdmin").classList.remove("hidden");
        listenAllUsers();
    } else {
        $("toggleAdmin").classList.add("hidden");
    }

    listenGame();
}

function showAuthScreen() {
    $("authScreen").classList.add("active");
    $("gameScreen").classList.remove("active");
}

// ============================================
// SPIN (ADMIN)
// ============================================

$("spinBtn").onclick = async () => {

    if (getCurrentUser() !== "admin") {
        alert("Admin only");
        return;
    }

    bettingOpen = false;

    let result = forcedResult !== 0
        ? forcedResult
        : Math.floor(Math.random() * 9) + 1;

    const isForced = forcedResult !== 0;

    forcedResult = 0;

    await spinGame(result, isForced);
    await processBets(result);

    bettingOpen = true;
};

// ============================================
// ADMIN POINT CONTROL
// ============================================

async function modifyPoints(type) {
    const user = $("adminSelectPlayer").value;
    const amount = parseInt($("adminPointsInput").value);

    const users = await getUsers();
    const u = users[user];

    if (!u || isNaN(amount)) return;

    if (type === "add") u.points += amount;
    if (type === "remove") u.points -= amount;
    if (type === "set") u.points = amount;

    await updatePoints(user, u.points);
}

$("adminAddPoints").onclick = () => modifyPoints("add");
$("adminRemovePoints").onclick = () => modifyPoints("remove");
$("adminSetPoints").onclick = () => modifyPoints("set");

// ============================================
// ROUND SYSTEM
// ============================================

let timeLeft = 10;

function startRound() {
    bettingOpen = true;
    timeLeft = 10;

    const timer = setInterval(async () => {
        timeLeft--;

        if ($("timerDisplay")) {
            $("timerDisplay").textContent = "Time: " + timeLeft;
        }

        if (timeLeft <= 0) {
            clearInterval(timer);
            $("spinBtn").click();
            setTimeout(startRound, 4000);
        }
    }, 1000);
}

// ============================================
// INIT
// ============================================

function init() {
    const user = getCurrentUser();

    if (user) {
        showGameScreen();
        listenToUser(user);
        startRound();
    } else {
        showAuthScreen();
    }
}

init();
