// 혼자하기(AI) 관련 로직 (변수는 app.js에 정의됨)

// 사용자를 재촉하는 함수
function startNudgeTimer() {
    stopNudgeTimer();
    nudgeTimer = setTimeout(() => {
        if (currentTurn === 'b' && !isGameOver) {
            const nudges = [
                "어디로 둘지 결정했니? 😊",
                `${userName}야, 천천히 생각해도 돼!`,
                "선생님은 기다리고 있어!",
                `${userName}야, 어떤 전략을 세우고 있니?`,
                "선생님은 준비 다 됐어! 천천히 해봐~"
            ];
            const ment = nudges[Math.floor(Math.random() * nudges.length)];
            $('#ai-message').text(ment);
            speak(ment);
            startNudgeTimer();
        }
    }, 30000);
}

function stopNudgeTimer() {
    if (nudgeTimer) clearTimeout(nudgeTimer);
}

// AI 수 두기
const omokAI = new OmokAI();

function makeAIMove() {
    if (isGameOver || currentTurn !== 'w') return;
    
    stopNudgeTimer();
    $('#ai-message').text('음... 어디로 두면 좋을까? 🤔');
    
    // 1. 클라이언트 JS에서 즉시 수 계산
    const aiMove = omokAI.getNextMove(board, 2, currentDifficulty);
    const row = aiMove[0];
    const col = aiMove[1];
    
    // 2. 즉시 돌 놓기
    if (row >= 0 && row < 15 && col >= 0 && col < 15 && board[row][col] === 0) {
        board[row][col] = 2; // AI는 백색(2)
        renderBoard();
        movesCount++;
        
        // 승리 확인
        if (checkWinner(row, col, 2)) {
            isGameOver = true;
            winner = 'w';
            updateStatus();
            checkGameOver();
            // 승리했어도 마지막 멘트는 요청
        }
        
        // 차례 변경
        if (!isGameOver) {
            currentTurn = 'b';
            updateStatus();
        }

        // 3. 서버에는 '멘트'만 요청 (비동기)
        const boardStateJson = boardToJson(board, currentTurn);
        $.ajax({
            url: '/api/ai/move',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                boardState: boardStateJson,
                turn: 'w', // AI가 둔 수에 대한 멘트를 위해 'w' 전달
                userName: userName,
                difficulty: currentDifficulty,
                move: row + "," + col // AI가 둔 수를 알려줌
            }),
            success: function(response) {
                if (response.comment) {
                    $('#ai-message').text(response.comment);
                    speak(response.comment);
                }
                if (!isGameOver) startNudgeTimer();
            },
            error: function() {
                console.error('AI comment request failed');
                if (!isGameOver) startNudgeTimer();
            }
        });
    }
}

// 랜덤 수 두기 (fallback)
function makeRandomMove() {
    const emptyCells = [];
    for (let i = 0; i < 15; i++) {
        for (let j = 0; j < 15; j++) {
            if (board[i][j] === 0) {
                emptyCells.push([i, j]);
            }
        }
    }
    
    if (emptyCells.length > 0) {
        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const row = randomCell[0];
        const col = randomCell[1];
        
        board[row][col] = 2;
        renderBoard();
        movesCount++;
        
        if (checkWinner(row, col, 2)) {
            isGameOver = true;
            winner = 'w';
            updateStatus();
            checkGameOver();
            return;
        }
        
        currentTurn = 'b';
        updateStatus();
        
        const casualMents = [
            "음, 제 차례군요.",
            "어디로 두면 좋을까?",
            "선생님도 집중하고 있어요!"
        ];
        const ment = casualMents[Math.floor(Math.random() * casualMents.length)];
        $('#ai-message').text(ment);
        speak(ment);
        
        startNudgeTimer();
        checkGameOver();
    }
}

