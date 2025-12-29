package com.omok.ai.service;

import com.omok.ai.dto.GameHistoryDto;
import com.omok.ai.entity.GameHistory;
import com.omok.ai.entity.User;
import com.omok.ai.repository.GameHistoryRepository;
import com.omok.ai.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final GameHistoryRepository gameHistoryRepository;

    public UserService(UserRepository userRepository, GameHistoryRepository gameHistoryRepository) {
        this.userRepository = userRepository;
        this.gameHistoryRepository = gameHistoryRepository;
    }

    @Transactional
    public User loginOrRegister(String name) {
        return userRepository.findByName(name)
                .orElseGet(() -> {
                    User newUser = new User();
                    newUser.setName(name);
                    return userRepository.save(newUser);
                });
    }

    public List<GameHistoryDto> getGameHistory(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        // 오목 프로젝트에서는 OMOK 게임만 조회
        List<GameHistory> histories = gameHistoryRepository.findByUserAndGameTypeOrderByPlayedAtDesc(user, GameHistory.GameType.OMOK);
        return histories.stream()
                .map(h -> new GameHistoryDto(
                        h.getId(),
                        h.getUser().getName(),
                        h.getResult(),
                        h.getGameType(),
                        h.getMovesCount(),
                        h.getOpponentName(),
                        h.getPlayedAt()
                ))
                .collect(Collectors.toList());
    }

    @Transactional
    public void saveGameResult(Long userId, GameHistory.GameResult result, int movesCount, String opponentName, GameHistory.GameType gameType) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        
        GameHistory history = new GameHistory();
        history.setUser(user);
        history.setResult(result);
        history.setGameType(gameType);
        history.setMovesCount(movesCount);
        history.setOpponentName(opponentName);
        gameHistoryRepository.save(history);
    }
}

