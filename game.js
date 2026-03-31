/**
 * Premium Tetris Game Logic
 * 프리미엄 테트리스 게임 로직
 */

const canvas = document.getElementById('tetris-board');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece');
const nextContext = nextCanvas.getContext('2d');
const mNextCanvas = document.getElementById('m-next-piece');
const mNextContext = mNextCanvas ? mNextCanvas.getContext('2d') : null;

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

// 네온 컬러 팔레트 (Neon Color Palette)
const COLORS = [
    null,
    '#00f2ff', // I - Cyan
    '#004dff', // J - Blue
    '#ff8a00', // L - Orange
    '#ffe600', // O - Yellow
    '#00ff29', // S - Green
    '#bc13fe', // T - Purple
    '#ff005c'  // Z - Red
];

// 테트리미노 모양 (Tetromino Shapes)
const PIECES = [
    null,
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
    [[2, 0, 0], [2, 2, 2], [0, 0, 0]],                         // J
    [[0, 0, 3], [3, 3, 3], [0, 0, 0]],                         // L
    [[4, 4], [4, 4]],                                         // O
    [[0, 5, 5], [5, 5, 0], [0, 0, 0]],                         // S
    [[0, 6, 0], [6, 6, 6], [0, 0, 0]],                         // T
    [[7, 7, 0], [0, 7, 7], [0, 0, 0]]                          // Z
];

let board = createMatrix(COLS, ROWS);
let score = 0;
let lines = 0; // 총 제거한 줄 수
let level = 1;
let combo = 0;
let gameOver = false;
let paused = false;
let gameStarted = false;

// 파티클 시스템 (Particle System)
let particles = [];

// 화면 흔들림 설정 (Screenshake Settings)
let shakeDuration = 0;
let shakeIntensity = 0;

// 콤보 팝업 설정 (Combo Popup)
let comboText = { text: '', opacity: 0, scale: 1 };

// 랭킹 키 (LocalStorage Key)
const RANK_KEY = 'tetris_rankings';

// 7-Bag 시스템 (7-Bag System)
let pieceBag = [];

/**
 * 7-Bag에서 다음 조각 가져오기
 * Get next piece from 7-bag
 */
function getNextPiece() {
    if (pieceBag.length === 0) {
        pieceBag = [1, 2, 3, 4, 5, 6, 7];
        // Shuffle bag
        for (let i = pieceBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pieceBag[i], pieceBag[j]] = [pieceBag[j], pieceBag[i]];
        }
    }
    return createPiece(pieceBag.pop());
}

// 게임 설정 (Game Settings)
const dropIntervals = [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100]; // 1~10단계 속도
const linesPerLevel = 20; // 레벨업 기준 줄 수 (테스트 완료 후 20줄로 원복)

const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    next: null,
};

/**
 * 게임 보드 행렬 생성
 * Create game board matrix
 */
function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

/**
 * 테트리미노 조각 생성
 * Create Tetromino piece
 */
function createPiece(type) {
    return PIECES[type];
}

/**
 * 조각 렌더링
 * Draw matrix/piece
 */
function drawMatrix(matrix, offset, ctx = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(x + offset.x, y + offset.y, COLORS[value], ctx);
            }
        });
    });
}

/**
 * 개별 블록 렌더링 (그라데이션 및 네온 효과)
 * Draw individual block with gradient and neon effect
 */
function drawBlock(x, y, color, ctx) {
    const size = ctx === nextContext ? 25 : BLOCK_SIZE;
    const padding = ctx === nextContext ? 1 : 1;
    const px = x * size;
    const py = y * size;

    // 네온 광채 효과 (Neon Glow)
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    
    // 메인 블록 채우기
    ctx.fillStyle = color;
    ctx.fillRect(px + padding, py + padding, size - padding * 2, size - padding * 2);

    // 하이라이트 효과 (Highlight)
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(px + padding, py + padding, size - padding * 2, (size - padding * 2) / 4);
    
    // 테두리
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeRect(px, py, size, size);
}

/**
 * 전체 화면 렌더링
 * Main draw function
 */
