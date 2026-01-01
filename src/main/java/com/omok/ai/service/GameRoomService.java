package com.omok.ai.service;

import com.omok.ai.dto.GameStateDto;
import com.omok.ai.dto.RoomDto;
import com.omok.ai.entity.OmokGameData;
import com.omok.ai.entity.GameHistory;
import com.omok.ai.entity.GameRoom;
import com.omok.ai.entity.User;
import com.omok.ai.repository.OmokGameDataRepository;
import com.omok.ai.repository.GameHistoryRepository;
import com.omok.ai.repository.GameRoomRepository;
import com.omok.ai.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class GameRoomService {

    private static final Logger log = LoggerFactory.getLogger(GameRoomService.class);

    private final GameRoomRepository gameRoomRepository;
    private final OmokGameDataRepository omokGameDataRepository;
    private final UserRepository userRepository;
    private final GameHistoryRepository gameHistoryRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final OmokGameService omokGameService;

    public GameRoomService(GameRoomRepository gameRoomRepository, OmokGameDataRepository omokGameDataRepository, UserRepository userRepository, GameHistoryRepository gameHistoryRepository, SimpMessagingTemplate messagingTemplate, OmokGameService omokGameService) {
        this.gameRoomRepository = gameRoomRepository;
        this.omokGameDataRepository = omokGameDataRepository;
        this.userRepository = userRepository;
        this.gameHistoryRepository = gameHistoryRepository;
        this.messagingTemplate = messagingTemplate;
        this.omokGameService = omokGameService;
    }

    @Transactional
    public GameRoom createRoom(Long hostId) {
        User host = userRepository.findById(hostId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        GameRoom room = new GameRoom();
        room.setHost(host);
        room.setStatus(GameRoom.RoomStatus.WAITING);
        room.setGameType(GameRoom.GameType.OMOK);
        
        GameRoom savedRoom = gameRoomRepository.save(room);
        
        // OmokGameData 생성 (빈 보드)
        String initialBoardState = omokGameService.createEmptyBoardState();
        OmokGameData omokData = new OmokGameData(savedRoom, initialBoardState, "b");
        omokGameDataRepository.save(omokData);

        return savedRoom;
    }

    @Transactional
    public void handleUserDisconnect(Long userId) {
        // 오목 프로젝트에서는 OMOK 게임만 처리
        // 모든 상태의 방을 확인하여 유저가 참여 중인 방 처리
        List<GameRoom> allRooms = gameRoomRepository.findAll();
        for (GameRoom room : allRooms) {
            // OMOK 게임만 처리
            if (room.getGameType() != GameRoom.GameType.OMOK) continue;
            boolean isHost = room.getHost().getId().equals(userId);
            boolean isGuest = room.getGuest() != null && room.getGuest().getId().equals(userId);
            
            if (!isHost && !isGuest) continue;

            if (room.getStatus() == GameRoom.RoomStatus.PLAYING) {
                processDisconnectWin(room, isHost);
                // processDisconnectWin 후 방 상태를 다시 확인
                GameRoom updatedRoom = gameRoomRepository.findById(room.getId())
                        .orElse(null);
                if (updatedRoom != null && updatedRoom.getStatus() == GameRoom.RoomStatus.FINISHED) {
                    // 게스트가 null이면 (게스트가 나간 경우) 방 삭제
                    // 호스트가 나간 경우는 게스트가 남아있을 수 있으므로 삭제하지 않음
                    if (updatedRoom.getGuest() == null) {
                        deleteRoom(room.getId());
                    }
                }
            } else if (room.getStatus() == GameRoom.RoomStatus.WAITING) {
                if (isHost) {
                    // WAITING 상태 방에서 호스트가 나가면 즉시 방 삭제
                    deleteRoom(room.getId());
                    log.info("Waiting room {} deleted because host {} disconnected", room.getId(), userId);
                }
            } else if (room.getStatus() == GameRoom.RoomStatus.FINISHED) {
                if (isGuest) {
                    room.setGuest(null);
                    gameRoomRepository.save(room);
                    log.info("Guest {} left finished room {}", userId, room.getId());
                    // 게스트가 나간 후 호스트도 없으면 방 삭제
                    // (실제로는 호스트가 먼저 나갔을 수 있으므로 확인 필요)
                } else if (isHost) {
                    // 방장이 종료된 방에서 나가는 경우
                    log.info("Host {} left finished room {}", userId, room.getId());
                    // 게스트가 남아있다면 알림 전송
                    if (room.getGuest() != null) {
                        Map<String, Object> notification = new HashMap<>();
                        notification.put("status", "FINISHED");
                        notification.put("message", "방장이 나갔습니다. 방이 닫힙니다.");
                        messagingTemplate.convertAndSend("/topic/game/" + room.getId(), notification);
                    } else {
                        // 게스트도 없으면 방 삭제
                        deleteRoom(room.getId());
                    }
                }
            }
        }
    }

    private void processDisconnectWin(GameRoom room, boolean isHost) {
        String winner = isHost ? "w" : "b"; // 오목: 흑(b)이 먼저, 방장이 흑
        User winnerUser = isHost ? room.getGuest() : room.getHost();
        User loserUser = isHost ? room.getHost() : room.getGuest();
        
        String winnerName = winnerUser != null ? winnerUser.getName() : "상대방";
        String loserName = loserUser != null ? loserUser.getName() : "상대방";
        
        room.setStatus(GameRoom.RoomStatus.FINISHED);
        
        // OmokGameData 업데이트
        OmokGameData omokData = omokGameDataRepository.findByRoom(room)
                .orElseThrow(() -> new IllegalStateException("OmokGameData not found for room " + room.getId()));
        omokData.setWinner(winner);
        omokGameDataRepository.save(omokData);
        
        // 승패 기록 저장 (나간 사람 포함)
        saveGameHistory(winnerUser, GameHistory.GameResult.WIN, loserName, GameHistory.GameType.OMOK);
        saveGameHistory(loserUser, GameHistory.GameResult.LOSS, winnerName, GameHistory.GameType.OMOK);
        
        // 게스트가 나간 경우 게스트 정보 초기화
        if (!isHost) {
            room.setGuest(null);
        }
        
        gameRoomRepository.save(room);
        
        // 남은 플레이어에게 알림 전송
        GameStateDto gameState = getGameState(room.getId());
        Map<String, Object> notification = new HashMap<>();
        notification.put("boardState", gameState.getBoardState());
        notification.put("turn", gameState.getTurn());
        notification.put("status", "FINISHED");
        notification.put("isGameOver", true);
        notification.put("winner", winner);
        notification.put("hostName", gameState.getHostName());
        notification.put("guestName", gameState.getGuestName());
        notification.put("message", loserName + "님이 나갔습니다. " + winnerName + "님이 승리했습니다!");
        
        messagingTemplate.convertAndSend("/topic/game/" + room.getId(), notification);
        log.info("User in room {} disconnected. Automatic win for {}", room.getId(), winner);
    }

    private void saveGameHistory(User user, GameHistory.GameResult result, String opponentName, GameHistory.GameType gameType) {
        if (user == null) return;
        
        GameHistory history = new GameHistory();
        history.setUser(user);
        history.setResult(result);
        history.setGameType(gameType);
        history.setOpponentName(opponentName);
        history.setMovesCount(0); // 기권/이탈 시 수 카운트는 일단 0으로 처리
        gameHistoryRepository.save(history);
        log.info("Saved game history for user {}: {}", user.getName(), result);
    }

    public List<RoomDto> getWaitingRooms() {
        // 오목 프로젝트에서는 OMOK 게임만 조회
        return gameRoomRepository.findByStatusAndGameTypeOrderByCreatedAtDesc(GameRoom.RoomStatus.WAITING, GameRoom.GameType.OMOK)
                .stream()
                .map(room -> new RoomDto(
                        room.getId(),
                        room.getHost().getName(),
                        room.getStatus().name(),
                        room.getCreatedAt()
                ))
                .collect(Collectors.toList());
    }

    @Transactional
    public GameRoom joinRoom(Long roomId, Long guestId) {
        GameRoom room = gameRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        if (room.getStatus() != GameRoom.RoomStatus.WAITING) {
            throw new IllegalStateException("Room is not available");
        }

        if (room.getHost().getId().equals(guestId)) {
            throw new IllegalStateException("Cannot join your own room");
        }

        User guest = userRepository.findById(guestId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        room.setGuest(guest);
        room.setStatus(GameRoom.RoomStatus.PLAYING);
        room.setStartedAt(LocalDateTime.now());

        GameRoom savedRoom = gameRoomRepository.save(room);
        
        // 참여자 입장 알림을 WebSocket으로 브로드캐스트
        GameStateDto gameState = getGameState(roomId);
        // 메시지 필드를 추가하기 위해 Map 사용
        Map<String, Object> notification = new HashMap<>();
        notification.put("boardState", gameState.getBoardState());
        notification.put("turn", gameState.getTurn());
        notification.put("status", gameState.getStatus());
        notification.put("isGameOver", gameState.getIsGameOver());
        notification.put("winner", gameState.getWinner());
        notification.put("hostName", gameState.getHostName());
        notification.put("guestName", gameState.getGuestName());
        notification.put("message", guest.getName() + "님이 게임에 참여했습니다! 게임을 시작합니다.");
        
        messagingTemplate.convertAndSend("/topic/game/" + roomId, notification);
        
        return savedRoom;
    }

    @Transactional
    public GameStateDto makeMove(Long roomId, Integer row, Integer col, String boardState, String turn, Long userId) {
        GameRoom room = gameRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        if (room.getStatus() != GameRoom.RoomStatus.PLAYING) {
            throw new IllegalStateException("Game is not in progress");
        }

        // OmokGameData 조회
        OmokGameData omokData = omokGameDataRepository.findByRoom(room)
                .orElseThrow(() -> new IllegalStateException("OmokGameData not found for room " + roomId));

        // 차례 확인
        String currentTurn = omokData.getTurn();
        boolean isHostTurn = currentTurn.equals("b") && room.getHost().getId().equals(userId);
        boolean isGuestTurn = currentTurn.equals("w") && room.getGuest() != null && room.getGuest().getId().equals(userId);

        if (!isHostTurn && !isGuestTurn) {
            throw new IllegalStateException("Not your turn");
        }

        // 보드 상태와 차례 업데이트
        omokData.setBoardState(boardState);
        omokData.setTurn(turn);
        
        // 승리 확인
        int[][] board = omokGameService.parseBoard(boardState);
        int winner = omokGameService.checkWinner(board);
        if (winner != 0) {
            room.setStatus(GameRoom.RoomStatus.FINISHED);
            omokData.setWinner(omokGameService.intToPlayer(winner));
        }
        
        omokGameDataRepository.save(omokData);
        gameRoomRepository.save(room);

        return getGameState(roomId);
    }

    public GameStateDto getGameState(Long roomId) {
        GameRoom room = gameRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        boolean isGameOver = room.getStatus() == GameRoom.RoomStatus.FINISHED;

        // OmokGameData 조회
        OmokGameData omokData = omokGameDataRepository.findByRoom(room)
                .orElseThrow(() -> new IllegalStateException("OmokGameData not found for room " + roomId));

        return new GameStateDto(
                omokData.getBoardState(),
                omokData.getTurn(),
                room.getStatus().name(),
                isGameOver,
                omokData.getWinner(),
                room.getHost().getName(),
                room.getGuest() != null ? room.getGuest().getName() : null
        );
    }

    @Transactional
    public void updateGameState(Long roomId, String boardState, String turn, boolean isGameOver, String winner, String status) {
        GameRoom room = gameRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        // OmokGameData 조회 또는 생성
        OmokGameData omokData = omokGameDataRepository.findByRoom(room)
                .orElseGet(() -> {
                    String emptyBoard = omokGameService.createEmptyBoardState();
                    OmokGameData newData = new OmokGameData(room, emptyBoard, "b");
                    return omokGameDataRepository.save(newData);
                });

        omokData.setBoardState(boardState);
        omokData.setTurn(turn);

        if (isGameOver) {
            room.setStatus(GameRoom.RoomStatus.FINISHED);
            omokData.setWinner(winner);
        } else {
            // 명시적인 상태 전달이 있으면 해당 상태로 변경 (예: WAITING)
            if ("WAITING".equals(status)) {
                room.setStatus(GameRoom.RoomStatus.WAITING);
                omokData.setWinner(null);
                // 새 게임 시작을 위해 초기 보드로 리셋
                String emptyBoard = omokGameService.createEmptyBoardState();
                omokData.setBoardState(emptyBoard);
                omokData.setTurn("b");
                room.setGuest(null);
                room.setStartedAt(null);
                log.info("Room {} manually set to WAITING status", roomId);
            } 
            // 게임이 종료되지 않았고, 현재 상태가 FINISHED라면 새 게임 시작
            else if (room.getStatus() == GameRoom.RoomStatus.FINISHED) {
                // 상대방이 없으면 WAITING 상태로 변경 (대기방 목록에 나타나도록)
                if (room.getGuest() == null) {
                    room.setStatus(GameRoom.RoomStatus.WAITING);
                    omokData.setWinner(null);
                    // 새 게임 시작을 위해 초기 보드로 리셋
                    String emptyBoard = omokGameService.createEmptyBoardState();
                    omokData.setBoardState(emptyBoard);
                    omokData.setTurn("b");
                    room.setGuest(null); // 명시적으로 null 설정
                    room.setStartedAt(null); // 시작 시간 초기화
                    log.info("Room {} reset to WAITING status for new game (no guest)", roomId);
                } else {
                    // 상대방이 있으면 PLAYING 상태로 변경
                    room.setStatus(GameRoom.RoomStatus.PLAYING);
                    omokData.setWinner(null);
                    // 새 게임 시작을 위해 초기 보드로 리셋
                    String emptyBoard = omokGameService.createEmptyBoardState();
                    omokData.setBoardState(emptyBoard);
                    omokData.setTurn("b");
                    log.info("Room {} reset to PLAYING status for new game (with guest)", roomId);
                }
            }
        }

        omokGameDataRepository.save(omokData);
        gameRoomRepository.save(room);
    }

    @Transactional
    public GameStateDto sendNudgeMessage(Long roomId, Long fromUserId) {
        GameRoom room = gameRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        if (room.getStatus() != GameRoom.RoomStatus.PLAYING) {
            log.warn("Cannot send nudge message: Room {} is not in PLAYING status", roomId);
            return getGameState(roomId);
        }

        // 재촉한 사용자와 상대방 식별
        // 사용자 존재 여부 확인
        if (!userRepository.existsById(fromUserId)) {
            log.warn("User {} not found for nudge message", fromUserId);
            return getGameState(roomId);
        }

        User opponentUser = null;
        String opponentName = null;
        
        if (room.getHost().getId().equals(fromUserId)) {
            // 방장이 재촉한 경우, 상대방은 게스트
            opponentUser = room.getGuest();
            opponentName = opponentUser != null ? opponentUser.getName() : null;
        } else if (room.getGuest() != null && room.getGuest().getId().equals(fromUserId)) {
            // 게스트가 재촉한 경우, 상대방은 방장
            opponentUser = room.getHost();
            opponentName = opponentUser != null ? opponentUser.getName() : null;
        }

        if (opponentName == null) {
            log.warn("Cannot send nudge message: Opponent not found for room {}", roomId);
            return getGameState(roomId);
        }

        // 재촉 메시지 배열 (랜덤 선택)
        String[] nudgeMessages = {
            opponentName + "님, 빨리 두세요~ 😊",
            opponentName + "님, 기다리고 있어요! 💕",
            opponentName + "님, 생각이 오래 걸리네요! ⏰",
            opponentName + "님, 빨리빨리! 🚀"
        };

        // 랜덤으로 메시지 선택
        String selectedMessage = nudgeMessages[(int) (Math.random() * nudgeMessages.length)];

        // 현재 게임 상태 가져오기
        GameStateDto gameState = getGameState(roomId);
        
        // 메시지를 포함한 GameStateDto 생성
        GameStateDto nudgeState = new GameStateDto(
            gameState.getBoardState(),
            gameState.getTurn(),
            gameState.getStatus(),
            gameState.getIsGameOver(),
            gameState.getWinner(),
            gameState.getHostName(),
            gameState.getGuestName(),
            selectedMessage
        );

        // 브로드캐스트는 @SendTo 어노테이션이 처리하므로 여기서는 반환만 함
        log.info("Nudge message created for room {}: {}", roomId, selectedMessage);
        
        return nudgeState;
    }

    @Transactional
    public GameStateDto sendVoiceMessage(Long roomId, Long fromUserId, String message) {
        GameRoom room = gameRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        if (room.getStatus() != GameRoom.RoomStatus.PLAYING) {
            log.warn("Cannot send voice message: Room {} is not in PLAYING status", roomId);
            return getGameState(roomId);
        }

        // 사용자 존재 여부 확인
        if (!userRepository.existsById(fromUserId)) {
            log.warn("User {} not found for voice message", fromUserId);
            return getGameState(roomId);
        }

        // 현재 게임 상태 가져오기
        GameStateDto gameState = getGameState(roomId);
        
        // 메시지를 포함한 GameStateDto 생성
        GameStateDto voiceState = new GameStateDto(
            gameState.getBoardState(),
            gameState.getTurn(),
            gameState.getStatus(),
            gameState.getIsGameOver(),
            gameState.getWinner(),
            gameState.getHostName(),
            gameState.getGuestName(),
            message
        );
        
        log.info("Voice message created for room {}: {}", roomId, message);
        return voiceState;
    }

    @Transactional
    public void deleteRoom(Long roomId) {
        GameRoom room = gameRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));
        
        // OmokGameData 삭제
        omokGameDataRepository.findByRoom(room).ifPresent(omokGameDataRepository::delete);
        
        // GameRoom 삭제
        gameRoomRepository.delete(room);
        log.info("Room {} deleted", roomId);
    }

    @Transactional
    public void deleteRoomByHost(Long roomId, Long hostId) {
        GameRoom room = gameRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));
        
        // 방 소유자 확인
        if (!room.getHost().getId().equals(hostId)) {
            throw new IllegalStateException("Only room host can delete the room");
        }
        
        deleteRoom(roomId);
    }

    public List<GameRoom> findRoomsByStatusAndCreatedAtBefore(GameRoom.RoomStatus status, LocalDateTime dateTime) {
        return gameRoomRepository.findByStatusAndCreatedAtBefore(status, dateTime);
    }

    public List<GameRoom> findRoomsByStatusAndStartedAtBefore(GameRoom.RoomStatus status, LocalDateTime dateTime) {
        return gameRoomRepository.findByStatusAndStartedAtBefore(status, dateTime);
    }
}

