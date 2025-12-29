package com.omok.ai.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Service
public class OmokAIService {

    private static final Logger log = LoggerFactory.getLogger(OmokAIService.class);
    private static final int BOARD_SIZE = 15;
    private final Random random = new Random();

    // 점수 상수 정의
    private static final int SCORE_FIVE = 100000;
    private static final int SCORE_LIVE_FOUR = 10000;
    private static final int SCORE_LIVE_THREE = 1000;
    private static final int SCORE_DEAD_THREE = 100;
    private static final int SCORE_LIVE_TWO = 100;
    private static final int SCORE_DEAD_TWO = 10;

    public OmokAIService() {
    }

    /**
     * AI가 다음 수를 결정
     */
    public int[] getNextMove(int[][] board, int aiPlayer, int difficulty) {
        int opponentPlayer = aiPlayer == 1 ? 2 : 1;
        
        log.info("AI thinking for player {} with difficulty {}", aiPlayer, difficulty);

        // 1단계: 즉시 승리하는 수 찾기
        int[] winMove = findImmediateWin(board, aiPlayer);
        if (winMove != null) return winMove;

        // 2단계: 상대의 즉시 승리 막기
        int[] blockWinMove = findImmediateWin(board, opponentPlayer);
        if (blockWinMove != null) return blockWinMove;

        // 3단계: 난이도에 따른 알고리즘 적용
        if (difficulty >= 2) {
            // 어려움 이상: Minimax (Alpha-Beta Pruning) 적용
            return findBestMoveMinimax(board, aiPlayer, difficulty);
        } else {
            // 보통 이하: 단순 가치 평가 기반
            return findBestMoveByScore(board, aiPlayer, opponentPlayer, difficulty);
        }
    }

