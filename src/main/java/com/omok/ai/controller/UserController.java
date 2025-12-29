package com.omok.ai.controller;

import com.omok.ai.dto.GameHistoryDto;
import com.omok.ai.entity.GameHistory;
import com.omok.ai.entity.User;
import com.omok.ai.service.UserService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/login")
    public User login(@RequestBody Map<String, String> request) {
        return userService.loginOrRegister(request.get("name"));
    }

    @GetMapping("/history/{userId}")
    public List<GameHistoryDto> getHistory(@PathVariable Long userId) {
        return userService.getGameHistory(userId);
    }

    @PostMapping("/history/{userId}")
    public void saveHistory(@PathVariable Long userId, @RequestBody Map<String, Object> request) {
        String resultStr = (String) request.get("result");
        int movesCount = request.get("movesCount") instanceof Integer ? 
                        (Integer) request.get("movesCount") : 
                        ((Number) request.get("movesCount")).intValue();
        String opponentName = (String) request.getOrDefault("opponentName", "AI");
        String gameTypeStr = (String) request.getOrDefault("gameType", "OMOK");
        GameHistory.GameType gameType = GameHistory.GameType.valueOf(gameTypeStr.toUpperCase());
        userService.saveGameResult(userId, GameHistory.GameResult.valueOf(resultStr.toUpperCase()), movesCount, opponentName, gameType);
    }
}

