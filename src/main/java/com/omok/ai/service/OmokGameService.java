package com.omok.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class OmokGameService {

    private static final Logger log = LoggerFactory.getLogger(OmokGameService.class);
    private static final int BOARD_SIZE = 15;
    private static final int WIN_COUNT = 5;

    private final ObjectMapper objectMapper;

    public OmokGameService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * 빈 보드 상태 JSON 생성
     */
    public String createEmptyBoardState() {
        try {
            int[][] board = new int[BOARD_SIZE][BOARD_SIZE];
            // 0으로 초기화 (이미 기본값이 0이지만 명시적으로)
            for (int i = 0; i < BOARD_SIZE; i++) {
                for (int j = 0; j < BOARD_SIZE; j++) {
                    board[i][j] = 0;
                }
            }
            
            String json = objectMapper.writeValueAsString(new BoardState(board, "b"));
            return json;
        } catch (Exception e) {
            log.error("Error creating empty board state", e);
            return "{\"board\":[],\"turn\":\"b\"}";
        }
    }

    /**
     * 보드 상태 파싱
     */
    public int[][] parseBoard(String boardStateJson) {
        try {
            JsonNode root = objectMapper.readTree(boardStateJson);
            JsonNode boardNode = root.get("board");
            int[][] board = new int[BOARD_SIZE][BOARD_SIZE];
            
            for (int i = 0; i < BOARD_SIZE && i < boardNode.size(); i++) {
                JsonNode row = boardNode.get(i);
                for (int j = 0; j < BOARD_SIZE && j < row.size(); j++) {
                    board[i][j] = row.get(j).asInt();
                }
            }
            return board;
        } catch (Exception e) {
            log.error("Error parsing board state", e);
            return new int[BOARD_SIZE][BOARD_SIZE];
        }
    }

    /**
     * 보드 상태를 JSON 문자열로 변환
     */
    public String boardToJson(int[][] board, String turn) {
        try {
            return objectMapper.writeValueAsString(new BoardState(board, turn));
        } catch (Exception e) {
            log.error("Error converting board to JSON", e);
            return createEmptyBoardState();
        }
    }

    /**
     * 수 검증 (범위 체크, 빈 칸 체크)
     */
    public boolean isValidMove(int[][] board, int row, int col) {
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
            return false;
        }
        return board[row][col] == 0; // 빈 칸인지 확인
    }

    /**
     * 수 두기
     */
    public int[][] makeMove(int[][] board, int row, int col, int player) {
        if (!isValidMove(board, row, col)) {
            throw new IllegalArgumentException("Invalid move");
        }
        
        int[][] newBoard = copyBoard(board);
        newBoard[row][col] = player;
        return newBoard;
    }

    /**
     * 보드 복사
     */
    private int[][] copyBoard(int[][] board) {
        int[][] newBoard = new int[BOARD_SIZE][BOARD_SIZE];
        for (int i = 0; i < BOARD_SIZE; i++) {
            System.arraycopy(board[i], 0, newBoard[i], 0, BOARD_SIZE);
        }
        return newBoard;
    }

    /**
     * 승리 판정 (5목 확인)
     * @return 승리한 플레이어 (1: 흑, 2: 백), 없으면 0
     */
    public int checkWinner(int[][] board) {
        // 가로, 세로, 대각선(/, \) 방향으로 5목 확인
        int[] directions = {0, 1, 1, 0, 1, 1, 1, -1}; // dx, dy 쌍
        
        for (int i = 0; i < BOARD_SIZE; i++) {
            for (int j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j] == 0) continue;
                
                int player = board[i][j];
                
                // 4방향 확인 (가로, 세로, 대각선 2개)
                for (int d = 0; d < directions.length; d += 2) {
                    int dx = directions[d];
                    int dy = directions[d + 1];
                    
                    if (countConsecutive(board, i, j, dx, dy, player) >= WIN_COUNT) {
                        return player;
                    }
                }
            }
        }
        return 0; // 승자 없음
    }

    /**
     * 연속된 돌 개수 세기
     */
    private int countConsecutive(int[][] board, int row, int col, int dx, int dy, int player) {
        int count = 1; // 현재 위치 포함
        
        // 정방향
        for (int i = 1; i < WIN_COUNT; i++) {
            int newRow = row + dx * i;
            int newCol = col + dy * i;
            if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) {
                break;
            }
            if (board[newRow][newCol] != player) {
                break;
            }
            count++;
        }
        
        // 역방향
        for (int i = 1; i < WIN_COUNT; i++) {
            int newRow = row - dx * i;
            int newCol = col - dy * i;
            if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) {
                break;
            }
            if (board[newRow][newCol] != player) {
                break;
            }
            count++;
        }
        
        return count;
    }

    /**
     * 게임 종료 여부 확인 (승리 또는 무승부)
     */
    public boolean isGameOver(int[][] board) {
        if (checkWinner(board) != 0) {
            return true;
        }
        // 보드가 가득 찼는지 확인
        for (int i = 0; i < BOARD_SIZE; i++) {
            for (int j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j] == 0) {
                    return false;
                }
            }
        }
        return true; // 무승부
    }

    /**
     * 플레이어 번호 변환 ('b' -> 1, 'w' -> 2)
     */
    public int playerToInt(String player) {
        return "b".equals(player) ? 1 : 2;
    }

    /**
     * 플레이어 번호를 문자열로 변환 (1 -> 'b', 2 -> 'w')
     */
    public String intToPlayer(int player) {
        return player == 1 ? "b" : "w";
    }

    /**
     * 보드 상태 클래스 (JSON 직렬화용)
     */
    private static class BoardState {
        public int[][] board;
        public String turn;

        public BoardState(int[][] board, String turn) {
            this.board = board;
            this.turn = turn;
        }
    }
}

