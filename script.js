let selectedNumber = null;
let riggedNumber = 0;

const authScreen = document.getElementById('authScreen');
const gameScreen = document.getElementById('gameScreen');

function showGame() {
    authScreen.classList.remove('active');
    gameScreen.classList.add('active');
}

function showAuth() {
    authScreen.classList.add('active');
    gameScreen.classList.remove('active');
}

async function getUsers() {
    const snapshot = await window.db.collection("users").get();
    const users = {};
    snapshot.forEach(doc => users[doc.id] = doc.data());
    return users;
}

async function saveUser(username, data) {
    await window.db.collection("users").doc(username).set(data);
}

function setCurrentUser(u) {
    localStorage.setItem("user", u);
}

function getCurrentUser() {
    return localStorage.getItem("user");
}

// LOGIN
document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const u = loginUsername.value;
    const p = loginPassword.value;

    const users = await getUsers();

    if (users[u] && users[u].password === p) {
        setCurrentUser(u);
        showGame();
        updateUI();
    } else {
        alert("Wrong login");
    }
});

// REGISTER
document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const u = regUsername.value;
    const p = regPassword.value;

    const users = await getUsers();

    if (users[u]) {
        alert("User exists");
        return;
    }

    await saveUser(u, { password: p, points: 100 });

    setCurrentUser(u);
    showGame();
    updateUI();
});

// UPDATE UI
async function updateUI() {
    const u = getCurrentUser();
    const users = await getUsers();

    playerName.textContent = u;
    playerPoints.textContent = users[u].points;

    if (u === "admin") {
        toggleAdmin.classList.remove("hidden");
    }
}

// LOGOUT
logoutBtn.onclick = () => {
    localStorage.removeItem("user");
    showAuth();
};

// NUMBER SELECT
document.querySelectorAll(".num-btn").forEach(btn => {
    btn.onclick = () => {
        selectedNumber = parseInt(btn.dataset.num);
    };
});

// SPIN
spinBtn.onclick = async () => {
    const u = getCurrentUser();
    const users = await getUsers();
    const bet = parseInt(betAmount.value);

    if (!selectedNumber || !bet) return;

    let result = riggedNumber || Math.floor(Math.random()*9)+1;

    if (selectedNumber === result) {
        users[u].points += bet * 9;
        spinResult.textContent = "WIN " + result;
    } else {
        users[u].points -= bet;
        spinResult.textContent = "LOSE " + result;
    }

    await saveUser(u, users[u]);
    updateUI();
};

// ADMIN
toggleAdmin.onclick = () => {
    adminPanel.style.display = adminPanel.style.display === "block" ? "none" : "block";
};

rigNumber.onchange = (e) => {
    riggedNumber = parseInt(e.target.value) || 0;
};

// INIT
if (getCurrentUser()) {
    showGame();
    updateUI();
}
