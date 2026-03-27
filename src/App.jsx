import React, { useState, useEffect, useCallback } from 'react';
import { Cpu, Users, RotateCcw, Trophy, Skull, Handshake, Info } from 'lucide-react';

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const PLAYER_1 = 1; 
const PLAYER_2 = 2; 
const WIN_SCORE = 1000000;
const CENTER_WEIGHT = 3;

const createEmptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));

const getValidLocations = (board) => {
  const validLocations = [];
  for (let col = 0; col < COLS; col++) {
    if (board[0][col] === EMPTY) validLocations.push(col);
  }
  return validLocations;
};

const getNextOpenRow = (board, col) => {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === EMPTY) return r;
  }
  return -1;
};

const hasWon = (board, piece) => {
  for (let c = 0; c < COLS - 3; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c] === piece && board[r][c + 1] === piece && board[r][c + 2] === piece && board[r][c + 3] === piece) return true;
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 3; r++) {
      if (board[r][c] === piece && board[r + 1][c] === piece && board[r + 2][c] === piece && board[r + 3][c] === piece) return true;
    }
  }
  for (let c = 0; c < COLS - 3; c++) {
    for (let r = 0; r < ROWS - 3; r++) {
      if (board[r][c] === piece && board[r + 1][c + 1] === piece && board[r + 2][c + 2] === piece && board[r + 3][c + 3] === piece) return true;
    }
  }
  for (let c = 0; c < COLS - 3; c++) {
    for (let r = 3; r < ROWS; r++) {
      if (board[r][c] === piece && board[r - 1][c + 1] === piece && board[r - 2][c + 2] === piece && board[r - 3][c + 3] === piece) return true;
    }
  }
  return false;
};

const getWinCoords = (board, piece) => {
  for (let c = 0; c < COLS - 3; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c] === piece && board[r][c + 1] === piece && board[r][c + 2] === piece && board[r][c + 3] === piece) 
        return [[r,c], [r,c+1], [r,c+2], [r,c+3]];
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 3; r++) {
      if (board[r][c] === piece && board[r + 1][c] === piece && board[r + 2][c] === piece && board[r + 3][c] === piece) 
        return [[r,c], [r+1,c], [r+2,c], [r+3,c]];
    }
  }
  for (let c = 0; c < COLS - 3; c++) {
    for (let r = 0; r < ROWS - 3; r++) {
      if (board[r][c] === piece && board[r + 1][c + 1] === piece && board[r + 2][c + 2] === piece && board[r + 3][c + 3] === piece) 
        return [[r,c], [r+1,c+1], [r+2,c+2], [r+3,c+3]];
    }
  }
  for (let c = 0; c < COLS - 3; c++) {
    for (let r = 3; r < ROWS; r++) {
      if (board[r][c] === piece && board[r - 1][c + 1] === piece && board[r - 2][c + 2] === piece && board[r - 3][c + 3] === piece) 
        return [[r,c], [r-1,c+1], [r-2,c+2], [r-3,c+3]];
    }
  }
  return null;
};

const evaluateWindow = (window, piece) => {
  let score = 0;
  const oppPiece = piece === PLAYER_1 ? PLAYER_2 : PLAYER_1;
  let pieceCount = 0, emptyCount = 0, oppCount = 0;
  for (let i = 0; i < 4; i++) {
    if (window[i] === piece) pieceCount++;
    else if (window[i] === EMPTY) emptyCount++;
    else if (window[i] === oppPiece) oppCount++;
  }
  if (pieceCount === 4) score += 100;
  else if (pieceCount === 3 && emptyCount === 1) score += 5;
  else if (pieceCount === 2 && emptyCount === 2) score += 2;
  if (oppCount === 3 && emptyCount === 1) score -= 40;
  return score;
};

