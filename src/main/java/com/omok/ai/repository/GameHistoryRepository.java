package com.omok.ai.repository;

import com.omok.ai.entity.GameHistory;
import com.omok.ai.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GameHistoryRepository extends JpaRepository<GameHistory, Long> {
    List<GameHistory> findByUserOrderByPlayedAtDesc(User user);
    List<GameHistory> findByUserAndGameTypeOrderByPlayedAtDesc(User user, GameHistory.GameType gameType);
}