function draw() {
    context.save();
    
    // 화면 흔들림 적용 (Apply Screenshake)
    if (shakeDuration > 0) {
        const dx = (Math.random() - 0.5) * shakeIntensity;
        const dy = (Math.random() - 0.5) * shakeIntensity;
        context.translate(dx, dy);
        shakeDuration -= 16; // 대략적인 frame 시간
    }

    // 배경 지우기
    context.fillStyle = 'rgba(11, 14, 20, 1)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // 가이드 라인 (Grid Lines) - 더 선명하게 상향
    context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 0; i <= COLS; i++) {
        context.beginPath();
        context.moveTo(i * BLOCK_SIZE, 0);
        context.lineTo(i * BLOCK_SIZE, canvas.height);
        context.stroke();
    }
    for (let i = 0; i <= ROWS; i++) {
        context.beginPath();
        context.moveTo(0, i * BLOCK_SIZE);
        context.lineTo(canvas.width, i * BLOCK_SIZE);
        context.stroke();
    }

    drawMatrix(board, { x: 0, y: 0 });
    
    if (player.matrix) {
        drawMatrix(player.matrix, player.pos);
    }
    
    // 파티클 그리기 (Draw Particles)
    updateParticles();
    
    // 콤보 텍스트 그리기 (Draw Combo Text)
    drawCombo();

    context.restore();
    
    drawNext();
    if (mNextContext) drawNextMobile();
}

/**
 * 모바일 다음 블록 미리보기 렌더링
 * Draw next piece preview for mobile
 */
function drawNextMobile() {
    mNextContext.fillStyle = 'rgba(255, 255, 255, 0.05)';
    mNextContext.fillRect(0, 0, mNextCanvas.width, mNextCanvas.height);
    
    if (player.next) {
        // 모바일 헤더용 작은 크기로 렌더링
        const size = 8; // 작은 블록 크기
        const offset = {
            x: (mNextCanvas.width / size - player.next[0].length) / 2,
            y: (mNextCanvas.height / size - player.next.length) / 2
        };
        
        player.next.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    const px = (x + offset.x) * size;
                    const py = (y + offset.y) * size;
                    mNextContext.fillStyle = COLORS[value];
                    mNextContext.fillRect(px + 1, py + 1, size - 1, size - 1);
                }
            });
        });
    }
}

/**
 * 파티클 클래스 (Particle Class)
 */
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.alpha = 1;
        this.color = color;
        this.size = Math.random() * 5 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // 중력
        this.alpha -= 0.02;
    }

    draw() {
        context.globalAlpha = this.alpha;
        context.fillStyle = this.color;
        context.shadowBlur = 5;
        context.shadowColor = this.color;
        context.fillRect(this.x, this.y, this.size, this.size);
        context.shadowBlur = 0;
        context.globalAlpha = 1;
    }
}

function createParticles(y, color) {
    for (let x = 0; x < COLS; x++) {
        for (let i = 0; i < 3; i++) {
            particles.push(new Particle(x * BLOCK_SIZE + BLOCK_SIZE/2, y * BLOCK_SIZE + BLOCK_SIZE/2, color));
        }
    }
}

function updateParticles() {
    particles = particles.filter(p => p.alpha > 0);
    particles.forEach(p => {
        p.update();
        p.draw();
    });
}

function startShake(duration, intensity) {
    shakeDuration = duration;
    shakeIntensity = intensity;
}

function drawCombo() {
    if (comboText.opacity > 0) {
        context.save();
        context.translate(canvas.width / 2, canvas.height / 2);
        context.scale(comboText.scale, comboText.scale);
        context.font = 'bold 40px Outfit';
        context.fillStyle = `rgba(0, 242, 255, ${comboText.opacity})`;
        context.textAlign = 'center';
        context.shadowBlur = 15;
        context.shadowColor = '#00f2ff';
        context.fillText(comboText.text, 0, 0);
        context.restore();
        
        comboText.opacity -= 0.01;
        comboText.scale += 0.005;
    }
}

function drawNext() {
    nextContext.fillStyle = 'rgba(11, 14, 20, 0.8)';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (player.next) {
        // 중앙 정렬을 위한 오프셋 계산
        const offset = {
            x: (nextCanvas.width / 25 - player.next[0].length) / 2,
            y: (nextCanvas.height / 25 - player.next.length) / 2
        };
        drawMatrix(player.next, offset, nextContext);
    }
}

/**
 * 충돌 감지
 * Collision detection
 */
function collide(board, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

/**
 * 보드에 조각 고정
 * Merge player matrix into board
 */
function merge(board, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

/**
 * 회전 로직
 * Rotate matrix
 */
function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [
                matrix[x][y],
                matrix[y][x],
            ] = [
                matrix[y][x],
                matrix[x][y],
            ];
        }
    }
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

/**
 * 플레이어 조각 회전 (벽 차기 포함)
 * Player rotate with wall kick
 */
