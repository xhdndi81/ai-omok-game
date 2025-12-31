package com.omok.ai.controller;

import com.omok.ai.dto.AIRequest;
import com.omok.ai.dto.AIResponse;
import com.omok.ai.service.AIService;
import com.omok.ai.service.OmokAIService;
import com.omok.ai.service.OmokGameService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AIController {

    private final AIService aiService;
    private final OmokAIService omokAIService;
    private final OmokGameService omokGameService;

    public AIController(AIService aiService, OmokAIService omokAIService, OmokGameService omokGameService) {
        this.aiService = aiService;
        this.omokAIService = omokAIService;
        this.omokGameService = omokGameService;
    }

    @PostMapping("/move")
    public AIResponse getMove(@RequestBody AIRequest request) {
        String moveStr = request.getMove();
        
        // 만약 클라이언트에서 수를 보내지 않았다면 (기존 방식 호환용)
        if (moveStr == null || moveStr.isEmpty()) {
            int[][] board = omokGameService.parseBoard(request.getBoardState());
            int aiPlayer = omokGameService.playerToInt(request.getTurn());
            int[] move = omokAIService.getNextMove(board, aiPlayer, request.getDifficulty());
            moveStr = move[0] + "," + move[1];
        }
        
        // LLM을 통한 코멘트 생성
        AIResponse response = aiService.getCommentForMove(request, moveStr);
        response.setMove(moveStr);
        
        return response;
    }

    @PostMapping("/comment")
    public AIResponse getComment(@RequestBody AIRequest request, @RequestParam(required = false) String situation) {
        // 다양한 상황에 맞는 코멘트 생성
        return aiService.generateComment(request, null, situation);
    }
}

