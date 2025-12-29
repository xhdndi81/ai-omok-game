// 멀티플레이어 관련 로직 (변수는 app.js에 정의됨)

// WebSocket 연결 함수
function connectWebSocket(roomIdParam) {
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    
    const headers = {
        userId: userId.toString()
    };
    
    stompClient.connect(headers, function(frame) {
        console.log('WebSocket Connected: ' + frame);
        console.log('Subscribing to /topic/game/' + roomIdParam);
        
        stompClient.subscribe('/topic/game/' + roomIdParam, function(message) {
            console.log('Received message:', message.body);
            try {
                const gameState = JSON.parse(message.body);
                handleGameStateUpdate(gameState);
            } catch (error) {
                console.error('Error parsing game state:', error);
                // 에러 메시지인 경우 처리
                if (message.body && message.body.includes('Not your turn')) {
                    alert('아직 당신의 차례가 아닙니다!');
                    window.pendingMove = null;
                    // 서버에서 최신 상태를 가져와서 동기화
                    $.ajax({
                        url: '/api/rooms/' + roomIdParam + '/state',
                        method: 'GET',
                        success: function(latestState) {
                            updateBoardFromState(latestState.boardState, latestState.turn);
                            updateStatus();
                        }
                    });
                }
            }
        });
    }, function(error) {
        console.error('WebSocket connection error:', error);
    });
}

// 서버로 수 전송
function sendMoveToServer(row, col) {
    if (!stompClient || !stompClient.connected) {
        console.error('WebSocket not connected');
        alert('서버와 연결이 끊어졌습니다. 페이지를 새로고침해주세요.');
        return;
    }
    
    // 차례 확인 (이중 체크)
    if (currentTurn !== myColor) {
        console.warn('Not your turn! Current turn:', currentTurn, 'My color:', myColor);
        alert('아직 당신의 차례가 아닙니다!');
        return;
    }
    
    // 임시로 보드에 수를 두어 상태 계산 (서버 응답 후 실제로 반영됨)
    const player = currentTurn === 'b' ? 1 : 2;
    const tempBoard = JSON.parse(JSON.stringify(board)); // 보드 복사
    tempBoard[row][col] = player;
    
    // 수를 둔 후의 보드 상태와 다음 차례를 계산
    const nextTurn = currentTurn === 'b' ? 'w' : 'b';
    const tempBoardJson = boardToJson(tempBoard, nextTurn);
    
    const headers = {
        userId: userId.toString()
    };
    
    // 서버로 수 전송 (보드는 서버 응답 후 업데이트)
    stompClient.send('/app/game/' + roomId + '/move', headers, JSON.stringify({
        roomId: roomId,
        row: row,
        col: col,
        boardState: tempBoardJson,
        turn: nextTurn
    }));
    
    // 서버 응답을 기다리는 동안 클릭 비활성화를 위해 플래그 설정
    window.pendingMove = { row: row, col: col };
    
    if (isGameOver) {
        updateGameStateOnServer();
    }
}

// 재촉하기 메시지 전송 (쿨다운 적용)
let nudgeCooldownTimer = null;
const NUDGE_COOLDOWN_MS = 5000;

// 음성 메시지 관련 변수
let recognition = null;
let isRecording = false;
let finalTranscript = '';

// Web Speech API 지원 여부 확인
function isSpeechRecognitionSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

// SpeechRecognition 초기화
function initSpeechRecognition() {
    if (!isSpeechRecognitionSupported()) {
        console.warn('Speech Recognition is not supported in this browser');
        $('#btn-voice-message').hide();
        return;
    }

    const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecureContext) {
        console.warn('Speech Recognition requires HTTPS. Current protocol:', window.location.protocol);
        $('#btn-voice-message').hide();
        if (gameMode === 'multi') {
            $('#ai-message').text('⚠️ 음성 메시지 기능은 HTTPS에서만 사용할 수 있습니다. 서버에 SSL 인증서를 설정해주세요.');
        }
        return;
    }

    const VOICE_PERMISSION_KEY = 'voicePermissionAllowed';
    const voicePermissionAllowed = localStorage.getItem(VOICE_PERMISSION_KEY) === 'true';
    
    if (!voicePermissionAllowed) {
        console.log('Voice permission not allowed by user');
        $('#btn-voice-message').hide();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = true;
    
    recognition.onstart = function() {
        isRecording = true;
        finalTranscript = '';
        $('#btn-voice-message').addClass('recording');
        $('#btn-voice-message').text('🎤 녹음 중...');
    };
    
    recognition.onresult = function(event) {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        if (interimTranscript) {
            $('#ai-message').text('🎤 ' + interimTranscript);
        }
    };
    
    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        isRecording = false;
        $('#btn-voice-message').removeClass('recording');
        $('#btn-voice-message').text('🎤 말하기');
        
        let errorMsg = '음성 인식 오류가 발생했습니다.';
        if (event.error === 'no-speech') {
            errorMsg = '음성이 감지되지 않았습니다.';
        } else if (event.error === 'not-allowed') {
            errorMsg = '마이크 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.';
            $('#ai-message').text(errorMsg);
        } else {
            $('#ai-message').text(errorMsg);
        }
    };
    
    recognition.onend = function() {
        isRecording = false;
        $('#btn-voice-message').removeClass('recording');
        $('#btn-voice-message').text('🎤 말하기');
        
        if (finalTranscript.trim()) {
            sendVoiceMessageToServer(finalTranscript.trim());
            $('#ai-message').text('메시지를 전송했습니다: ' + finalTranscript.trim());
        } else {
            $('#ai-message').text('음성이 감지되지 않았습니다.');
        }
    };
}