    private int[] findImmediateWin(int[][] board, int player) {
        for (int i = 0; i < BOARD_SIZE; i++) {
            for (int j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j] == 0) {
                    if (checkWinWithMove(board, i, j, player)) {
                        return new int[]{i, j};
                    }
                }
            }
        }
        return null;
    }

    private boolean checkWinWithMove(int[][] board, int row, int col, int player) {
        int[] directions = {0, 1, 1, 0, 1, 1, 1, -1};
        for (int d = 0; d < directions.length; d += 2) {
            int dx = directions[d];
            int dy = directions[d + 1];
            if (countConsecutive(board, row, col, dx, dy, player) >= 5) {
                return true;
            }
        }
        return false;
    }

    private int countConsecutive(int[][] board, int row, int col, int dx, int dy, int player) {
        int count = 1;
        // 정방향
        for (int i = 1; i < 5; i++) {
            int r = row + dx * i, c = col + dy * i;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] != player) break;
            count++;
        }
        // 역방향
        for (int i = 1; i < 5; i++) {
            int r = row - dx * i, c = col - dy * i;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] != player) break;
            count++;
        }
        return count;
    }

    private int[] findBestMoveMinimax(int[][] board, int aiPlayer, int difficulty) {
        int depth = (difficulty >= 3) ? 4 : 2; // 마스터 4, 어려움 2
        BestMove best = minimax(board, depth, Integer.MIN_VALUE, Integer.MAX_VALUE, true, aiPlayer);
        return new int[]{best.row, best.col};
    }

    private static class BestMove {
        int row, col, score;
        BestMove(int r, int c, int s) { row = r; col = c; score = s; }
    }

    private BestMove minimax(int[][] board, int depth, int alpha, int beta, boolean isMax, int aiPlayer) {
        int opponent = aiPlayer == 1 ? 2 : 1;
        
        if (depth == 0) {
            return new BestMove(-1, -1, evaluateBoard(board, aiPlayer));
        }

        List<int[]> candidates = getCandidateMoves(board);
        if (candidates.isEmpty()) return new BestMove(-1, -1, 0);

        // Move Ordering: 유망한 수부터 탐색하도록 정렬 (Alpha-Beta Pruning 효율 극대화)
        sortCandidates(board, candidates, isMax ? aiPlayer : opponent, isMax ? opponent : aiPlayer);
        
        // 탐색 후보 제한 (성능을 위해 상위 20개만 고려)
        if (candidates.size() > 20) {
            candidates = candidates.subList(0, 20);
        }

        int bestRow = candidates.get(0)[0];
        int bestCol = candidates.get(0)[1];

        if (isMax) {
            int maxEval = Integer.MIN_VALUE;
            for (int[] move : candidates) {
                board[move[0]][move[1]] = aiPlayer;
                if (checkWinWithMove(board, move[0], move[1], aiPlayer)) {
                    board[move[0]][move[1]] = 0;
                    return new BestMove(move[0], move[1], SCORE_FIVE * (depth + 1));
                }
                int eval = minimax(board, depth - 1, alpha, beta, false, aiPlayer).score;
                board[move[0]][move[1]] = 0;
                if (eval > maxEval) {
                    maxEval = eval;
                    bestRow = move[0];
                    bestCol = move[1];
                }
                alpha = Math.max(alpha, eval);
                if (beta <= alpha) break;
            }
            return new BestMove(bestRow, bestCol, maxEval);
        } else {
            int minEval = Integer.MAX_VALUE;
            for (int[] move : candidates) {
                board[move[0]][move[1]] = opponent;
                if (checkWinWithMove(board, move[0], move[1], opponent)) {
                    board[move[0]][move[1]] = 0;
                    return new BestMove(move[0], move[1], -SCORE_FIVE * (depth + 1));
                }
                int eval = minimax(board, depth - 1, alpha, beta, true, aiPlayer).score;
                board[move[0]][move[1]] = 0;
                if (eval < minEval) {
                    minEval = eval;
                    bestRow = move[0];
                    bestCol = move[1];
                }
                beta = Math.min(beta, eval);
                if (beta <= alpha) break;
            }
            return new BestMove(bestRow, bestCol, minEval);
        }
    }

    private void sortCandidates(int[][] board, List<int[]> candidates, int currentPlayer, int opponent) {
        candidates.sort((a, b) -> {
            int scoreA = evaluateMoveQuickly(board, a[0], a[1], currentPlayer, opponent);
            int scoreB = evaluateMoveQuickly(board, b[0], b[1], currentPlayer, opponent);
            return Integer.compare(scoreB, scoreA);
        });
    }

    private int evaluateMoveQuickly(int[][] board, int row, int col, int player, int opponent) {
        int score = 0;
        // 단순하게 8방향 연속성만 체크하여 빠른 점수 산정
        int[] directions = {0, 1, 1, 0, 1, 1, 1, -1};
        for (int d = 0; d < directions.length; d += 2) {
            int dx = directions[d], dy = directions[d + 1];
            int pCount = countConsecutive(board, row, col, dx, dy, player);
            int oCount = countConsecutive(board, row, col, dx, dy, opponent);
            
            if (pCount >= 5) score += 10000;
            else if (oCount >= 5) score += 5000;
            else if (pCount == 4) score += 1000;
            else if (oCount == 4) score += 500;
            else score += (pCount + oCount);
        }
        return score;
    }

    private List<int[]> getCandidateMoves(int[][] board) {
        List<int[]> candidates = new ArrayList<>();
        // 돌이 놓여진 주변 2칸 이내만 후보로 선정 (성능 최적화)
        boolean[][] visited = new boolean[BOARD_SIZE][BOARD_SIZE];
        for (int i = 0; i < BOARD_SIZE; i++) {
            for (int j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j] != 0) {
                    for (int dr = -2; dr <= 2; dr++) {
                        for (int dc = -2; dc <= 2; dc++) {
                            int r = i + dr, c = j + dc;
                            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] == 0 && !visited[r][c]) {
                                visited[r][c] = true;
                                candidates.add(new int[]{r, c});
                            }
                        }
                    }
                }
            }
        }
        if (candidates.isEmpty()) {
            candidates.add(new int[]{7, 7});
        }
        return candidates;
    }

    private int evaluateBoard(int[][] board, int aiPlayer) {
        int score = 0;
        int opponent = aiPlayer == 1 ? 2 : 1;
        
        // 가로, 세로, 대각선 점수 합산
        score += evaluateDirections(board, aiPlayer);
        score -= evaluateDirections(board, opponent) * 1.2; // 방어에 약간 더 무게
        
        return score;
    }

    private int evaluateDirections(int[][] board, int player) {
        int totalScore = 0;
        // 가로
        for (int i = 0; i < BOARD_SIZE; i++) {
            for (int j = 0; j < BOARD_SIZE - 4; j++) {
                totalScore += getLineScore(board[i][j], board[i][j+1], board[i][j+2], board[i][j+3], board[i][j+4], player);
            }
        }
        // 세로
        for (int i = 0; i < BOARD_SIZE - 4; i++) {
            for (int j = 0; j < BOARD_SIZE; j++) {
                totalScore += getLineScore(board[i][j], board[i+1][j], board[i+2][j], board[i+3][j], board[i+4][j], player);
            }
        }
        // 대각선 \
        for (int i = 0; i < BOARD_SIZE - 4; i++) {
            for (int j = 0; j < BOARD_SIZE - 4; j++) {
                totalScore += getLineScore(board[i][j], board[i+1][j+1], board[i+2][j+2], board[i+3][j+3], board[i+4][j+4], player);
            }
        }
        // 대각선 /
        for (int i = 4; i < BOARD_SIZE; i++) {
            for (int j = 0; j < BOARD_SIZE - 4; j++) {
                totalScore += getLineScore(board[i][j], board[i-1][j+1], board[i-2][j+2], board[i-3][j+3], board[i-4][j+4], player);
            }
        }
        return totalScore;
    }

    private int getLineScore(int p1, int p2, int p3, int p4, int p5, int player) {
        int count = 0;
        int empty = 0;
        int[] line = {p1, p2, p3, p4, p5};
        
        for (int p : line) {
            if (p == player) count++;
            else if (p == 0) empty++;
            else return 0; // 상대방 돌이 섞여있으면 점수 없음
        }
        
        if (count == 5) return SCORE_FIVE;
        if (count == 4) return (empty == 1) ? SCORE_LIVE_FOUR : 0;
        if (count == 3) return (empty == 2) ? SCORE_LIVE_THREE : SCORE_DEAD_THREE;
        if (count == 2) return (empty == 3) ? SCORE_LIVE_TWO : SCORE_DEAD_TWO;
        if (count == 1) return (empty == 4) ? 1 : 0;
        
        return 0;
    }

    private int[] findBestMoveByScore(int[][] board, int aiPlayer, int opponentPlayer, int difficulty) {
        List<int[]> candidates = getCandidateMoves(board);
        int bestScore = Integer.MIN_VALUE;
        int[] bestMove = candidates.get(0);

        for (int[] move : candidates) {
            int score = evaluateMove(board, move[0], move[1], aiPlayer, opponentPlayer);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            } else if (score == bestScore && random.nextBoolean()) {
                bestMove = move;
            }
        }

        // 난이도에 따라 실수 유발
        if (difficulty == 0) {
            // 쉬움: 40% 확률로 랜덤하게 둠
            if (random.nextDouble() < 0.4) {
                return candidates.get(random.nextInt(candidates.size()));
            }
        } else if (difficulty == 1) {
            // 보통: 20% 확률로 랜덤하게 둠
            if (random.nextDouble() < 0.2) {
                return candidates.get(random.nextInt(candidates.size()));
            }
        }

        return bestMove;
    }

    private int evaluateMove(int[][] board, int row, int col, int aiPlayer, int opponentPlayer) {
        int score = 0;
        // 중앙 가중치
        score += (7 - Math.abs(row - 7)) + (7 - Math.abs(col - 7));
        
        // 공격 및 방어 점수
        board[row][col] = aiPlayer;
        score += evaluateDirectionsAt(board, row, col, aiPlayer);
        board[row][col] = opponentPlayer;
        score += evaluateDirectionsAt(board, row, col, opponentPlayer) * 0.9;
        board[row][col] = 0;
        
        return score;
    }

    private int evaluateDirectionsAt(int[][] board, int row, int col, int player) {
        int score = 0;
        int[] directions = {0, 1, 1, 0, 1, 1, 1, -1};
        for (int d = 0; d < directions.length; d += 2) {
            int dx = directions[d], dy = directions[d+1];
            // 해당 위치를 포함하는 모든 5칸 짜리 라인 평가
            for (int offset = -4; offset <= 0; offset++) {
                int r = row + dx * offset, c = col + dy * offset;
                if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE &&
                    r + dx * 4 >= 0 && r + dx * 4 < BOARD_SIZE &&
                    c + dy * 4 >= 0 && c + dy * 4 < BOARD_SIZE) {
                    score += getLineScore(
                        board[r][c], board[r+dx][c+dy], board[r+dx*2][c+dy*2], 
                        board[r+dx*3][c+dy*3], board[r+dx*4][c+dy*4], player);
                }
            }
        }
        return score;
    }
}
