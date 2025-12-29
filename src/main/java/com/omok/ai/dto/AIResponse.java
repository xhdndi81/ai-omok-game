package com.omok.ai.dto;

public class AIResponse {
    private String move; // "row,col" format for omok
    private String comment; // Friendly comment for kids

    public AIResponse() {}

    public AIResponse(String move, String comment) {
        this.move = move;
        this.comment = comment;
    }

    public String getMove() { return move; }
    public void setMove(String move) { this.move = move; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}

