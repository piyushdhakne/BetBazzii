// ============================================
// FIREBASE FUNCTIONS
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
// REAL-TIME LISTENER (MULTIPLAYER 🔥)
// ============================================

function listenToUser(username) {
    const ref = window.db.collection("users").doc(username);

    ref.onSnapshot((doc) => {
        if (!doc.exists) return;

        const user = doc.data();

        document.getElementById("playerPoints").textContent = user.points;
        document.getElementById("playerName").textContent = username;
    });
}

// ============================================
// AUTH
// ============================================

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = loginUsername.value.trim().toLowerCase();
    const password = loginPassword.value;

    const users = await getUsers();

    if (users[username] && users[username].password === password) {
        setCurrentUser(username);
        showGameScreen();
        listenToUser(username); // 🔥 LIVE START
    } else {
        authError.textContent = 'Invalid username or password!';
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = regUsername.value.trim().toLowerCase();
    const password = regPassword.value;

    const users = await getUsers();

    if (users[username]) {
        authError.textContent = 'Username already exists!';
        return;
    }

    await saveUser(username, {
        username: username,
        password: password,
        points: 100
    });

    setCurrentUser(username);
    showGameScreen();
    listenToUser(username);
});

// ============================================
// CURRENT USER STORAGE
// ============================================

function getCurrentUser() {
    return localStorage.getItem('currentUser');
}

function setCurrentUser(username) {
    localStorage.setItem('currentUser', username);
}

function clearCurrentUser() {
    localStorage.removeItem('currentUser');
}

// ============================================
// LOGOUT
// ============================================

logoutBtn.addEventListener('click', () => {
    clearCurrentUser();
    location.reload();
});

// ============================================
// BETTING SYSTEM
// ============================================

let selectedNumber = null;

numBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        selectedNumber = parseInt(btn.dataset.num);
        selectedNum.textContent = selectedNumber;
    });
});

spinBtn.addEventListener('click', async () => {

    const username = getCurrentUser();
    const users = await getUsers();
    const user = users[username];

    const betAmount = parseInt(betAmount.value);

    if (!selectedNumber || betAmount <= 0) return;

    if (betAmount > user.points) {
        spinResult.textContent = "Not enough points";
        return;
    }

    const winningNumber = Math.floor(Math.random() * 9) + 1;

    if (selectedNumber === winningNumber) {
        user.points += betAmount * 8;
        spinResult.textContent = `WIN! Number ${winningNumber}`;
    } else {
        user.points -= betAmount;
        spinResult.textContent = `LOSE! Number ${winningNumber}`;
    }

    await updatePoints(username, user.points);
});

// ============================================
// ADMIN PANEL
// ============================================

async function updateAdminPanel() {
    const users = await getUsers();

    playerList.innerHTML = "";
    adminSelectPlayer.innerHTML = "";

    Object.keys(users).forEach(username => {
        const user = users[username];

        const div = document.createElement("div");
        div.innerHTML = `${username} - ${user.points}`;
        playerList.appendChild(div);

        const option = document.createElement("option");
        option.value = username;
        option.textContent = username;
        adminSelectPlayer.appendChild(option);
    });
}

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

    updateAdminPanel();
}

// buttons
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
        listenToUser(user); // 🔥 important
    } else {
        showAuthScreen();
    }
}

init();
