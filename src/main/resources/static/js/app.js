// 오목 게임 전역 변수
let board = null; // 15x15 보드 배열 (0: 빈 칸, 1: 흑, 2: 백)
let currentTurn = 'b'; // 'b' (흑) 또는 'w' (백)
let userId = null;
let userName = null;
let movesCount = 0;
let nudgeTimer = null;
let gameMode = 'single'; // 'single' 또는 'multi'
let isGameOver = false;
let winner = null;

// 멀티플레이어 관련 변수 (multiplayer.js에서 사용)
let roomId = null;
let stompClient = null;
let myColor = 'b'; // 'b' (흑) 또는 'w' (백)
let isHost = false;
let opponentName = 'AI';
let lastSentBoardState = null;

// 싱글플레이어 관련 변수 (single-player.js에서 사용)
let currentDifficulty = 1; // 0: 쉬움, 1: 보통, 2: 어려움, 3: 마스터

// AI 응답 빈도 조절 변수
let aiCommentCounter = 0; // AI 응답 호출 카운터
const AI_COMMENT_INTERVAL = 5; // 5수마다 한 번씩 AI 응답 (사용자 수 기준) - 더 적게 응답
const AI_MOVE_COMMENT_PROBABILITY = 0.2; // AI 수 후 응답 확률 (20%) - 더 적게 응답

// 음성 출력 관리 변수
let lastSpokenText = "";
let lastSpokenTime = 0;

// 전체 화면 요청 함수 (브라우저 호환성 고려)
function requestFullscreen() {
    const docEl = document.documentElement;
    
    // 이미 전체 화면 모드인지 확인
    if (document.fullscreenElement || document.webkitFullscreenElement || 
        document.mozFullScreenElement || document.msFullscreenElement) {
        console.log('이미 전체 화면 모드입니다.');
        return;
    }
    
    try {
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(err => {
                console.error('전체 화면 요청 실패:', err);
            });
        } else if (docEl.webkitRequestFullscreen) { // Safari
            docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) { // Firefox
            docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) { // IE/Edge
            docEl.msRequestFullscreen();
        } else {
            console.warn('전체 화면 API를 지원하지 않는 브라우저입니다.');
        }
    } catch (err) {
        console.error('전체 화면 요청 중 오류 발생:', err);
    }
}

// 음성 출력 함수
function speak(text) {
    if (typeof speechSynthesis === 'undefined' || !text) return;
    
    const now = Date.now();
    if (text === lastSpokenText && (now - lastSpokenTime) < 1000) return;
    
    lastSpokenText = text;
    lastSpokenTime = now;

    speechSynthesis.cancel();
    
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = speechSynthesis.getVoices();
        
        const preferredVoice = voices.find(v => v.lang === 'ko-KR' && (v.name.includes('Google') || v.name.includes('Natural'))) ||
                               voices.find(v => v.lang === 'ko-KR' && v.name.includes('Heami')) ||
                               voices.find(v => v.lang === 'ko-KR');

        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.lang = 'ko-KR';
        utterance.rate = 0.95;
        utterance.pitch = 1.1;
        speechSynthesis.speak(utterance);
    }, 50);
}

// 보드 상태를 JSON 문자열로 변환
function boardToJson(board, turn) {
    return JSON.stringify({ board: board, turn: turn });
}

// JSON 문자열을 보드 배열로 파싱
function parseBoard(jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        return data.board || createEmptyBoard();
    } catch (e) {
        console.error('Error parsing board:', e);
        return createEmptyBoard();
    }
}

// 빈 보드 생성
function createEmptyBoard() {
    const board = [];
    for (let i = 0; i < 15; i++) {
        board[i] = [];
        for (let j = 0; j < 15; j++) {
            board[i][j] = 0;
        }
    }
    return board;
}

