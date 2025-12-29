package com.omok.ai.dto;

public class GameStateDto {
    private String boardState; // JSON 문자열: {"board":[[0,0,0,...],...], "turn":"b"}
    private String turn; // 'b' (흑) 또는 'w' (백)
    private String status; // WAITING, PLAYING, FINISHED
    private Boolean isGameOver;
    private String winner; // 'b', 'w', 'draw', 또는 null
    private String hostName;
    private String guestName;
    private String message; // 선택적 메시지 전달용

    public GameStateDto() {}

    public GameStateDto(String boardState, String turn, String status, Boolean isGameOver, String winner, String hostName, String guestName) {
        this.boardState = boardState;
        this.turn = turn;
        this.status = status;
        this.isGameOver = isGameOver;
        this.winner = winner;
        this.hostName = hostName;
        this.guestName = guestName;
        this.message = null;
    }

    public GameStateDto(String boardState, String turn, String status, Boolean isGameOver, String winner, String hostName, String guestName, String message) {
        this.boardState = boardState;
        this.turn = turn;
        this.status = status;
        this.isGameOver = isGameOver;
        this.winner = winner;
        this.hostName = hostName;
        this.guestName = guestName;
        this.message = message;
    }

    public String getBoardState() { return boardState; }
    public void setBoardState(String boardState) { this.boardState = boardState; }
    public String getTurn() { return turn; }
    public void setTurn(String turn) { this.turn = turn; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Boolean getIsGameOver() { return isGameOver; }
    public void setIsGameOver(Boolean isGameOver) { this.isGameOver = isGameOver; }
    public String getWinner() { return winner; }
    public void setWinner(String winner) { this.winner = winner; }
    public String getHostName() { return hostName; }
    public void setHostName(String hostName) { this.hostName = hostName; }
    public String getGuestName() { return guestName; }
    public void setGuestName(String guestName) { this.guestName = guestName; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}

