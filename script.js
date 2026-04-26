// ============================================
// 🎰 FRIEND'S GAMBLING HUB - FULL CONTROL
// ============================================

// Admin credentials (CHANGE THIS!)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

// Default starting points for new players
const DEFAULT_POINTS = 100;

// ============================================
// DATA STORAGE (localStorage based)
// ============================================

function getUsers() {
    const data = localStorage.getItem('gamblingHub_users');
    return data ? JSON.parse(data) : {};
}

function saveUsers(users) {
    localStorage.setItem('gamblingHub_users', JSON.stringify(users));
}

function getHistory() {
    const data = localStorage.getItem('gamblingHub_history');
    return data ? JSON.parse(data) : [];
}

function saveHistory(history) {
    localStorage.setItem('gamblingHub_history', JSON.stringify(history));
}

function getCurrentUser() {
    return localStorage.getItem('gamblingHub_currentUser');
}

function setCurrentUser(username) {
    localStorage.setItem('gamblingHub_currentUser', username);
}

function clearCurrentUser() {
    localStorage.removeItem('gamblingHub_currentUser');
}

// ============================================
// GAME STATE
// ============================================

let selectedNumber = null;
let isSpinning = false;
let riggedNumber = 0; // 0 = no rig, 1-9 = forced outcome

// ============================================
// WHEEL DRAWING
// ============================================

const canvas = document.getElementById('spinWheel');
const ctx = canvas.getContext('2d');
const wheelColors = [
    '#e74c3c', '#3498db', '#2ecc71', 
    '#f39c12', '#9b59b6', '#1abc9c',
    '#e91e63', '#00bcd4', '#ff5722'
];

let currentRotation = 0;

function drawWheel(rotation = 0) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    const sliceAngle = (2 * Math.PI) / 9;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    for (let i = 0; i < 9; i++) {
        const startAngle = i * sliceAngle - Math.PI / 2;
        const endAngle = startAngle + sliceAngle;

        // Draw slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = wheelColors[i];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw number
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px Poppins';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText((i + 1).toString(), radius - 30, 10);
        ctx.restore();
    }

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
}

// ============================================
// AUTHENTICATION
// ============================================

const authScreen = document.getElementById('authScreen');
const gameScreen = document.getElementById('gameScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabBtns = document.querySelectorAll('.tab-btn');
const authError = document.getElementById('authError');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (tab === 'login') {
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        } else {
            registerForm.classList.add('active');
            loginForm.classList.remove('active');
        }
        authError.textContent = '';
    });
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    
    const users = getUsers();
    
    if (users[username] && users[username].password === password) {
        setCurrentUser(username);
        showGameScreen();
    } else {
        authError.textContent = 'Invalid username or password!';
    }
});

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    
    if (username.length < 3) {
        authError.textContent = 'Username must be at least 3 characters!';
        return;
    }
    
    if (password.length < 4) {
        authError.textContent = 'Password must be at least 4 characters!';
        return;
    }
    
    const users = getUsers();
    
    if (users[username]) {
        authError.textContent = 'Username already exists!';
        return;
    }
    
    users[username] = {
        password: password,
        points: DEFAULT_POINTS,
        created: new Date().toISOString()
    };
    
    saveUsers(users);
    setCurrentUser(username);
    showGameScreen();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    clearCurrentUser();
    showAuthScreen();
});

function showAuthScreen() {
    authScreen.classList.add('active');
    gameScreen.classList.remove('active');
    loginForm.reset();
    registerForm.reset();
    authError.textContent = '';
}

function showGameScreen() {
    authScreen.classList.remove('active');
    gameScreen.classList.add('active');
    updatePlayerDisplay();
    drawWheel();
    
    // Show admin button if admin
    const currentUser = getCurrentUser();
    const toggleAdmin = document.getElementById('toggleAdmin');
    
    if (currentUser === ADMIN_USERNAME) {
        toggleAdmin.classList.remove('hidden');
        updateAdminPanel();
    } else {
        toggleAdmin.classList.add('hidden');
    }
}