// 중요한 수인지 확인 (3목, 4목 등)
function checkImportantMove(row, col, player) {
    if (!board || !board[row] || board[row][col] !== player) {
        return false; // 보드 상태가 올바르지 않으면 false
    }
    
    const directions = [
        [0, 1],   // 가로
        [1, 0],   // 세로
        [1, 1],   // 대각선 \
        [1, -1]   // 대각선 /
    ];
    
    for (let dir of directions) {
        let count = 1; // 현재 위치 포함
        
        // 정방향
        for (let i = 1; i < 5; i++) {
            const newRow = row + dir[0] * i;
            const newCol = col + dir[1] * i;
            if (newRow < 0 || newRow >= 15 || newCol < 0 || newCol >= 15) break;
            if (board[newRow][newCol] !== player) break;
            count++;
        }
        
        // 역방향
        for (let i = 1; i < 5; i++) {
            const newRow = row - dir[0] * i;
            const newCol = col - dir[1] * i;
            if (newRow < 0 || newRow >= 15 || newCol < 0 || newCol >= 15) break;
            if (board[newRow][newCol] !== player) break;
            count++;
        }
        
        // 3목 이상이면 중요한 수로 간주
        if (count >= 3) {
            return true;
        }
    }
    
    return false;
}

// 오목 보드 초기화
function initBoard() {
    board = createEmptyBoard();
    currentTurn = 'b';
    isGameOver = false;
    winner = null;
    movesCount = 0;
    aiCommentCounter = 0; // AI 응답 카운터 초기화
    
    const boardElement = $('#omok-board');
    boardElement.empty();
    
    for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
            const cell = $('<div>').addClass('omok-cell')
                .attr('data-row', row)
                .attr('data-col', col)
                .on('click', function() {
                    if (isGameOver) return;
                    const r = parseInt($(this).attr('data-row'));
                    const c = parseInt($(this).attr('data-col'));
                    handleCellClick(r, c);
                });
            boardElement.append(cell);
        }
    }
    
    updateStatus();
    $('#btn-new-game').hide();
    $('#btn-nudge').hide();
    $('#btn-voice-message').hide();
}

// 셀 클릭 처리
function handleCellClick(row, col) {
    if (isGameOver || board[row][col] !== 0) return;
    
    // 차례 확인
    if (gameMode === 'multi') {
        // 멀티플레이어: 내 색상과 현재 차례가 일치해야 함
        if (currentTurn !== myColor) {
            alert('아직 당신의 차례가 아닙니다!');
            return;
        }
    } else {
        // 싱글 모드: 사용자는 흑(b), AI는 백(w)
        if (currentTurn !== 'b') return;
    }
    
    if (gameMode === 'multi') {
        // 멀티플레이어: 서버로 수 전송 (서버 응답 후 보드 업데이트)
        sendMoveToServer(row, col);
        return; // 서버 응답을 기다림
    }
    
    // 싱글플레이어: 로컬에서 수 두기
    const player = currentTurn === 'b' ? 1 : 2;
    board[row][col] = player;
    renderBoard();
    
    movesCount++;
    if (typeof stopNudgeTimer === 'function') {
        stopNudgeTimer();
    }
    
    // 승리 확인
    if (checkWinner(row, col, player)) {
        isGameOver = true;
        winner = currentTurn;
        updateStatus();
        checkGameOver();
        return;
    }
    
    // 사용자가 수를 둔 후 AI 피드백 요청 (빈도 조절)
    aiCommentCounter++;
    
    // AI_COMMENT_INTERVAL이 정의되지 않은 경우 기본값 사용
    const COMMENT_INTERVAL = (typeof AI_COMMENT_INTERVAL !== 'undefined' && AI_COMMENT_INTERVAL > 0) ? AI_COMMENT_INTERVAL : 4;
    
    // 일정 간격마다만 AI 응답 요청 (4수마다 한 번, 즉 4, 8, 12번째 수에만)
    const remainder = aiCommentCounter % COMMENT_INTERVAL;
    const isIntervalMove = (remainder === 0);
    
    // 중요한 수인지 확인 (3목 이상) - 보드에 수를 둔 후이므로 확인 가능
    // 단, 첫 6수는 제외 (너무 일찍 중요한 수 판단 방지)
    let isImportantMove = false;
    if (movesCount >= 6) {
        try {
            isImportantMove = checkImportantMove(row, col, player);
        } catch (e) {
            console.error('checkImportantMove 오류:', e);
            isImportantMove = false;
        }
    }
    
    // 중요한 수이거나, 일정 간격일 때만 AI 응답 요청
    const shouldRequestComment = Boolean(isImportantMove) || Boolean(isIntervalMove);
    
    // 디버깅용 로그 (항상 출력)
    console.log(`[AI 응답 체크] 수 ${aiCommentCounter}, 총수 ${movesCount}: 중요=${isImportantMove}, 간격=${isIntervalMove} (${aiCommentCounter} % ${COMMENT_INTERVAL} = ${remainder}), 응답=${shouldRequestComment}`);
    
    // 조건이 명확하게 true일 때만 AI 응답 요청
    if (shouldRequestComment === true) {
        console.log(`[AI 응답 실행] 수 ${aiCommentCounter}에 대해 AI 응답 요청`);
        isUpdatingAiMessage = true;
        const boardStateJson = boardToJson(board, currentTurn);
        $.ajax({
            url: '/api/ai/comment?situation=player_move',
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
                isUpdatingAiMessage = false;
            },
            error: function() {
                // 실패 시에도 플래그 해제
                isUpdatingAiMessage = false;
                // 실패 시 기본 메시지는 표시하지 않음 (AI API만 사용)
            }
        });
    } else {
        console.log(`[AI 응답 스킵] 수 ${aiCommentCounter}는 응답하지 않음 (간격=${isIntervalMove}, 중요=${isImportantMove})`);
    }
    
    // 차례 변경 후 AI 수 두기
    currentTurn = currentTurn === 'b' ? 'w' : 'b';
    updateStatus();
    setTimeout(() => makeAIMove(), 1000);
}