// 음성 메시지 전송
function sendVoiceMessageToServer(text) {
    if (!stompClient || !stompClient.connected) {
        console.error('WebSocket not connected');
        return;
    }
    
    if (!text || text.trim() === '') {
        return;
    }
    
    const headers = {
        userId: userId.toString()
    };
    
    stompClient.send('/app/game/' + roomId + '/voice-message', headers, JSON.stringify({
        message: text.trim()
    }));
}

function sendNudgeToServer() {
    if (!stompClient || !stompClient.connected) {
        console.error('WebSocket not connected');
        return;
    }
    
    if (nudgeCooldownTimer !== null) {
        console.log('Nudge is on cooldown');
        return;
    }
    
    const headers = {
        userId: userId.toString()
    };
    
    stompClient.send('/app/game/' + roomId + '/nudge', headers, JSON.stringify({}));
    
    const btnNudge = $('#btn-nudge');
    btnNudge.prop('disabled', true);
    
    let remainingSeconds = NUDGE_COOLDOWN_MS / 1000;
    const originalText = btnNudge.text();
    btnNudge.text(`⚡ ${remainingSeconds}초`);
    
    nudgeCooldownTimer = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds > 0) {
            btnNudge.text(`⚡ ${remainingSeconds}초`);
        } else {
            clearInterval(nudgeCooldownTimer);
            nudgeCooldownTimer = null;
            btnNudge.prop('disabled', false);
            btnNudge.text(originalText);
        }
    }, 1000);
}

// 서버에 게임 상태 업데이트 전송
function updateGameStateOnServer() {
    if (!stompClient || !stompClient.connected) {
        return;
    }
    
    const headers = {
        userId: userId.toString()
    };
    
    const boardStateJson = boardToJson(board, currentTurn);
    lastSentBoardState = boardStateJson;
    
    stompClient.send('/app/game/' + roomId + '/state', headers, JSON.stringify({
        boardState: boardStateJson,
        turn: currentTurn,
        status: 'PLAYING',
        isGameOver: isGameOver,
        winner: winner,
        hostName: '',
        guestName: ''
    }));
}

