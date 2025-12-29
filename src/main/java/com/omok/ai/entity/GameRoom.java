package com.omok.ai.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "game_rooms")
public class GameRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_id")
    private User guest;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoomStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "game_type", nullable = false, length = 20)
    private GameType gameType;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime startedAt;

    public GameRoom() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getHost() { return host; }
    public void setHost(User host) { this.host = host; }
    public User getGuest() { return guest; }
    public void setGuest(User guest) { this.guest = guest; }
    public RoomStatus getStatus() { return status; }
    public void setStatus(RoomStatus status) { this.status = status; }
    public GameType getGameType() { return gameType; }
    public void setGameType(GameType gameType) { this.gameType = gameType; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }

    public enum RoomStatus {
        WAITING,    // 대기 중
        PLAYING,    // 게임 진행 중
        FINISHED    // 게임 종료
    }

    public enum GameType {
        OMOK,       // 오목
        CHESS,      // 체스 (향후 추가 가능)
        GO          // 바둑 (향후 추가 가능)
    }
}