// 보드 렌더링
function renderBoard() {
    $('.omok-cell').each(function() {
        const row = parseInt($(this).attr('data-row'));
        const col = parseInt($(this).attr('data-col'));
        const cellValue = board[row][col];
        
        $(this).empty();
        if (cellValue === 1) {
            $(this).append($('<div>').addClass('omok-stone black'));
        } else if (cellValue === 2) {
            $(this).append($('<div>').addClass('omok-stone white'));
        }
    });
}

// 승리 판정 (5목 확인)
function checkWinner(row, col, player) {
    const directions = [
        [0, 1],   // 가로
        [1, 0],   // 세로
        [1, 1],   // 대각선 \
        [1, -1]   // 대각선 /
    ];
    
    for (let dir of directions) {
        let count = 1; // 현재 위치 포함
        
        // 정방향
        for (let i = 1; i < 5; i++) {
            const newRow = row + dir[0] * i;
            const newCol = col + dir[1] * i;
            if (newRow < 0 || newRow >= 15 || newCol < 0 || newCol >= 15) break;
            if (board[newRow][newCol] !== player) break;
            count++;
        }
        
        // 역방향
        for (let i = 1; i < 5; i++) {
            const newRow = row - dir[0] * i;
            const newCol = col - dir[1] * i;
            if (newRow < 0 || newRow >= 15 || newCol < 0 || newCol >= 15) break;
            if (board[newRow][newCol] !== player) break;
            count++;
        }
        
        if (count >= 5) {
            return true;
        }
    }
    
    return false;
}

// 보드 전체에서 승자 확인 (멀티플레이어용)
function checkWinnerFromBoard(boardToCheck) {
    const directions = [
        [0, 1],   // 가로
        [1, 0],   // 세로
        [1, 1],   // 대각선 \
        [1, -1]   // 대각선 /
    ];
    
    for (let i = 0; i < 15; i++) {
        for (let j = 0; j < 15; j++) {
            if (boardToCheck[i][j] === 0) continue;
            
            const player = boardToCheck[i][j];
            
            for (let dir of directions) {
                let count = 1;
                
                // 정방향
                for (let k = 1; k < 5; k++) {
                    const newRow = i + dir[0] * k;
                    const newCol = j + dir[1] * k;
                    if (newRow < 0 || newRow >= 15 || newCol < 0 || newCol >= 15) break;
                    if (boardToCheck[newRow][newCol] !== player) break;
                    count++;
                }
                
                // 역방향
                for (let k = 1; k < 5; k++) {
                    const newRow = i - dir[0] * k;
                    const newCol = j - dir[1] * k;
                    if (newRow < 0 || newRow >= 15 || newCol < 0 || newCol >= 15) break;
                    if (boardToCheck[newRow][newCol] !== player) break;
                    count++;
                }
                
                if (count >= 5) {
                    return player; // 1 또는 2 반환
                }
            }
        }
    }
    
    return 0; // 승자 없음
}

