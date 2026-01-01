// 혼자하기(AI) 관련 로직 (변수는 app.js에 정의됨)

// 사용자를 재촉하는 함수 (AI API 사용)
function startNudgeTimer() {
    stopNudgeTimer();
    nudgeTimer = setTimeout(() => {
        if (currentTurn === 'b' && !isGameOver) {
            // AI API로 재촉 메시지 생성
            if (typeof isUpdatingAiMessage !== 'undefined' && isUpdatingAiMessage) {
                // 이미 다른 메시지 업데이트 중이면 재촉 메시지 건너뛰기
                startNudgeTimer();
                return;
            }
            
            if (typeof isUpdatingAiMessage !== 'undefined') {
                isUpdatingAiMessage = true;
            }
            
            const boardStateJson = boardToJson(board, currentTurn);
            $.ajax({
                url: '/api/ai/comment?situation=nudge',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    boardState: boardStateJson,
                    turn: currentTurn,
                    userName: userName,
                    difficulty: currentDifficulty
                }),
                success: function(response) {
                    if (response.comment) {
                        if (typeof updateAiMessage === 'function') {
                            updateAiMessage(response.comment, true); // 강제 업데이트
                        } else {
                            $('#ai-message').text(response.comment);
                        }
                        speak(response.comment);
                    }
                    if (typeof isUpdatingAiMessage !== 'undefined') {
                        isUpdatingAiMessage = false;
                    }
                    startNudgeTimer();
                },
                error: function() {
                    // 실패 시에도 플래그 해제하고 재촉 타이머 재시작
                    if (typeof isUpdatingAiMessage !== 'undefined') {
                        isUpdatingAiMessage = false;
                    }
                    // 실패 시 메시지는 표시하지 않음 (AI API만 사용)
                    startNudgeTimer();
                }
            });
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
    
    // 고정 메시지 제거 - AI API 응답만 사용
    
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
            return; // 게임 종료 시 checkGameOver에서 메시지 처리
        }
        
        // 차례 변경
        currentTurn = 'b';
        updateStatus();

        // 3. 서버에는 '멘트'만 요청 (빈도 조절)
        // 중요한 수인지 확인 (첫 6수는 제외)
        let isImportantMove = false;
        if (movesCount >= 6) {
            try {
                isImportantMove = typeof checkImportantMove === 'function' && checkImportantMove(row, col, 2);
            } catch (e) {
                console.error('checkImportantMove 오류:', e);
                isImportantMove = false;
            }
        }
        
        // AI 수 후 응답 확률 (20%)
        const AI_MOVE_PROB = (typeof AI_MOVE_COMMENT_PROBABILITY !== 'undefined' ? AI_MOVE_COMMENT_PROBABILITY : 0.2);
        const randomValue = Math.random();
        const isRandomMove = randomValue < AI_MOVE_PROB;
        
        // 중요한 수이거나, 랜덤 확률로만 AI 응답 요청
        const shouldRequestComment = isImportantMove || isRandomMove;
        
        console.log(`[AI 수 응답 체크] 총수 ${movesCount}: 중요=${isImportantMove}, 랜덤=${isRandomMove} (${randomValue.toFixed(3)} < ${AI_MOVE_PROB}), 응답=${shouldRequestComment}`);
        
        if (shouldRequestComment) {
            console.log(`[AI 수 응답 실행] 총수 ${movesCount}에 대해 AI 응답 요청`);
            if (typeof isUpdatingAiMessage !== 'undefined') {
                isUpdatingAiMessage = true;
            }
            
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
                        if (typeof updateAiMessage === 'function') {
                            updateAiMessage(response.comment, true); // 강제 업데이트
                        } else {
                            $('#ai-message').text(response.comment);
                        }
                        speak(response.comment);
                    }
                    if (typeof isUpdatingAiMessage !== 'undefined') {
                        isUpdatingAiMessage = false;
                    }
                    if (!isGameOver) startNudgeTimer();
                },
                error: function() {
                    console.error('AI comment request failed');
                    if (typeof isUpdatingAiMessage !== 'undefined') {
                        isUpdatingAiMessage = false;
                    }
                    if (!isGameOver) startNudgeTimer();
                }
            });
        } else {
            console.log(`[AI 수 응답 스킵] 총수 ${movesCount}는 응답하지 않음 (간격=${isRandomMove}, 중요=${isImportantMove})`);
            // AI 응답을 요청하지 않아도 재촉 타이머는 시작
            if (!isGameOver) startNudgeTimer();
        }
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
        if (typeof updateAiMessage === 'function') {
            updateAiMessage(ment);
        } else {
            $('#ai-message').text(ment);
        }
        speak(ment);
        
        startNudgeTimer();
        checkGameOver();
    }
}

