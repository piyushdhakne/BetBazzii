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
// CURRENT USER
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

        const user = doc.data();
        playerName.textContent = username;
        playerPoints.textContent = user.points;
    });
}

// ============================================
// REALTIME ADMIN PANEL
// ============================================

function listenAllUsers() {
    window.db.collection("users")
    .onSnapshot(snapshot => {

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
// FORCE RESULT SYSTEM (ADMIN CHEAT CONTROL)
// ============================================

let forcedResult = 0;

forceResult.onchange = (e) => {
    forcedResult = parseInt(e.target.value);

    if (forcedResult === 0) {
        forceStatus.textContent = "Mode: Random";
    } else {
        forceStatus.textContent = "Mode: Forced " + forcedResult;
    }
};

// ============================================
// SHARED SPIN SYSTEM
// ============================================

async function spinGame(result, forced) {
    await window.db.collection("game").doc("current").set({
        result: result,
        forced: forced,
        time: Date.now()
    });
}

function listenGame() {
    window.db.collection("game").doc("current")
    .onSnapshot(doc => {
        if (!doc.exists) return;

        const data = doc.data();

        let text = "Result: " + data.result;

        if (data.forced) {
            text += " (Admin Override)";
        }

        spinResult.textContent = text;
    });
}

// ============================================
// AUTH
// ============================================

loginForm.onsubmit = async (e) => {
    e.preventDefault();

    const username = loginUsername.value.trim().toLowerCase();
    const password = loginPassword.value;

    const users = await getUsers();

    if (users[username] && users[username].password === password) {
        setCurrentUser(username);
        showGameScreen();
        listenToUser(username);
    } else {
        authError.textContent = "Invalid login";
    }
};

registerForm.onsubmit = async (e) => {
    e.preventDefault();

    const username = regUsername.value.trim().toLowerCase();
    const password = regPassword.value;

    const users = await getUsers();

    if (users[username]) {
        authError.textContent = "User exists";
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
};

// ============================================
// SCREEN CONTROL
// ============================================

function showGameScreen() {
    authScreen.classList.remove("active");
    gameScreen.classList.add("active");

    const user = getCurrentUser();

    if (user === "admin") {
        toggleAdmin.classList.remove("hidden");
        listenAllUsers();
    } else {
        toggleAdmin.classList.add("hidden");
    }

    listenGame();
}

function showAuthScreen() {
    authScreen.classList.add("active");
    gameScreen.classList.remove("active");
}

// ============================================
// SPIN BUTTON (ADMIN ONLY)
// ============================================

spinBtn.onclick = async () => {

    const user = getCurrentUser();

    if (user !== "admin") {
        alert("Only admin can spin");
        return;
    }

    let result;

    if (forcedResult !== 0) {
        result = forcedResult;
    } else {
        result = Math.floor(Math.random() * 9) + 1;
    }

    const isForced = forcedResult !== 0;

    forcedResult = 0;
    forceResult.value = "0";
    forceStatus.textContent = "Mode: Random";

    await spinGame(result, isForced);
};

// ============================================
// ADMIN POINT CONTROL
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