function updatePlayerDisplay() {
    const username = getCurrentUser();
    const users = getUsers();
    const user = users[username];
    
    document.getElementById('playerName').textContent = username;
    document.getElementById('playerPoints').textContent = user ? user.points : 0;
}

// ============================================
// BETTING LOGIC
// ============================================

const numBtns = document.querySelectorAll('.num-btn');
const betAmountInput = document.getElementById('betAmount');
const spinBtn = document.getElementById('spinBtn');
const selectedNumDisplay = document.getElementById('selectedNum');
const betDisplay = document.getElementById('betDisplay');
const spinResult = document.getElementById('spinResult');

numBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        numBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedNumber = parseInt(btn.dataset.num);
        selectedNumDisplay.textContent = selectedNumber;
        updateSpinButton();
    });
});

betAmountInput.addEventListener('input', () => {
    betDisplay.textContent = betAmountInput.value || 0;
    updateSpinButton();
});

function updateSpinButton() {
    const username = getCurrentUser();
    const users = getUsers();
    const user = users[username];
    const betAmount = parseInt(betAmountInput.value) || 0;
    
    spinBtn.disabled = !(
        selectedNumber !== null && 
        betAmount > 0 && 
        betAmount <= user.points &&
        !isSpinning
    );
}

// ============================================
// SPIN THE WHEEL
// ============================================

spinBtn.addEventListener('click', () => {
    if (isSpinning) return;
    
    const username = getCurrentUser();
    const users = getUsers();
    const user = users[username];
    const betAmount = parseInt(betAmountInput.value);
    
    if (betAmount > user.points) {
        spinResult.textContent = 'Not enough points!';
        spinResult.className = 'result-display lose';
        return;
    }
    
    isSpinning = true;
    spinBtn.disabled = true;
    spinResult.textContent = '';
    spinResult.className = 'result-display';
    
    // Determine result (rigged or random)
    let winningNumber;
    if (riggedNumber > 0) {
        winningNumber = riggedNumber;
        // Reset rig after use (one-time rig)
        riggedNumber = 0;
        document.getElementById('rigNumber').value = '0';
        document.getElementById('rigStatus').textContent = 'Status: Random Mode';
    } else {
        // True random 1-9
        winningNumber = Math.floor(Math.random() * 9) + 1;
    }
    
    // Calculate spin animation
    // Each slice is 40 degrees (360/9)
    // We need to land on the winning number
    // The pointer is at the top, so we calculate where the number needs to be
    const sliceAngle = 360 / 9;
    const targetAngle = (9 - winningNumber) * sliceAngle + sliceAngle / 2;
    const spins = 5 + Math.random() * 3; // 5-8 full rotations
    const totalRotation = spins * 360 + targetAngle;
    
    // Animate the wheel
    animateSpin(totalRotation, () => {
        isSpinning = false;
        
        // Check win/lose
        const won = selectedNumber === winningNumber;
        
        if (won) {
            const winnings = betAmount * 9;
            user.points += winnings - betAmount; // Net gain
            spinResult.innerHTML = `🎉 WINNER! Number ${winningNumber}!<br>You won ${winnings} points!`;
            spinResult.className = 'result-display win';
        } else {
            user.points -= betAmount;
            spinResult.innerHTML = `💔 Number ${winningNumber}. You lost ${betAmount} points.`;
            spinResult.className = 'result-display lose';
        }
        
        // Save and update
        users[username] = user;
        saveUsers(users);
        updatePlayerDisplay();
        updateSpinButton();
        
        // Log history
        const history = getHistory();
        history.unshift({
            player: username,
            bet: betAmount,
            selected: selectedNumber,
            result: winningNumber,
            won: won,
            time: new Date().toLocaleString()
        });
        if (history.length > 50) history.pop();
        saveHistory(history);
        
        if (getCurrentUser() === ADMIN_USERNAME) {
            updateAdminPanel();
        }
    });
});