function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(board, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

/**
 * 플레이어 드롭
 * Player drop
 */
function playerDrop() {
    player.pos.y++;
    if (collide(board, player)) {
        player.pos.y--;
        merge(board, player);
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

/**
 * 하드 드롭
 * Hard drop
 */
function playerHardDrop() {
    let dist = 0;
    while (!collide(board, player)) {
        player.pos.y++;
        dist++;
    }
    player.pos.y--;
    
    if (dist > 0) {
        startShake(100, 5); // 하드 드롭 시 짧은 진동
    }
    
    merge(board, player);
    playerReset();
    arenaSweep();
    updateScore();
    dropCounter = 0;
}

/**
 * 가로 이동
 * Player move
 */
function playerMove(dir) {
    player.pos.x += dir;
    if (collide(board, player)) {
        player.pos.x -= dir;
    }
}

/**
 * 새로운 조각 생성 및 게임 오버 체크
 * Reset player and check game over
 */
function playerReset() {
    if (!player.next) {
        player.next = getNextPiece();
    }
    
    player.matrix = player.next;
    player.next = getNextPiece();
    
    player.pos.y = 0;
    player.pos.x = (board[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    
    if (collide(board, player)) {
        handleGameOver();
    }
}

/**
 * 줄 삭제 및 점수 계산
 * Sweep full lines and calculate score
 */
function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = board.length - 1; y > 0; --y) {
        for (let x = 0; x < board[y].length; ++x) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }

        // 파티클 생성 전 색상 가져오기
        const rowColor = COLORS[board[y].find(val => val !== 0)];
        createParticles(y, rowColor);

        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        ++y;
        rowCount++;
    }

    if (rowCount > 0) {
        combo++;
        startShake(200, rowCount * 3); // 줄 제거 시 진동 (줄 수에 따라 강도 증가)
        
        if (combo > 1) {
            comboText = {
                text: `${combo} COMBO!`,
                opacity: 1,
                scale: 1
            };
        }

        let addedScore = 0;
        switch(rowCount) {
            case 1: addedScore = 1000; break;
            case 2: addedScore = 3000; break;
            case 3: addedScore = 6000; break;
            case 4: addedScore = 8000; break;
            default: addedScore = rowCount * 1000;
        }
        
        // 콤보 보너스 (콤보당 10% 추가)
        if (combo > 1) {
            addedScore += Math.floor(addedScore * (combo - 1) * 0.1);
        }
        
        score += addedScore;
        lines += rowCount;
        checkLevelUp();
    } else {
        combo = 0;
    }
}

/**
 * 함정 블록 생성 (랜덤 위치에 1칸 블록 배치)
 * Add random trap blocks
 */
function addTraps(count) {
    let placed = 0;
    let attempts = 0;
    // 하단부 위주로 함정 배치 (난이도 조절)
    const startRow = Math.max(0, ROWS - 10); 
    
    while (placed < count && attempts < 100) {
        const y = Math.floor(Math.random() * (ROWS - startRow)) + startRow;
        const x = Math.floor(Math.random() * COLS);
        
        if (board[y][x] === 0) {
            board[y][x] = Math.floor(Math.random() * 7) + 1; // 랜덤 색상 블록
            createParticles(y, COLORS[board[y][x]]); // 생성 효과
            placed++;
        }
        attempts++;
    }
    startShake(300, 10); // 함정 생성 시 진동
}

/**
 * 레벨업 체크
 * Check level up
 */
function checkLevelUp() {
    const newLevel = Math.min(10, Math.floor(lines / linesPerLevel) + 1);
    if (newLevel !== level) {
        level = newLevel;
        // 레벨업 보너스: 함정 생성 (레벨에 비례하여 증가)
        const trapCount = level - 1; 
        if (trapCount > 0) {
            setTimeout(() => addTraps(trapCount), 500);
        }
        
        comboText = {
            text: `LEVEL ${level} UP!`,
            opacity: 1,
            scale: 1
        };
    }
}

function updateScore() {
    document.getElementById('score').innerText = score.toLocaleString();
    document.getElementById('level').innerText = level;
    
    // 남은 줄 수 계산 (20 -> 1)
    const linesRemaining = linesPerLevel - (lines % linesPerLevel);
    const linesElement = document.getElementById('lines');
    
    // 5줄 이하일 때만 표시
    if (linesRemaining <= 5) {
        linesElement.innerText = linesRemaining;
        linesElement.parentElement.style.opacity = '1';
    } else {
        linesElement.innerText = '';
        linesElement.parentElement.style.opacity = '0';
    }

    updateMobileStats();
}

/**
 * 모바일 헤더 정보 업데이트
 */
function updateMobileStats() {
    const mLevel = document.getElementById('m-level');
    const mScore = document.getElementById('m-score');
    const mLines = document.getElementById('m-lines');
    
    if (mLevel) mLevel.innerText = level;
    if (mScore) mScore.innerText = score.toLocaleString();
    
    if (mLines) {
        const linesRemaining = linesPerLevel - (lines % linesPerLevel);
        if (linesRemaining <= 5) {
            mLines.innerText = linesRemaining;
            mLines.parentElement.style.opacity = '1';
        } else {
            mLines.innerText = '';
            mLines.parentElement.style.opacity = '0';
        }
    }
}

/**
 * 게임 오버 처리
 * Handle game over
 */
function handleGameOver() {
    gameOver = true;
    document.getElementById('final-score').innerText = score.toLocaleString();
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('rank-input-area').style.display = 'flex';
    showHighScores();
}

let isSaving = false;

async function updateRankings() {
    if (isSaving) return;
    
    const nameInput = document.getElementById('player-name');
    const submitBtn = document.getElementById('submit-score-btn');
    const name = nameInput.value.trim() || '익명';
    const originalBtnText = submitBtn.innerText;

    // Failsafe: 5초 후 무조건 버튼 복구
    const failsafe = setTimeout(() => {
        if (isSaving) {
            isSaving = false;
            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;
            console.warn("Failsafe triggered - Ranking save timed out (5s)");
            alert("저장 시간이 초과되었습니다. 네트워크 상태나 Firebase 설정을 확인해 주세요.");
        }
    }, 5000);

    try {
        isSaving = true;
        submitBtn.innerText = "저장 중...";
        submitBtn.disabled = true;

        console.log("Saving record for:", name, score, level);
        // alert("저장 시도 중..."); // 1단계

        // 클라우드 저장 (Firebase)
        if (window.db && window.fb_addDoc) {
            try {
                // alert("클라우드 전송 시작..."); // 2단계
                await window.fb_addDoc(window.fb_collection(window.db, 'rankings'), {
                    name: name,
                    score: score,
                    level: level,
                    timestamp: window.fb_serverTimestamp ? window.fb_serverTimestamp() : new Date()
                });
                console.log("Cloud Score Saved (v12)");
                alert("기록이 성공적으로 저장되었습니다!");
            } catch (error) {
                console.error("Cloud Save Failed:", error);
                alert("클라우드 저장 실패: " + error.message);
                saveLocalScore(name, score, level);
            }
        } else {
            console.warn("Firebase not initialized, check index.html");
            alert("Firebase가 초기화되지 않았습니다. 로컬에 저장합니다.");
            saveLocalScore(name, score, level);
        }
        
        // 버튼 복구 및 입력창 숨기기
        clearTimeout(failsafe);
        isSaving = false;
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
        document.getElementById('rank-input-area').style.display = 'none';

        // 랭킹 갱신
        await showHighScores();
    } catch (globalError) {
        console.error("Overall error in updateRankings:", globalError);
        alert("치명적 오류 발생: " + globalError.message);
    } finally {
        clearTimeout(failsafe);
        isSaving = false;
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    }
}

/**
 * 로컬 저장소에 점수 저장 (Fallback)
 */
function saveLocalScore(name, score, level) {
    const rankings = JSON.parse(localStorage.getItem(RANK_KEY) || '[]');
    rankings.push({ name, score, level });
    rankings.sort((a, b) => b.score - a.score);
    const top10 = rankings.slice(0, 10);
    localStorage.setItem(RANK_KEY, JSON.stringify(top10));
}

/**
 * 랭킹 목록 표시
 * Display rankings
 */
async function showHighScores() {
    const containers = document.querySelectorAll('.score-list-container');
    let rankings = [];

    // 클라우드에서 데이터 가져오기 시도
    if (window.db && window.fb_getDocs) {
        try {
            // 인덱스 문제 방지를 위해 정렬 없이 가져온 후 클라이언트에서 정렬
            const snapshot = await window.fb_getDocs(window.fb_collection(window.db, 'rankings'));
            rankings = snapshot.docs.map(doc => doc.data());
            rankings.sort((a, b) => (b.score || 0) - (a.score || 0));
            rankings = rankings.slice(0, 10);
        } catch (error) {
            console.error("Cloud Fetch Failed:", error);
            rankings = JSON.parse(localStorage.getItem(RANK_KEY) || '[]');
        }
    } else {
        rankings = JSON.parse(localStorage.getItem(RANK_KEY) || '[]');
    }
    
    // 랭킹 리스트 렌더링
    containers.forEach(container => {
        container.innerHTML = '';
        if (rankings.length === 0) {
            container.innerHTML = '<li class="score-item" style="justify-content:center; color:rgba(255,255,255,0.3);">아직 기록이 없습니다</li>';
            return;
        }

        rankings.forEach((entry, index) => {
            const li = document.createElement('li');
            li.classList.add('score-item');
            li.innerHTML = `
                <span class="rank-name">${index + 1}. ${entry.name}</span>
                <span class="rank-level">LV.${entry.level || 1}</span>
                <span class="rank-score">${entry.score.toLocaleString()}</span>
            `;
            container.appendChild(li);
        });
    });
}

// 초기 로딩 시 랭킹 표시 (시작 화면용)
showHighScores();

/**
 * 게임 재시작
 * Restart game
 */
function restartGame() {
    board = createMatrix(COLS, ROWS);
    score = 0;
    lines = 0;
    level = 1;
    combo = 0;
    pieceBag = []; // 가방 초기화
    particles = [];
    comboText.opacity = 0;
    gameOver = false;
    paused = false;
    lastTime = 0; // lastTime 리셋 추가
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('pause-overlay').classList.add('hidden');
    updateScore();
    playerReset();
    update(0);
}

/**
 * 일시정지 토글
 * Toggle pause
 */
function togglePause() {
    if (gameOver) return;
    paused = !paused;
    if (paused) {
        document.getElementById('pause-overlay').classList.remove('hidden');
    } else {
        document.getElementById('pause-overlay').classList.add('hidden');
        update(0);
    }
}

let dropCounter = 0;
let lastTime = 0;

/**
 * 게임 시작 (최초 실행)
 * Start game
 */
function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    document.getElementById('start-screen').classList.add('hidden');
    playerReset();
    updateScore();
    update();
}

/**
 * 메인 게임 루프
 * Main game loop
 */
function update(time = 0) {
    if (gameOver || paused || !gameStarted) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    const currentInterval = dropIntervals[level - 1];
    
    if (dropCounter > currentInterval) {
        playerDrop();
    }

    draw();
    requestAnimationFrame(update);
}

// 키보드 이벤트 리스너 (Keyboard Controls)
document.addEventListener('keydown', event => {
    if (!gameStarted) {
        if (event.key === 's' || event.key === 'S') {
            startGame();
        }
        return;
    }

    if (gameOver) {
        if (event.key === 'r' || event.key === 'R') {
            restartGame();
        }
        return;
    }

    if (event.key === 'p' || event.key === 'P') {
        togglePause();
        return;
    }

    if (paused) return;

    switch(event.code) {
        case 'ArrowLeft':
            playerMove(-1);
            break;
        case 'ArrowRight':
            playerMove(1);
            break;
        case 'ArrowDown':
            playerDrop();
            break;
        case 'ArrowUp':
            playerRotate(-1); // 회전 방향 반전 (원래 1)
            break;
        case 'Space':
            playerHardDrop();
            break;
    }
});

// 시작/저장 버튼들 모바일 대응 (Robust Button Handlers)
const addOverlayBtnListener = (id, action) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    
    const handler = (e) => {
        // e.preventDefault(); // 입력을 위해 preventDefault는 신중하게 (버튼만)
        if (e.target === btn || btn.contains(e.target)) {
            console.log("Overlay Button Pressed:", id);
            action();
        }
    };

    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        handler(e);
    });
    btn.addEventListener('click', handler);
};

