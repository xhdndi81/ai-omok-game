package com.omok.ai.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "game_history")
public class GameHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GameResult result;

    @Enumerated(EnumType.STRING)
    @Column(name = "game_type", nullable = false, length = 20)
    private GameType gameType;

    private int movesCount;

    @Column(length = 100)
    private String opponentName; // 상대방 이름 (AI 또는 다른 플레이어)

    @CreationTimestamp
    private LocalDateTime playedAt;

    public GameHistory() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public GameResult getResult() { return result; }
    public void setResult(GameResult result) { this.result = result; }
    public GameType getGameType() { return gameType; }
    public void setGameType(GameType gameType) { this.gameType = gameType; }
    public int getMovesCount() { return movesCount; }
    public void setMovesCount(int movesCount) { this.movesCount = movesCount; }
    public String getOpponentName() { return opponentName; }
    public void setOpponentName(String opponentName) { this.opponentName = opponentName; }
    public LocalDateTime getPlayedAt() { return playedAt; }
    public void setPlayedAt(LocalDateTime playedAt) { this.playedAt = playedAt; }

    public enum GameResult {
        WIN, LOSS, DRAW
    }

    public enum GameType {
        OMOK,       // 오목
        CHESS,      // 체스 (향후 추가 가능)
        GO          // 바둑 (향후 추가 가능)
    }
}

