// ============================================
// FIREBASE USERS
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
});

// ============================================
// PLAYER DISPLAY
// ============================================

async function updatePlayerDisplay() {
    const username = getCurrentUser();
    const users = await getUsers();

    const user = users[username];

    playerName.textContent = username;
    playerPoints.textContent = user ? user.points : 0;
}

// ============================================
// SPIN LOGIC
// ============================================

spinBtn.addEventListener('click', async () => {

    const username = getCurrentUser();
    const users = await getUsers();
    const user = users[username];

    const betAmount = parseInt(betAmountInput.value);

    if (betAmount > user.points) {
        spinResult.textContent = 'Not enough points!';
        return;
    }

    let winningNumber = Math.floor(Math.random() * 9) + 1;

    const won = selectedNumber === winningNumber;

    if (won) {
        user.points += betAmount * 8;
    } else {
        user.points -= betAmount;
    }

    await saveUser(username, user);

    updatePlayerDisplay();
});

// ============================================
// ADMIN PANEL
// ============================================

async function updateAdminPanel() {
    const users = await getUsers();

    playerList.innerHTML = '';
    adminSelectPlayer.innerHTML = '';

    Object.keys(users).forEach(username => {
        const user = users[username];

        const div = document.createElement('div');
        div.innerHTML = `${username} - ${user.points}`;
        playerList.appendChild(div);

        const option = document.createElement('option');
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

    if (!user) return;

    if (action === 'add') user.points += amount;
    if (action === 'remove') user.points -= amount;
    if (action === 'set') user.points = amount;

    await saveUser(username, user);

    updateAdminPanel();
    updatePlayerDisplay();
}
