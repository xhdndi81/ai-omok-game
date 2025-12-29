/**
 * 클라이언트용 오목 AI 엔진 (Minimax + Alpha-Beta Pruning)
 */
class OmokAI {
    constructor() {
        this.BOARD_SIZE = 15;
        this.SCORE_FIVE = 100000;
        this.SCORE_LIVE_FOUR = 10000;
        this.SCORE_LIVE_THREE = 1000;
        this.SCORE_DEAD_THREE = 100;
        this.SCORE_LIVE_TWO = 100;
        this.SCORE_DEAD_TWO = 10;
    }

    getNextMove(board, aiPlayer, difficulty) {
        const opponent = aiPlayer === 1 ? 2 : 1;

        // 1. 즉시 승리/방어 확인
        let winMove = this.findImmediateWin(board, aiPlayer);
        if (winMove) return winMove;

        let blockMove = this.findImmediateWin(board, opponent);
        if (blockMove) return blockMove;

        // 2. 난이도별 알고리즘
        if (difficulty >= 2) {
            const depth = difficulty >= 3 ? 4 : 2;
            const result = this.minimax(board, depth, -Infinity, Infinity, true, aiPlayer);
            return [result.row, result.col];
        } else {
            return this.findBestMoveByScore(board, aiPlayer, opponent, difficulty);
        }
    }

    findImmediateWin(board, player) {
        for (let i = 0; i < this.BOARD_SIZE; i++) {
            for (let j = 0; j < this.BOARD_SIZE; j++) {
                if (board[i][j] === 0) {
                    if (this.checkWinWithMove(board, i, j, player)) {
                        return [i, j];
                    }
                }
            }
        }
        return null;
    }

    checkWinWithMove(board, row, col, player) {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (let [dx, dy] of directions) {
            if (this.countConsecutive(board, row, col, dx, dy, player) >= 5) return true;
        }
        return false;
    }

    countConsecutive(board, row, col, dx, dy, player) {
        let count = 1;
        // 정방향
        for (let i = 1; i < 5; i++) {
            let r = row + dx * i, c = col + dy * i;
            if (r < 0 || r >= 15 || c < 0 || c >= 15 || board[r][c] !== player) break;
            count++;
        }
        // 역방향
        for (let i = 1; i < 5; i++) {
            let r = row - dx * i, c = col - dy * i;
            if (r < 0 || r >= 15 || c < 0 || c >= 15 || board[r][c] !== player) break;
            count++;
        }
        return count;
    }

    minimax(board, depth, alpha, beta, isMax, aiPlayer) {
        const opponent = aiPlayer === 1 ? 2 : 1;
        if (depth === 0) return { score: this.evaluateBoard(board, aiPlayer) };

        const candidates = this.getCandidateMoves(board);
        if (candidates.length === 0) return { score: 0 };

        this.sortCandidates(board, candidates, isMax ? aiPlayer : opponent, isMax ? opponent : aiPlayer);
        const limitedCandidates = candidates.slice(0, 20);

        let bestRow = limitedCandidates[0][0];
        let bestCol = limitedCandidates[0][1];

        if (isMax) {
            let maxEval = -Infinity;
            for (let [r, c] of limitedCandidates) {
                board[r][c] = aiPlayer;
                if (this.checkWinWithMove(board, r, c, aiPlayer)) {
                    board[r][c] = 0;
                    return { row: r, col: c, score: this.SCORE_FIVE * (depth + 1) };
                }
                let ev = this.minimax(board, depth - 1, alpha, beta, false, aiPlayer).score;
                board[r][c] = 0;
                if (ev > maxEval) { maxEval = ev; bestRow = r; bestCol = c; }
                alpha = Math.max(alpha, ev);
                if (beta <= alpha) break;
            }
            return { row: bestRow, col: bestCol, score: maxEval };
        } else {
            let minEval = Infinity;
            for (let [r, c] of limitedCandidates) {
                board[r][c] = opponent;
                if (this.checkWinWithMove(board, r, c, opponent)) {
                    board[r][c] = 0;
                    return { row: r, col: c, score: -this.SCORE_FIVE * (depth + 1) };
                }
                let ev = this.minimax(board, depth - 1, alpha, beta, true, aiPlayer).score;
                board[r][c] = 0;
                if (ev < minEval) { minEval = ev; bestRow = r; bestCol = c; }
                beta = Math.min(beta, ev);
                if (beta <= alpha) break;
            }
            return { row: bestRow, col: bestCol, score: minEval };
        }
    }

    getCandidateMoves(board) {
        const candidates = [];
        const visited = Array.from({ length: 15 }, () => Array(15).fill(false));
        let hasStones = false;

        for (let i = 0; i < 15; i++) {
            for (let j = 0; j < 15; j++) {
                if (board[i][j] !== 0) {
                    hasStones = true;
                    for (let dr = -2; dr <= 2; dr++) {
                        for (let dc = -2; dc <= 2; dc++) {
                            let r = i + dr, c = j + dc;
                            if (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === 0 && !visited[r][c]) {
                                visited[r][c] = true;
                                candidates.push([r, c]);
                            }
                        }
                    }
                }
            }
        }
        return hasStones ? candidates : [[7, 7]];
    }