function animateSpin(targetDegrees, callback) {
    const startRotation = currentRotation;
    const totalChange = targetDegrees;
    const duration = 4000; // 4 seconds
    const startTime = performance.now();
    
    function easeOut(t) {
        return 1 - Math.pow(1 - t, 4);
    }
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOut(progress);
        
        currentRotation = startRotation + totalChange * easedProgress;
        drawWheel(currentRotation);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            currentRotation = currentRotation % 360;
            callback();
        }
    }
    
    requestAnimationFrame(animate);
}

// ============================================
// ADMIN PANEL
// ============================================

const toggleAdmin = document.getElementById('toggleAdmin');
const adminPanel = document.getElementById('adminPanel');

toggleAdmin.addEventListener('click', () => {
    adminPanel.classList.toggle('visible');
    updateAdminPanel();
});

function updateAdminPanel() {
    const users = getUsers();
    const history = getHistory();
    
    // Player list
    const playerList = document.getElementById('playerList');
    const adminSelect = document.getElementById('adminSelectPlayer');
    
    playerList.innerHTML = '';
    adminSelect.innerHTML = '';
    
    Object.keys(users).forEach(username => {
        const user = users[username];
        
        // Player list item
        const item = document.createElement('div');
        item.className = 'player-item';
        item.innerHTML = `
            <span>${username}</span>
            <span>💰 ${user.points} pts</span>
        `;
        playerList.appendChild(item);
        
        // Dropdown option
        const option = document.createElement('option');
        option.value = username;
        option.textContent = `${username} (${user.points} pts)`;
        adminSelect.appendChild(option);
    });
    
    // History list
    const historyList = document.getElementById('gameHistory');
    historyList.innerHTML = '';
    
    history.slice(0, 20).forEach(entry => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <span>${entry.player}: ${entry.selected} → ${entry.result}</span>
            <span style="color: ${entry.won ? '#2ecc71' : '#e74c3c'}">${entry.won ? '+' + (entry.bet * 9) : '-' + entry.bet}</span>
        `;
        historyList.appendChild(item);
    });
}

// Admin point controls
document.getElementById('adminAddPoints').addEventListener('click', () => {
    modifyPoints('add');
});

document.getElementById('adminRemovePoints').addEventListener('click', () => {
    modifyPoints('remove');
});

document.getElementById('adminSetPoints').addEventListener('click', () => {
    modifyPoints('set');
});

function modifyPoints(action) {
    const username = document.getElementById('adminSelectPlayer').value;
    const amount = parseInt(document.getElementById('adminPointsInput').value);
    
    if (!username || isNaN(amount)) return;
    
    const users = getUsers();
    
    if (!users[username]) return;
    
    switch (action) {
        case 'add':
            users[username].points += amount;
            break;
        case 'remove':
            users[username].points = Math.max(0, users[username].points - amount);
            break;
        case 'set':
            users[username].points = Math.max(0, amount);
            break;
    }
    
    saveUsers(users);
    updateAdminPanel();
    
    if (getCurrentUser() === username) {
        updatePlayerDisplay();
        updateSpinButton();
    }
    
    document.getElementById('adminPointsInput').value = '';
}

// Rig control
document.getElementById('rigNumber').addEventListener('change', (e) => {
    riggedNumber = parseInt(e.target.value);
    const status = document.getElementById('rigStatus');
    
    if (riggedNumber > 0) {
        status.textContent = `Status: Next spin forced to ${riggedNumber}`;
        status.style.color = '#e74c3c';
    } else {
        status.textContent = 'Status: Random Mode';
        status.style.color = '#2ecc71';
    }
});

// Clear history
document.getElementById('clearHistory').addEventListener('click', () => {
    localStorage.removeItem('gamblingHub_history');
    updateAdminPanel();
});

// ============================================
// INITIALIZATION
// ============================================

function init() {
    // Check if already logged in
    const currentUser = getCurrentUser();
    const users = getUsers();
    
    // Ensure admin exists
    if (!users[ADMIN_USERNAME]) {
        users[ADMIN_USERNAME] = {
            password: ADMIN_PASSWORD,
            points: 99999,
            created: new Date().toISOString()
        };
        saveUsers(users);
    }
    
    if (currentUser && users[currentUser]) {
        showGameScreen();
    } else {
        showAuthScreen();
    }
    
    drawWheel();
}

init();
                         