addOverlayBtnListener('start-btn', startGame);
addOverlayBtnListener('restart-btn', restartGame);
addOverlayBtnListener('submit-score-btn', updateRankings);

// 엔터키 지원
document.getElementById('player-name').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        updateRankings();
    }
});

// 모바일 컨트롤 이벤트 (Mobile Control Events)
const addTouchListener = (id, action) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    
    const handler = (e) => {
        e.preventDefault();
        if (!gameStarted || gameOver || paused) {
            if (id === 'btn-pause' && gameStarted && !gameOver) togglePause();
            return;
        }
        action();
        
        // 햅틱 피드백 (Vibration)
        if (navigator.vibrate) navigator.vibrate(20);
    };

    btn.addEventListener('touchstart', handler, { passive: false });
    // mousedown은 데스크톱에서도 작동하게 함
    btn.addEventListener('mousedown', (e) => {
        if (!gameStarted || gameOver || paused) {
            if (id === 'btn-pause' && gameStarted && !gameOver) togglePause();
            return;
        }
        action();
    });
};

addTouchListener('btn-left', () => playerMove(-1));
addTouchListener('btn-right', () => playerMove(1));
addTouchListener('btn-up', () => playerRotate(-1));
addTouchListener('btn-down', () => playerDrop());
addTouchListener('btn-hard', () => playerHardDrop());
addTouchListener('btn-pause', () => togglePause());

// 초기 화면 렌더링을 위해 draw 한 번 실행
draw();
updateScore();
