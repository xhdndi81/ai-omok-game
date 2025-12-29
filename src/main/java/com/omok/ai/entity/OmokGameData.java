package com.omok.ai.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "omok_game_data")
public class OmokGameData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false, unique = true)
    private GameRoom room;

    @Column(columnDefinition = "TEXT")
    private String boardState; // JSON 문자열: {"board":[[0,0,0,...],...], "turn":"b"}

    @Column(length = 10)
    private String turn; // 'b' (흑) 또는 'w' (백)

    @Column(length = 10)
    private String winner; // 'b', 'w', 'draw' 또는 null

    public OmokGameData() {}

    public OmokGameData(GameRoom room, String boardState, String turn) {
        this.room = room;
        this.boardState = boardState;
        this.turn = turn;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public GameRoom getRoom() { return room; }
    public void setRoom(GameRoom room) { this.room = room; }
    public String getBoardState() { return boardState; }
    public void setBoardState(String boardState) { this.boardState = boardState; }
    public String getTurn() { return turn; }
    public void setTurn(String turn) { this.turn = turn; }
    public String getWinner() { return winner; }
    public void setWinner(String winner) { this.winner = winner; }
}

