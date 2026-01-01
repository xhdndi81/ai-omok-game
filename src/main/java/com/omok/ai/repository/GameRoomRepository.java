package com.omok.ai.repository;

import com.omok.ai.entity.GameRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface GameRoomRepository extends JpaRepository<GameRoom, Long> {
    List<GameRoom> findByStatusOrderByCreatedAtDesc(GameRoom.RoomStatus status);
    List<GameRoom> findByStatus(GameRoom.RoomStatus status);
    List<GameRoom> findByStatusAndGameTypeOrderByCreatedAtDesc(GameRoom.RoomStatus status, GameRoom.GameType gameType);
    List<GameRoom> findByStatusAndCreatedAtBefore(GameRoom.RoomStatus status, LocalDateTime dateTime);
    List<GameRoom> findByStatusAndStartedAtBefore(GameRoom.RoomStatus status, LocalDateTime dateTime);
}