// 서버에서 받은 게임 상태 업데이트
function handleGameStateUpdate(gameState) {
    if (!gameState) return;
    
    console.log('handleGameStateUpdate received:', gameState);
    
    if (gameState.message) {
        console.log('Game Message:', gameState.message);
        
        const isNudgeMessage = gameState.message.includes('님,') && 
                               (gameState.message.includes('빨리') || 
                                gameState.message.includes('기다리고') || 
                                gameState.message.includes('생각이') ||
                                gameState.message.includes('빨리빨리'));
        
        const isVoiceMessage = !isNudgeMessage && 
                               !gameState.message.includes('참여') && 
                               !gameState.message.includes('시작') &&
                               !gameState.message.includes('나갔습니다');
        
        if (isVoiceMessage) {
            const senderName = isHost ? gameState.guestName : gameState.hostName;
            const displayMessage = senderName ? `${senderName}: ${gameState.message}` : gameState.message;
            $('#ai-message').text(displayMessage);
            speak(gameState.message);
        } else {
            $('#ai-message').text(gameState.message);
            
            if (isNudgeMessage) {
                speak(gameState.message);
            } else if (gameState.message.includes('참여') || gameState.message.includes('시작')) {
                speak(gameState.message);
                if (gameMode === 'multi') {
                    if (isHost && gameState.guestName) {
                        opponentName = gameState.guestName;
                    } else if (!isHost && gameState.hostName) {
                        opponentName = gameState.hostName;
                    }
                }
                
                if (gameState.message.includes('새 게임')) {
                    board = createEmptyBoard();
                    currentTurn = 'b';
                    isGameOver = false;
                    winner = null;
                    movesCount = 0;
                    lastSentBoardState = null;
                    if (gameState.boardState) {
                        updateBoardFromState(gameState.boardState, gameState.turn);
                    }
                    renderBoard();
                    updateStatus();
                    $('#btn-new-game').hide();
                }
            }
        }
    }
    
    // 보드 상태 업데이트
    if (gameState.boardState) {
        const currentBoardState = boardToJson(board, currentTurn);
        const emptyBoard = boardToJson(createEmptyBoard(), 'b');
        
        if (gameState.boardState === emptyBoard && (!gameState.isGameOver && gameState.status !== 'FINISHED')) {
            board = createEmptyBoard();
            currentTurn = 'b';
            isGameOver = false;
            winner = null;
            movesCount = 0;
            lastSentBoardState = null;
            window.pendingMove = null;
            renderBoard();
            updateStatus();
            $('#btn-new-game').hide();
        } else if (gameState.boardState !== currentBoardState && gameState.boardState !== lastSentBoardState) {
            // 서버에서 받은 차례 정보로 업데이트 (서버가 권위 있음)
            const hadPendingMove = window.pendingMove !== null;
            updateBoardFromState(gameState.boardState, gameState.turn);
            
            // 보드가 업데이트되었으므로 pendingMove 초기화
            if (hadPendingMove) {
                movesCount++;
                window.pendingMove = null;
            }
            
            // 차례가 변경되었으므로 상태 업데이트
            updateStatus();
            
            // 승리 확인 (서버에서 보드 상태를 받았으므로)
            if (gameState.isGameOver || gameState.status === 'FINISHED') {
                // 게임 종료 처리는 아래에서 처리됨
            } else {
                // 승리 확인을 위해 보드 상태 파싱
                const parsedBoard = parseBoard(gameState.boardState);
                const winnerCheck = checkWinnerFromBoard(parsedBoard);
                if (winnerCheck !== 0) {
                    isGameOver = true;
                    winner = winnerCheck === 1 ? 'b' : 'w';
                    updateStatus();
                    checkGameOver();
                }
            }
        } else if (window.pendingMove && gameState.boardState === currentBoardState) {
            // 보드 상태가 변경되지 않았는데 pendingMove가 있다면 서버에서 거부된 것
            console.warn('Move was rejected by server. Current turn:', currentTurn, 'My color:', myColor);
            alert('아직 당신의 차례가 아닙니다!');
            window.pendingMove = null;
            // 서버 상태로 다시 동기화
            updateBoardFromState(gameState.boardState, gameState.turn);
            updateStatus();
        }
    }
    
    // 게임 종료 처리
    if (gameState.isGameOver || (gameState.status === 'FINISHED')) {
        isGameOver = true;
        winner = gameState.winner;
        
        let message = '';
        if (gameState.winner === 'draw') {
            message = '게임 종료! 무승부입니다.';
        } else {
            if (gameState.winner === myColor) {
                message = '게임 종료! 승리했습니다! 🎉';
            } else if (gameState.winner) {
                message = '게임 종료! 패배했습니다.';
            }
        }
        
        if (message) {
            $('#ai-message').text(message);
            speak(message);
        }
        
        if (userId && (gameState.isGameOver || gameState.status === 'FINISHED')) {
            const result = gameState.winner === myColor ? 'WIN' : 
                          gameState.winner === 'draw' ? 'DRAW' : 'LOSS';
            let currentOpponentName = 'AI';
            if (gameMode === 'multi') {
                if (isHost && gameState.guestName) {
                    currentOpponentName = gameState.guestName;
                } else if (!isHost && gameState.hostName) {
                    currentOpponentName = gameState.hostName;
                } else if (opponentName && opponentName !== 'AI' && opponentName !== '상대방') {
                    currentOpponentName = opponentName;
                }
            }
            
            const isOpponentDisconnected = gameState.message && gameState.message.includes('나갔습니다');
            
            if (!userId) {
                console.error('Cannot save game history: userId is null');
                alert('게임 종료! 하지만 기록을 저장할 수 없습니다. (사용자 정보 없음)');
                return;
            }
            
            $.ajax({
                url: '/api/history/' + userId,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ result: result, movesCount: movesCount, opponentName: currentOpponentName, gameType: 'OMOK' }),
                success: function() {
                    console.log('Game history saved');
                    if (isOpponentDisconnected) {
                        alert('상대방이 나갔습니다.\n게임이 종료되었고 결과가 저장되었습니다.');
                        $('#btn-new-game').show();
                    } else {
                        alert('게임 종료! 결과가 저장되었습니다.');
                        if (gameState.winner === myColor || gameState.winner === 'draw') {
                            $('#btn-new-game').show();
                        }
                        if (gameState.winner && gameState.winner !== myColor && gameState.winner !== 'draw') {
                            setTimeout(() => {
                                if (stompClient && stompClient.connected) {
                                    stompClient.disconnect();
                                }
                                location.reload();
                            }, 2000);
                        }
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Failed to save game history:', error);
                    alert('게임 종료! 하지만 기록 저장에 실패했습니다.');
                }
            });
        }
    }
}