// AI 메시지 업데이트 중 플래그 (중복 방지)
let isUpdatingAiMessage = false;

// AI 메시지 업데이트 함수 (스타일 유지)
function updateAiMessage(message, forceUpdate = false) {
    // AI API 호출 중이고 강제 업데이트가 아니면 무시
    if (isUpdatingAiMessage && !forceUpdate) {
        return;
    }
    
    $('#ai-message').text(message);
    
    // 메시지가 업데이트되면 하단으로 스크롤
    const speechBubble = document.querySelector('.speech-bubble');
    if (speechBubble) {
        setTimeout(() => {
            speechBubble.scrollTop = speechBubble.scrollHeight;
        }, 50);
    }
}

// 가로 모드 레이아웃 조정
function adjustLandscapeLayout() {
    // CSS 미디어 쿼리가 대부분의 작업을 수행하므로
    // 여기서는 최소한의 동적 조정만 수행
    const speechBubble = document.querySelector('.speech-bubble');
    
    if (speechBubble) {
        // 메시지 영역 스크롤을 하단으로
        setTimeout(() => {
            speechBubble.scrollTop = speechBubble.scrollHeight;
        }, 100);
    }
}

// 상태 업데이트
function updateStatus() {
    if (isGameOver) {
        let statusText = '';
        if (winner === 'b') {
            statusText = '게임 종료! 흑색 승리! 🎉';
        } else if (winner === 'w') {
            statusText = '게임 종료! 백색 승리! 🎉';
        } else {
            statusText = '게임 종료! 무승부.';
        }
        $('#game-status').text(statusText);
    } else {
        const turnText = currentTurn === 'b' ? '흑색' : '백색';
        $('#game-status').text(turnText + ' 차례');
    }
    
    if (gameMode === 'multi') {
        if (currentTurn === myColor && !isGameOver) {
            // 멀티플레이어는 고정 메시지 유지
            updateAiMessage('당신의 차례입니다. 멋진 수를 보여주세요! 😊');
            $('#btn-nudge').hide();
            $('#btn-voice-message').hide();
        } else if (!isGameOver) {
            updateAiMessage('상대방이 생각 중입니다... ⏳');
            $('#btn-nudge').show();
            const VOICE_PERMISSION_KEY = 'voicePermissionAllowed';
            const voicePermissionAllowed = localStorage.getItem(VOICE_PERMISSION_KEY) === 'true';
            if (typeof isSpeechRecognitionSupported === 'function' && isSpeechRecognitionSupported() && voicePermissionAllowed) {
                $('#btn-voice-message').show();
            } else {
                $('#btn-voice-message').hide();
            }
        }
    } else {
        // 싱글플레이어 모드: 사용자 차례일 때는 간단한 메시지만 표시
        // 실제 AI 대화는 사용자가 수를 둔 후에 진행됨
        if (currentTurn === 'b' && !isGameOver) {
            // updateStatus는 자주 호출되므로 여기서는 AI API 호출하지 않음
            // 대신 간단한 메시지만 표시 (사용자가 수를 두면 handleCellClick에서 AI 피드백 제공)
        }
        $('#btn-nudge').hide();
        $('#btn-voice-message').hide();
    }
    
    if (isGameOver) {
        $('#btn-nudge').hide();
        $('#btn-voice-message').hide();
    }
}

