package com.omok.ai.service;

import com.omok.ai.dto.AIRequest;
import com.omok.ai.dto.AIResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AIService {

    private static final Logger log = LoggerFactory.getLogger(AIService.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    
    public AIService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @Value("${openai.api.key}")
    private String apiKey;

    @Value("${openai.api.url}")
    private String apiUrl;

    public AIResponse getNextMove(AIRequest request) {
        // 기존 메서드는 유지하거나 getCommentForMove를 사용하도록 변경 가능
        return getCommentForMove(request, null);
    }

    public AIResponse getCommentForMove(AIRequest request, String calculatedMove) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        String systemPrompt = "당신은 세계 최고의 오목 고수이자 아이들을 가르치는 선생님입니다. " +
                "현재 오목판 상태를 분석하여 아이에게 따뜻한 격려와 조언을 해주세요. " +
                "**중요: 멘트는 반드시 1~2문장 내외로 짧고 간결하게 작성하세요.** " +
                "아이가 지루해하지 않도록 핵심만 전달하며 친절하게 대화하세요. " +
                "응답은 반드시 JSON 형식: {\"comment\": \"멘트\"} 로만 보내세요.";

        StringBuilder userPrompt = new StringBuilder();
        userPrompt.append("현재 보드 상태 (JSON): ").append(request.getBoardState()).append("\n");
        userPrompt.append("당신의 차례입니다 (").append(request.getTurn()).append(" - b는 흑, w는 백)\n");
        userPrompt.append("대결 상대(아이)의 이름: ").append(request.getUserName()).append("\n");
        
        String difficultyName = switch(request.getDifficulty()) {
            case 0 -> "쉬움 (초보)";
            case 1 -> "보통";
            case 2 -> "어려움";
            case 3 -> "마스터";
            default -> "보통";
        };
        userPrompt.append("현재 게임 난이도: ").append(difficultyName).append("\n");
        
        if (calculatedMove != null) {
            userPrompt.append("당신이 이번에 둘 좌표: ").append(calculatedMove).append("\n");
            userPrompt.append("**아이에게 건넬 짧고 다정한 1~2문장의 멘트를 작성하세요.**\n");
        }
        
        userPrompt.append("**반드시 아이의 이름을 부르며 핵심만 짧게 격려하세요.**");

        Map<String, Object> body = new HashMap<>();
        body.put("model", "gpt-4o-mini");

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        messages.add(Map.of("role", "user", "content", userPrompt.toString()));

        body.put("messages", messages);
        body.put("response_format", Map.of("type", "json_object"));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            String responseStr = restTemplate.postForObject(apiUrl, entity, String.class);
            JsonNode root = objectMapper.readTree(responseStr);
            String content = root.path("choices").get(0).path("message").path("content").asText();

            JsonNode responseJson = objectMapper.readTree(content);
            String comment = responseJson.path("comment").asText();
            
            return new AIResponse(calculatedMove, comment);
        } catch (Exception e) {
            log.error("Error calling OpenAI API", e);
            return new AIResponse(calculatedMove, "미안해요, " + request.getUserName() + "야. 선생님이 잠시 생각에 빠졌나 봐요. 다시 한번 해볼까요?");
        }
    }
}