    sortCandidates(board, candidates, player, opponent) {
        candidates.sort((a, b) => {
            return this.evaluateMoveQuickly(board, b[0], b[1], player, opponent) - 
                   this.evaluateMoveQuickly(board, a[0], a[1], player, opponent);
        });
    }

    evaluateMoveQuickly(board, row, col, player, opponent) {
        let score = 0;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (let [dx, dy] of directions) {
            let pCount = this.countConsecutive(board, row, col, dx, dy, player);
            let oCount = this.countConsecutive(board, row, col, dx, dy, opponent);
            if (pCount >= 5) score += 10000;
            else if (oCount >= 5) score += 5000;
            else if (pCount === 4) score += 1000;
            else if (oCount === 4) score += 500;
            else score += (pCount + oCount);
        }
        return score;
    }

    evaluateBoard(board, aiPlayer) {
        let score = 0;
        const opponent = aiPlayer === 1 ? 2 : 1;
        score += this.evaluateDirections(board, aiPlayer);
        score -= this.evaluateDirections(board, opponent) * 1.2;
        return score;
    }

    evaluateDirections(board, player) {
        let total = 0;
        // 가로, 세로, 대각선 전체 스캔 (최적화 가능하지만 일단 이식)
        const checkLine = (r, c, dr, dc) => {
            let count = 0, empty = 0;
            for(let i=0; i<5; i++) {
                let p = board[r + dr*i][c + dc*i];
                if (p === player) count++;
                else if (p === 0) empty++;
                else return 0;
            }
            if (count === 5) return this.SCORE_FIVE;
            if (count === 4 && empty === 1) return this.SCORE_LIVE_FOUR;
            if (count === 3) return empty === 2 ? this.SCORE_LIVE_THREE : this.SCORE_DEAD_THREE;
            if (count === 2) return empty === 3 ? this.SCORE_LIVE_TWO : this.SCORE_DEAD_TWO;
            return count === 1 ? 1 : 0;
        };

        for(let i=0; i<15; i++) {
            for(let j=0; j<11; j++) total += checkLine(i, j, 0, 1); // 가로
            if (i < 11) {
                for(let j=0; j<15; j++) total += checkLine(i, j, 1, 0); // 세로
                for(let j=0; j<11; j++) total += checkLine(i, j, 1, 1); // \
            }
            if (i >= 4) {
                for(let j=0; j<11; j++) total += checkLine(i, j, -1, 1); // /
            }
        }
        return total;
    }

    findBestMoveByScore(board, aiPlayer, opponent, difficulty) {
        const candidates = this.getCandidateMoves(board);
        let bestScore = -Infinity;
        let bestMove = candidates[0];

        for (let [r, c] of candidates) {
            let score = (7 - Math.abs(r - 7)) + (7 - Math.abs(c - 7)); // 중앙 가중치
            board[r][c] = aiPlayer;
            score += this.evaluateDirectionsAt(board, r, c, aiPlayer);
            board[r][c] = opponent;
            score += this.evaluateDirectionsAt(board, r, c, opponent) * 0.9;
            board[r][c] = 0;

            if (score > bestScore) {
                bestScore = score;
                bestMove = [r, c];
            }
        }

        if (difficulty === 0 && Math.random() < 0.4) return candidates[Math.floor(Math.random() * candidates.length)];
        if (difficulty === 1 && Math.random() < 0.2) return candidates[Math.floor(Math.random() * candidates.length)];
        return bestMove;
    }

    evaluateDirectionsAt(board, row, col, player) {
        let score = 0;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (let [dx, dy] of directions) {
            for (let offset = -4; offset <= 0; offset++) {
                let r = row + dx * offset, c = col + dy * offset;
                if (r >= 0 && r + dx*4 < 15 && c >= 0 && c + dy*4 < 15 && r + dx*4 >= 0 && c + dy*4 >= 0) {
                    score += this.getLineScore(board, r, c, dx, dy, player);
                }
            }
        }
        return score;
    }

    getLineScore(board, r, c, dx, dy, player) {
        let count = 0, empty = 0;
        for(let i=0; i<5; i++) {
            let p = board[r + dx*i][c + dy*i];
            if (p === player) count++;
            else if (p === 0) empty++;
            else return 0;
        }
        if (count === 5) return this.SCORE_FIVE;
        if (count === 4 && empty === 1) return this.SCORE_LIVE_FOUR;
        if (count === 3) return empty === 2 ? this.SCORE_LIVE_THREE : this.SCORE_DEAD_THREE;
        if (count === 2) return empty === 3 ? this.SCORE_LIVE_TWO : this.SCORE_DEAD_TWO;
        return 0;
    }
}