// 게임 종료 처리
function checkGameOver() {
    if (!isGameOver) return false;
    
    let result = 'DRAW';
    
    if (winner) {
        if (gameMode === 'multi') {
            if (winner === myColor) {
                result = 'WIN';
            } else {
                result = 'LOSS';
            }
        } else {
            if (winner === 'b') {
                result = 'WIN';
            } else {
                result = 'LOSS';
            }
        }
    } else {
        result = 'DRAW';
    }
    
    // AI API로 게임 종료 메시지 생성
    if (gameMode === 'single') {
        isUpdatingAiMessage = true;
        const boardStateJson = boardToJson(board, currentTurn);
        $.ajax({
            url: '/api/ai/comment?situation=game_over',
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
                    updateAiMessage(response.comment, true); // 강제 업데이트
                    speak(response.comment);
                } else {
                    // Fallback 메시지
                    let fallbackMessage = '';
                    if (result === 'WIN') {
                        fallbackMessage = '승리했습니다! 🎉';
                    } else if (result === 'LOSS') {
                        fallbackMessage = '패배했습니다.';
                    } else {
                        fallbackMessage = '게임 종료! 무승부입니다.';
                    }
                    updateAiMessage(fallbackMessage, true);
                    speak(fallbackMessage);
                }
                isUpdatingAiMessage = false;
            },
            error: function() {
                // Fallback 메시지
                let fallbackMessage = '';
                if (result === 'WIN') {
                    fallbackMessage = '승리했습니다! 🎉';
                } else if (result === 'LOSS') {
                    fallbackMessage = '패배했습니다.';
                } else {
                    fallbackMessage = '게임 종료! 무승부입니다.';
                }
                updateAiMessage(fallbackMessage, true);
                speak(fallbackMessage);
                isUpdatingAiMessage = false;
            }
        });
    } else {
        // 멀티플레이어는 기존 방식 유지
        let message = '';
        if (result === 'WIN') {
            message = '승리했습니다! 🎉';
        } else if (result === 'LOSS') {
            message = '패배했습니다.';
        } else {
            message = '게임 종료! 무승부입니다.';
        }
        updateAiMessage(message, true);
        speak(message);
    }
    
    let currentOpponentName = 'AI';
    if (gameMode === 'multi' && opponentName && opponentName !== 'AI' && opponentName !== '상대방') {
        currentOpponentName = opponentName;
    }
    
    if (!userId) {
        console.error('Cannot save game history: userId is null');
        alert('게임 종료! 하지만 기록을 저장할 수 없습니다. (사용자 정보 없음)');
        return true;
    }
    
    $.ajax({
        url: '/api/history/' + userId,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ result: result, movesCount: movesCount, opponentName: currentOpponentName, gameType: 'OMOK' }),
        success: function() {
            alert('게임 종료! 결과가 저장되었습니다.');
            if (result === 'WIN' || result === 'DRAW') {
                $('#btn-new-game').show();
            }
        },
        error: function(xhr, status, error) {
            console.error('Failed to save game history:', error);
            alert('게임 종료! 하지만 기록 저장에 실패했습니다.');
        }
    });
    return true;
}

// 보드 상태 업데이트 (서버에서 받은 상태로)
function updateBoardFromState(boardStateJson, turn) {
    if (!boardStateJson) return;
    
    board = parseBoard(boardStateJson);
    currentTurn = turn;
    renderBoard();
    updateStatus();
}

