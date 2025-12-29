package com.omok.ai.repository;

import com.omok.ai.entity.OmokGameData;
import com.omok.ai.entity.GameRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OmokGameDataRepository extends JpaRepository<OmokGameData, Long> {
    Optional<OmokGameData> findByRoom(GameRoom room);
    Optional<OmokGameData> findByRoomId(Long roomId);
}

