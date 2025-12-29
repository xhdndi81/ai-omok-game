package com.omok.ai.dto;

import com.omok.ai.entity.GameHistory;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
public class GameHistoryDto {
    private Long id;
    private String userName;
    private GameHistory.GameResult result;
    private GameHistory.GameType gameType;
    private int movesCount;
    private String opponentName;
    private LocalDateTime playedAt;
    
    public GameHistoryDto(Long id, String userName, GameHistory.GameResult result, 
                          GameHistory.GameType gameType, int movesCount, 
                          String opponentName, LocalDateTime playedAt) {
        this.id = id;
        this.userName = userName;
        this.result = result;
        this.gameType = gameType;
        this.movesCount = movesCount;
        this.opponentName = opponentName;
        this.playedAt = playedAt;
    }
}