const scorePosition = (board, piece) => {
  let score = 0;
  const centerArray = [];
  for (let r = 0; r < ROWS; r++) centerArray.push(board[r][Math.floor(COLS / 2)]);
  score += (centerArray.filter(p => p === piece).length) * CENTER_WEIGHT;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) score += evaluateWindow(board[r].slice(c, c + 4), piece);
  }
  for (let c = 0; c < COLS; c++) {
    const colArray = [];
    for (let r = 0; r < ROWS; r++) colArray.push(board[r][c]);
    for (let r = 0; r < ROWS - 3; r++) score += evaluateWindow(colArray.slice(r, r + 4), piece);
  }
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) score += evaluateWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]], piece);
  }
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) score += evaluateWindow([board[r+3][c], board[r+2][c+1], board[r+1][c+2], board[r][c+3]], piece);
  }
  return score;
};

const minimax = (board, depth, alpha, beta, maximizingPlayer) => {
  const vLocs = getValidLocations(board);
  const isTerminal = hasWon(board, PLAYER_1) || hasWon(board, PLAYER_2) || vLocs.length === 0;
  if (depth === 0 || isTerminal) {
    if (isTerminal) {
      if (hasWon(board, PLAYER_2)) return { score: WIN_SCORE };
      if (hasWon(board, PLAYER_1)) return { score: -WIN_SCORE };
      return { score: 0 };
    }
    return { score: scorePosition(board, PLAYER_2) };
  }
  if (maximizingPlayer) {
    let value = -Infinity;
    let bestCol = vLocs[0];
    for (let col of vLocs) {
      const row = getNextOpenRow(board, col);
      const bCopy = board.map(r => [...r]);
      bCopy[row][col] = PLAYER_2;
      const newScore = minimax(bCopy, depth - 1, alpha, beta, false).score;
      if (newScore > value) { value = newScore; bestCol = col; }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return { col: bestCol, score: value };
  } else {
    let value = Infinity;
    let bestCol = vLocs[0];
    for (let col of vLocs) {
      const row = getNextOpenRow(board, col);
      const bCopy = board.map(r => [...r]);
      bCopy[row][col] = PLAYER_1;
      const newScore = minimax(bCopy, depth - 1, alpha, beta, true).score;
      if (newScore < value) { value = newScore; bestCol = col; }
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return { col: bestCol, score: value };
  }
};

export default function App() {
  const [board, setBoard] = useState(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState(PLAYER_1);
  const [winner, setWinner] = useState(null); 
  const [winningCells, setWinningCells] = useState([]);
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [gameMode, setGameMode] = useState('menu'); 
  const [aiThinking, setAiThinking] = useState(false);

  useEffect(() => {
    if (winner) {
      const delay = winner === 'draw' ? 500 : 2500;
      const timer = setTimeout(() => setShowResultOverlay(true), delay);
      return () => clearTimeout(timer);
    }
  }, [winner]);

  const handleMove = useCallback((col) => {
    if (winner || aiThinking || gameMode === 'menu') return;
    const vLocs = getValidLocations(board);
    if (!vLocs.includes(col)) return;
    const row = getNextOpenRow(board, col);
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    const winCoords = getWinCoords(newBoard, currentPlayer);
    if (winCoords) { setWinningCells(winCoords); setWinner(currentPlayer); } 
    else if (getValidLocations(newBoard).length === 0) setWinner('draw');
    else setCurrentPlayer(currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1);
  }, [board, currentPlayer, winner, aiThinking, gameMode]);

  useEffect(() => {
    if (gameMode === 'ai' && currentPlayer === PLAYER_2 && !winner) {
      setAiThinking(true);
      setTimeout(() => {
        const res = minimax(board, 5, -Infinity, Infinity, true);
        if (res.col !== undefined) {
          const row = getNextOpenRow(board, res.col);
          const newBoard = board.map(r => [...r]);
          newBoard[row][res.col] = PLAYER_2;
          setBoard(newBoard);
          const winCoords = getWinCoords(newBoard, PLAYER_2);
          if (winCoords) { setWinningCells(winCoords); setWinner(PLAYER_2); }
          else if (getValidLocations(newBoard).length === 0) setWinner('draw');
          else setCurrentPlayer(PLAYER_1);
        }
        setAiThinking(false);
      }, 300);
    }
  }, [currentPlayer, gameMode, winner, board]);

  const resetGame = () => { setBoard(createEmptyBoard()); setCurrentPlayer(PLAYER_1); setWinner(null); setWinningCells([]); setShowResultOverlay(false); };
  const returnToMenu = () => { resetGame(); setGameMode('menu'); };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans text-slate-100 p-4 select-none overflow-hidden relative">
      <style>{`@keyframes blink { 0%, 100% { opacity: 1; transform: scale(1.1); } 50% { opacity: 0.1; transform: scale(0.9); } } .animate-win-blink { animation: blink 0.6s ease-in-out 4 forwards; }`}</style>
      <div className="mb-6 z-10 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 uppercase drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">Neon Gridlock</h1>
        {gameMode === 'menu' ? <div className="mt-4 p-3 bg-slate-900/80 border border-slate-700 rounded-lg text-sm"><strong>GOAL:</strong> Connect 4 in a row.</div> : <div className="mt-2 text-slate-400 font-bold uppercase tracking-widest text-xs">Goal: Connect 4 in a row</div>}
      </div>
      {gameMode === 'menu' && (
        <div className="flex flex-col gap-4 w-full max-w-sm z-10">
          <button onClick={() => { setGameMode('ai'); resetGame(); }} className="py-4 bg-slate-900 border border-cyan-500/50 rounded-xl text-cyan-400 font-bold tracking-widest hover:bg-cyan-950">PLAY VS COMPUTER</button>
          <button onClick={() => { setGameMode('p2p'); resetGame(); }} className="py-4 bg-slate-900 border border-fuchsia-500/50 rounded-xl text-fuchsia-400 font-bold tracking-widest hover:bg-fuchsia-950">PLAY LOCAL P2P</button>
        </div>
      )}
      {gameMode !== 'menu' && (
        <div className="w-full max-w-2xl bg-slate-900/80 p-3 rounded-2xl border border-slate-800 shadow-2xl z-10">
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {Array.from({ length: COLS }).map((_, c) => (
              <div key={c} className="flex flex-col gap-1 cursor-pointer" onClick={() => handleMove(c)}>
                {board.map((r, ri) => {
                  const isWin = winningCells.some(([wr, wc]) => wr === ri && wc === c);
                  return (
                    <div key={ri} className={`w-full aspect-square bg-slate-950 rounded-full border-2 border-slate-800 flex items-center justify-center relative ${isWin ? 'ring-2 ring-white z-20 scale-105' : ''} ${winner && !isWin ? 'opacity-10 grayscale' : ''}`}>
                      {board[ri][c] !== EMPTY && <div className={`w-[85%] h-[85%] rounded-full ${board[ri][c] === PLAYER_1 ? 'bg-cyan-500 shadow-[0_0_10px_cyan]' : 'bg-fuchsia-500 shadow-[0_0_10px_fuchsia]'} ${isWin ? 'animate-win-blink' : ''}`} />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      {showResultOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 p-4 text-center backdrop-blur-md">
          <h2 className="text-6xl font-black text-white mb-8">{winner === 'draw' ? 'DRAW' : (winner === PLAYER_1 ? 'YOU WIN!' : 'YOU LOSE!') }</h2>
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
            <button onClick={resetGame} className="flex-1 py-4 bg-white text-black font-bold rounded-xl">PLAY AGAIN</button>
            <button onClick={returnToMenu} className="flex-1 py-4 bg-slate-800 text-white font-bold rounded-xl">MENU</button>
          </div>
        </div>
      )}
    </div>
  );
}