// 대기방 목록 조회
function loadWaitingRooms() {
    $.ajax({
        url: '/api/rooms/waiting',
        method: 'GET',
        success: function(rooms) {
            const roomsList = $('#rooms-list').empty();
            if (rooms.length === 0) {
                roomsList.append('<p style="text-align: center; padding: 20px;">대기 중인 방이 없습니다.</p>');
            } else {
                rooms.forEach(room => {
                    let createdAtStr = '알 수 없음';
                    if (room.createdAt) {
                        try {
                            const date = new Date(room.createdAt);
                            if (!isNaN(date.getTime())) {
                                createdAtStr = date.toLocaleString('ko-KR', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                            }
                        } catch (e) {
                            console.error('Failed to parse date:', room.createdAt, e);
                        }
                    }
                    
                    const roomElement = $(`
                        <div style="padding: 15px; margin: 10px 0; border: 2px solid #ffcc00; border-radius: 10px; background: #fff; cursor: pointer;">
                            <div style="font-size: 1.2rem; font-weight: bold;">${room.hostName} 대기 중...</div>
                            <div style="font-size: 0.9rem; color: #666; margin-top: 5px;">
                                생성 시간: ${createdAtStr}
                            </div>
                        </div>
                    `);
                    roomElement.on('click', () => joinRoom(room.id));
                    roomsList.append(roomElement);
                });
            }
        },
        error: function() {
            alert('대기방 목록을 불러오는데 실패했습니다.');
        }
    });
}

// 방 생성
function createRoom() {
    const name = $('#username').val();
    if (!name) { alert('이름을 입력해주세요!'); return; }
    
    $.ajax({
        url: '/api/login',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ name: name }),
        success: function(user) {
            userId = user.id;
            userName = user.name;
            
            $.ajax({
                url: '/api/rooms',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ hostId: userId }),
                success: function(room) {
                    roomId = room.id;
                    isHost = true;
                    myColor = 'b'; // 방장은 흑색
                    opponentName = '상대방';
                    
                    const docEl = document.documentElement;
                    if (docEl.requestFullscreen) docEl.requestFullscreen();
                    
                    $('#waiting-rooms-container').hide();
                    $('#login-container').hide();
                    $('#game-container').show();
                    
                    initBoard();
                    connectWebSocket(roomId);
                    
                    if (typeof initSpeechRecognition === 'function') {
                        initSpeechRecognition();
                    }
                    
                    setTimeout(() => {
                        $('#ai-message').text('방을 만들었어요! 상대방이 들어올 때까지 기다려주세요...');
                    }, 500);
                },
                error: function() {
                    alert('방 생성에 실패했습니다.');
                }
            });
        }
    });
}

// 방 참여
function joinRoom(targetRoomId) {
    const name = $('#username').val();
    if (!name) { alert('이름을 입력해주세요!'); return; }
    
    $.ajax({
        url: '/api/login',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ name: name }),
        success: function(user) {
            userId = user.id;
            userName = user.name;
            
            $.ajax({
                url: '/api/rooms/' + targetRoomId + '/join',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ guestId: userId }),
                success: function(gameState) {
                    roomId = targetRoomId;
                    isHost = false;
                    myColor = 'w'; // 참여자는 백색
                    opponentName = gameState.hostName || '상대방';
                    
                    const docEl = document.documentElement;
                    if (docEl.requestFullscreen) docEl.requestFullscreen();
                    
                    $('#waiting-rooms-container').hide();
                    $('#login-container').hide();
                    $('#game-container').show();
                    
                    if (gameState.boardState) {
                        updateBoardFromState(gameState.boardState, gameState.turn);
                    }
                    
                    initBoard();
                    connectWebSocket(roomId);
                    
                    if (typeof initSpeechRecognition === 'function') {
                        initSpeechRecognition();
                    }
                    
                    setTimeout(() => {
                        const message = `${gameState.hostName}님과의 게임이 시작되었습니다!`;
                        $('#ai-message').text(message);
                        speak(message);
                    }, 500);
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON?.message || '방 참여에 실패했습니다.';
                    alert(errorMsg);
                }
            });
        }
    });
}

