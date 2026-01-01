package com.omok.ai.service;

import com.omok.ai.entity.GameRoom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class RoomCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(RoomCleanupScheduler.class);

    private final GameRoomService gameRoomService;

    public RoomCleanupScheduler(GameRoomService gameRoomService) {
        this.gameRoomService = gameRoomService;
    }

    @Scheduled(fixedRate = 300000) // 5분마다 실행
    @Transactional
    public void cleanupOldRooms() {
        LocalDateTime now = LocalDateTime.now();
        int deletedCount = 0;

        try {
            // FINISHED 방 정리 (10분 경과)
            LocalDateTime finishedThreshold = now.minusMinutes(10);
            List<GameRoom> finishedRooms = gameRoomService.findRoomsByStatusAndCreatedAtBefore(
                    GameRoom.RoomStatus.FINISHED, finishedThreshold);
            
            for (GameRoom room : finishedRooms) {
                try {
                    gameRoomService.deleteRoom(room.getId());
                    deletedCount++;
                    log.debug("Deleted finished room {} (created at {})", room.getId(), room.getCreatedAt());
                } catch (Exception e) {
                    log.error("Error deleting finished room {}: {}", room.getId(), e.getMessage());
                }
            }

            // WAITING 방 정리 (30분 경과)
            LocalDateTime waitingThreshold = now.minusMinutes(30);
            List<GameRoom> waitingRooms = gameRoomService.findRoomsByStatusAndCreatedAtBefore(
                    GameRoom.RoomStatus.WAITING, waitingThreshold);
            
            for (GameRoom room : waitingRooms) {
                try {
                    gameRoomService.deleteRoom(room.getId());
                    deletedCount++;
                    log.debug("Deleted waiting room {} (created at {})", room.getId(), room.getCreatedAt());
                } catch (Exception e) {
                    log.error("Error deleting waiting room {}: {}", room.getId(), e.getMessage());
                }
            }

            // PLAYING 상태이지만 시작된 지 2시간 이상 경과한 방 정리 (비정상 종료)
            LocalDateTime playingThreshold = now.minusHours(2);
            List<GameRoom> playingRooms = gameRoomService.findRoomsByStatusAndStartedAtBefore(
                    GameRoom.RoomStatus.PLAYING, playingThreshold);
            
            for (GameRoom room : playingRooms) {
                try {
                    gameRoomService.deleteRoom(room.getId());
                    deletedCount++;
                    log.debug("Deleted stale playing room {} (started at {})", room.getId(), room.getStartedAt());
                } catch (Exception e) {
                    log.error("Error deleting stale playing room {}: {}", room.getId(), e.getMessage());
                }
            }

            if (deletedCount > 0) {
                log.info("Room cleanup completed: {} rooms deleted", deletedCount);
            }
        } catch (Exception e) {
            log.error("Error during room cleanup: {}", e.getMessage(), e);
        }
    }
}

