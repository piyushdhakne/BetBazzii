// ============================================
// FIREBASE HELPERS
// ============================================

async function getUsers() {
    const snapshot = await window.db.collection("users").get();
    const users = {};
    snapshot.forEach(doc => {
        users[doc.id] = doc.data();
    });
    return users;
}

async function saveUser(username, data) {
    await window.db.collection("users").doc(username).set(data);
}

async function updatePoints(username, points) {
    await window.db.collection("users").doc(username).update({
        points: points
    });
}

// ============================================
// REAL-TIME (MULTIPLAYER)
// ============================================

function listenToUser(username) {
    window.db.collection("users").doc(username)
    .onSnapshot((doc) => {
        if (!doc.exists) return;

        const user = doc.data();
        document.getElementById("playerPoints").textContent = user.points;
        document.getElementById("playerName").textContent = username;
    });
}

function listenAllUsers() {
    window.db.collection("users")
    .onSnapshot((snapshot) => {

        playerList.innerHTML = "";
        adminSelectPlayer.innerHTML = "";

        snapshot.forEach(doc => {
            const user = doc.data();
            const username = doc.id;

            const div = document.createElement("div");
            div.innerHTML = `${username} - ${user.points}`;
            playerList.appendChild(div);

            const option = document.createElement("option");
            option.value = username;
            option.textContent = username;
            adminSelectPlayer.appendChild(option);
        });
    });
}

// ============================================
// CURRENT USER
// ============================================

function getCurrentUser() {
    return localStorage.getItem("currentUser");
}

function setCurrentUser(username) {
    localStorage.setItem("currentUser", username);
}

function clearCurrentUser() {
    localStorage.removeItem("currentUser");
}

// ============================================
// AUTH
// ============================================

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = loginUsername.value.trim().toLowerCase();
    const password = loginPassword.value;

    const users = await getUsers();

    if (users[username] && users[username].password === password) {
        setCurrentUser(username);
        showGameScreen();
        listenToUser(username);
    } else {
        authError.textContent = "Invalid username or password!";
    }
});

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = regUsername.value.trim().toLowerCase();
    const password = regPassword.value;

    const users = await getUsers();

    if (users[username]) {
        authError.textContent = "Username already exists!";
        return;
    }

    await saveUser(username, {
        username,
        password,
        points: 100
    });

    setCurrentUser(username);
    showGameScreen();
    listenToUser(username);
});

// ============================================
// SCREEN CONTROL
// ============================================

function showGameScreen() {
    authScreen.classList.remove("active");
    gameScreen.classList.add("active");

    const currentUser = getCurrentUser();

    if (currentUser === "admin") {
        toggleAdmin.classList.remove("hidden");
        listenAllUsers(); // 🔥 ADMIN LIVE PANEL
    } else {
        toggleAdmin.classList.add("hidden");
    }
}

function showAuthScreen() {
    authScreen.classList.add("active");
    gameScreen.classList.remove("active");
}

// ============================================
// LOGOUT
// ============================================

logoutBtn.addEventListener("click", () => {
    clearCurrentUser();
    location.reload();
});

// ============================================
// BETTING SYSTEM
// ============================================

let selectedNumber = null;

numBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        selectedNumber = parseInt(btn.dataset.num);
        selectedNum.textContent = selectedNumber;
    });
});

spinBtn.addEventListener("click", async () => {

    const username = getCurrentUser();
    const users = await getUsers();
    const user = users[username];

    const bet = parseInt(betAmount.value);

    if (!selectedNumber || bet <= 0) return;

    if (bet > user.points) {
        spinResult.textContent = "Not enough points!";
        return;
    }

    const result = Math.floor(Math.random() * 9) + 1;

    if (result === selectedNumber) {
        user.points += bet * 8;
        spinResult.textContent = `WIN! (${result})`;
    } else {
        user.points -= bet;
        spinResult.textContent = `LOSE! (${result})`;
    }

    await updatePoints(username, user.points);
});

// ============================================
// ADMIN CONTROLS
// ============================================

async function modifyPoints(action) {
    const username = adminSelectPlayer.value;
    const amount = parseInt(adminPointsInput.value);

    const users = await getUsers();
    const user = users[username];

    if (!user || isNaN(amount)) return;

    if (action === "add") user.points += amount;
    if (action === "remove") user.points -= amount;
    if (action === "set") user.points = amount;

    await updatePoints(username, user.points);
}

// Buttons
adminAddPoints.onclick = () => modifyPoints("add");
adminRemovePoints.onclick = () => modifyPoints("remove");
adminSetPoints.onclick = () => modifyPoints("set");

// ============================================
// INIT
// ============================================

function init() {
    const user = getCurrentUser();

    if (user) {
        showGameScreen();
        listenToUser(user);
    } else {
        showAuthScreen();
    }
}

init();
