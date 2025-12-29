package com.omok.ai.dto;

public class AIRequest {
    private String boardState; // JSON 문자열: {"board":[[0,0,0,...],...], "turn":"b"}
    private String turn; // 'b' (흑) 또는 'w' (백)
    private String userName;
    private int difficulty; // 0: 쉬움, 1: 보통, 2: 어려움, 3: 마스터
    private String move; // 클라이언트가 결정한 AI의 수

    public AIRequest() {}

    public String getBoardState() { return boardState; }
    public void setBoardState(String boardState) { this.boardState = boardState; }
    public String getTurn() { return turn; }
    public void setTurn(String turn) { this.turn = turn; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public int getDifficulty() { return difficulty; }
    public void setDifficulty(int difficulty) { this.difficulty = difficulty; }
    public String getMove() { return move; }
    public void setMove(String move) { this.move = move; }
}