$(document).ready(function() {
    // 대기방 목록 HTML 로드
    $('#waiting-rooms-placeholder').load('/waiting-rooms.html', function() {
        const VOICE_PERMISSION_KEY = 'voicePermissionAllowed';
        const voicePermissionCheckbox = $('#voice-permission-checkbox');
        
        const savedVoicePermission = localStorage.getItem(VOICE_PERMISSION_KEY);
        if (savedVoicePermission === 'true') {
            voicePermissionCheckbox.prop('checked', true);
        }
        
        voicePermissionCheckbox.on('change', function() {
            const isChecked = $(this).is(':checked');
            localStorage.setItem(VOICE_PERMISSION_KEY, isChecked ? 'true' : 'false');
            
            if (isChecked && gameMode === 'multi' && typeof initSpeechRecognition === 'function') {
                initSpeechRecognition();
            } else if (!isChecked) {
                $('#btn-voice-message').hide();
            }
        });
    });

    $('#btn-new-game').hide();
    
    const savedName = localStorage.getItem('omok_username');
    if (savedName) $('#username').val(savedName);

    const savedDiff = localStorage.getItem('omok_difficulty');
    if (savedDiff !== null) {
        $('#difficulty').val(savedDiff);
        currentDifficulty = parseInt(savedDiff);
    }

    // 모드 버튼 이벤트 핸들러
    function setupModeButtons() {
        $('.mode-btn').off('click').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            $('.mode-btn').css('background', '#fff');
            $(this).css('background', '#ffeb99');
            
            if ($(this).attr('id') === 'btn-single-mode') {
                gameMode = 'single';
                $('#single-mode-options').show();
                $('#btn-start').show();
                $('#btn-create-room').hide();
            } else {
                gameMode = 'multi';
                $('#single-mode-options').hide();
                $('#btn-start').hide();
                $('#btn-create-room').hide();
                
                const name = $('#username').val();
                if (!name) {
                    alert('이름을 입력해주세요!');
                    $('#btn-single-mode').trigger('click');
                    return;
                }
                
                $.ajax({
                    url: '/api/login',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ name: name }),
                    success: function(user) {
                        userId = user.id;
                        userName = user.name;
                        localStorage.setItem('omok_username', name);
                        
                        $('#login-container').hide();
                        $('#waiting-rooms-container').show();
                        loadWaitingRooms();
                        
                        if (window.roomRefreshInterval) clearInterval(window.roomRefreshInterval);
                        window.roomRefreshInterval = setInterval(loadWaitingRooms, 5000);
                    },
                    error: function() {
                        alert('로그인에 실패했습니다. 다시 시도해주세요.');
                        $('#btn-single-mode').trigger('click');
                    }
                });
            }
        });
    }
    
    setupModeButtons();
    
    // 초기 상태: 혼자하기 모드 선택
    gameMode = 'single';
    $('#single-mode-options').show();
    $('#btn-start').show();
    $('#btn-create-room').hide();
    $('#btn-single-mode').css('background', '#ffeb99');
    $('#btn-multi-mode').css('background', '#fff');

    $('#btn-start').on('click', function() {
        const name = $('#username').val();
        if (!name) { alert('이름을 입력해주세요!'); return; }
        
        currentDifficulty = parseInt($('#difficulty').val());
        localStorage.setItem('omok_username', name);
        localStorage.setItem('omok_difficulty', currentDifficulty);

        // 전체 화면 요청 (사용자 클릭 이벤트 내에서 직접 호출)
        // 전체 화면 API는 사용자 제스처와 직접 연결되어야 하므로 여기서 호출
        try {
            const docEl = document.documentElement;
            if (docEl.requestFullscreen) {
                const promise = docEl.requestFullscreen();
                if (promise && promise.catch) {
                    promise.catch(err => {
                        console.error('전체 화면 요청 실패:', err);
                        // 전체 화면 실패 시에도 게임은 계속 진행
                    });
                }
            } else if (docEl.webkitRequestFullscreen) {
                docEl.webkitRequestFullscreen();
            } else if (docEl.mozRequestFullScreen) {
                docEl.mozRequestFullScreen();
            } else if (docEl.msRequestFullscreen) {
                docEl.msRequestFullscreen();
            }
        } catch (err) {
            console.error('전체 화면 요청 중 오류:', err);
        }

        $.ajax({
            url: '/api/login',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ name: name }),
            success: function(user) {
                userId = user.id;
                userName = user.name;
                $('#login-container').hide();
                $('#game-container').show();
                initBoard();
                
                // 레이아웃 조정
                setTimeout(adjustLandscapeLayout, 100);
                
                // AI API로 환영 메시지 생성
                isUpdatingAiMessage = true;
                const emptyBoardJson = boardToJson(createEmptyBoard(), 'b');
                $.ajax({
                    url: '/api/ai/comment?situation=welcome',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        boardState: emptyBoardJson,
                        turn: 'b',
                        userName: userName,
                        difficulty: currentDifficulty
                    }),
                    success: function(response) {
                        if (response.comment) {
                            updateAiMessage(response.comment, true); // 강제 업데이트
                            speak(response.comment);
                        } else {
                            const fallbackWelcome = '안녕! 나는 너의 오목 친구야. 우리 재미있게 놀아보자!';
                            updateAiMessage(fallbackWelcome, true);
                            speak(fallbackWelcome);
                        }
                        isUpdatingAiMessage = false;
                    },
                    error: function() {
                        const fallbackWelcome = '안녕! 나는 너의 오목 친구야. 우리 재미있게 놀아보자!';
                        updateAiMessage(fallbackWelcome, true);
                        speak(fallbackWelcome);
                        isUpdatingAiMessage = false;
                    }
                });
                
                if (typeof startNudgeTimer === 'function') {
                    startNudgeTimer();
                }
                
                // 메시지가 길어질 때 자동 스크롤
                const speechBubble = document.querySelector('.speech-bubble');
                if (speechBubble) {
                    const observer = new MutationObserver(() => {
                        speechBubble.scrollTop = speechBubble.scrollHeight;
                    });
                    observer.observe(speechBubble, { childList: true, characterData: true, subtree: true });
                }
            }
        });
    });

    // 대기하기 화면 관련 이벤트
    $(document).on('click', '#btn-back-to-login', function() {
        if (window.roomRefreshInterval) {
            clearInterval(window.roomRefreshInterval);
            window.roomRefreshInterval = null;
        }
        $('#waiting-rooms-container').hide();
        $('#login-container').show();
    });
    
    $(document).on('click', '#btn-refresh-rooms', function() {
        loadWaitingRooms();
    });
    
    $(document).on('click', '#btn-create-new-room', function() {
        if (!userId) { alert('먼저 이름을 입력하고 같이하기를 선택해주세요.'); return; }
        
        // 전체 화면 요청 (사용자 클릭 이벤트 내에서 직접 호출)
        try {
            const docEl = document.documentElement;
            if (docEl.requestFullscreen) {
                const promise = docEl.requestFullscreen();
                if (promise && promise.catch) {
                    promise.catch(err => {
                        console.error('전체 화면 요청 실패:', err);
                    });
                }
            } else if (docEl.webkitRequestFullscreen) {
                docEl.webkitRequestFullscreen();
            } else if (docEl.mozRequestFullScreen) {
                docEl.mozRequestFullScreen();
            } else if (docEl.msRequestFullscreen) {
                docEl.msRequestFullscreen();
            }
        } catch (err) {
            console.error('전체 화면 요청 중 오류:', err);
        }
        
        createRoom();
    });

    $('#btn-logout').on('click', () => {
        if (typeof stompClient !== 'undefined' && stompClient && stompClient.connected) {
            stompClient.disconnect();
        }
        location.reload();
    });

    $('#btn-history').on('click', () => {
        if (!userId) return;
        $.ajax({
            url: '/api/history/' + userId,
            method: 'GET',
            success: function(history) {
                const tbody = $('#history-table tbody').empty();
                history.forEach(h => {
                    const res = h.result === 'WIN' ? '승리 🏆' : h.result === 'LOSS' ? '패배' : '무승부';
                    const opponent = h.opponentName || 'AI';
                    
                    // 날짜 포맷팅 (안전한 처리)
                    let dateStr = '알 수 없음';
                    if (h.playedAt) {
                        try {
                            let date;
                            // 배열 형식 [year, month, day, hour, minute, second, nano] 처리
                            if (Array.isArray(h.playedAt)) {
                                const [year, month, day, hour, minute, second] = h.playedAt;
                                date = new Date(year, month - 1, day, hour, minute, second || 0);
                            } else if (typeof h.playedAt === 'string') {
                                date = new Date(h.playedAt);
                            } else {
                                date = new Date(h.playedAt);
                            }
                            
                            if (!isNaN(date.getTime())) {
                                dateStr = date.toLocaleString('ko-KR', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                            }
                        } catch (e) {
                            console.error('Failed to parse date:', h.playedAt, e);
                        }
                    }
                    
                    tbody.append(`<tr><td>${dateStr}</td><td>${res}</td><td>${opponent}</td><td>${h.movesCount}</td></tr>`);
                });
                $('#history-modal').show();
            }
        });
    });
    
    $('#btn-new-game').on('click', () => {
        board = createEmptyBoard();
        currentTurn = 'b';
        isGameOver = false;
        winner = null;
        movesCount = 0;
        aiCommentCounter = 0; // AI 응답 카운터 초기화
        if (typeof lastSentBoardState !== 'undefined') lastSentBoardState = null;
        $('#btn-new-game').hide();
        
        if (gameMode === 'multi') {
            if (stompClient && stompClient.connected && roomId) {
                const headers = { userId: userId.toString() };
                const emptyBoard = boardToJson(createEmptyBoard(), 'b');
                
                const isRematch = opponentName && opponentName !== '상대방' && opponentName !== 'AI';
                const nextStatus = isRematch ? 'PLAYING' : 'WAITING';
                const nextMessage = isRematch ? '재경기를 시작합니다! 즐거운 게임 되세요.' : '새 게임을 시작합니다! 상대방을 기다려주세요...';

                if (!isRematch) {
                    opponentName = '상대방';
                }

                stompClient.send('/app/game/' + roomId + '/state', headers, JSON.stringify({
                    boardState: emptyBoard,
                    turn: 'b',
                    status: nextStatus,
                    isGameOver: false,
                    winner: null,
                    message: nextMessage
                }));
            }
            
            initBoard();
            speak('새 게임을 시작합니다!');
        } else {
            initBoard();
            updateAiMessage('새 게임을 시작합니다!');
            speak('새 게임을 시작합니다!');
            if (typeof startNudgeTimer === 'function') {
                startNudgeTimer();
            }
        }
    });
    
    // 재촉하기 버튼 클릭 이벤트
    $('#btn-nudge').on('click', function() {
        if (gameMode === 'multi' && typeof sendNudgeToServer === 'function') {
            sendNudgeToServer();
        }
    });
    
    // 말하기 버튼 이벤트 핸들러
    const btnVoiceMessage = $('#btn-voice-message');
    
    btnVoiceMessage.on('mousedown touchstart', function(e) {
        e.preventDefault();
        if (gameMode === 'multi' && recognition && !isRecording) {
            try {
                recognition.start();
            } catch (err) {
                console.error('Failed to start recognition:', err);
            }
        }
    });
    
    btnVoiceMessage.on('mouseup touchend mouseleave', function(e) {
        e.preventDefault();
        if (recognition && isRecording) {
            recognition.stop();
        }
    });
    
    $('.close').on('click', () => $('#history-modal').hide());
    
    // 화면 크기 변경 시 레이아웃 조정
    $(window).on('resize', function() {
        if ($('#game-container').is(':visible')) {
            setTimeout(adjustLandscapeLayout, 100);
        }
    });
    
    // 초기 레이아웃 조정 (게임 컨테이너가 표시될 때)
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const gameContainer = $('#game-container');
                if (gameContainer.is(':visible')) {
                    setTimeout(adjustLandscapeLayout, 100);
                }
            }
        });
    });
    
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        observer.observe(gameContainer, { attributes: true, attributeFilter: ['style'] });
    }
    
    // 게임 컨테이너가 표시될 때 즉시 실행
    const checkAndAdjust = setInterval(function() {
        if ($('#game-container').is(':visible')) {
            adjustLandscapeLayout();
            clearInterval(checkAndAdjust);
        }
    }, 100);
    
    // 5초 후에도 실행되지 않으면 정리
    setTimeout(function() {
        clearInterval(checkAndAdjust);
    }, 5000);
});

