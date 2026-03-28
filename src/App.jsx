import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Cpu, Users, Globe, RotateCcw, Trophy, Skull, Info, Copy, Check } from 'lucide-react';
import Peer from 'peerjs';

// --- GAME LOGIC & CONSTANTS ---
const SIZE = 7;
const EMPTY = 0;
const P1 = 1; // Cyan
const P2 = 2; // Magenta

const createInitialBoard = () => {
  const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  b[0][0] = P1; b[SIZE - 1][SIZE - 1] = P1;
  b[0][SIZE - 1] = P2; b[SIZE - 1][0] = P2;
  return b;
};

const getScores = (board) => {
  let p1 = 0, p2 = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === P1) p1++;
      if (board[r][c] === P2) p2++;
    }
  }
  return { p1, p2 };
};

const getValidMovesForPiece = (board, r, c) => {
  const moves = [];
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const nr = r + dr; const nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === EMPTY) {
        moves.push({ r: nr, c: nc, isClone: Math.abs(dr) <= 1 && Math.abs(dc) <= 1 });
      }
    }
  }
  return moves;
};

const getAllValidMoves = (board, player) => {
  const moves = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === player) {
        const pieceMoves = getValidMovesForPiece(board, r, c);
        pieceMoves.forEach(m => moves.push({ fromR: r, fromC: c, toR: m.r, toC: m.c, isClone: m.isClone }));
      }
    }
  }
  return moves;
};

const applyMove = (board, move, player) => {
  const nb = board.map(row => [...row]);
  if (!move.isClone) nb[move.fromR][move.fromC] = EMPTY;
  nb[move.toR][move.toC] = player;
  const opp = player === P1 ? P2 : P1;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = move.toR + dr, nc = move.toC + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && nb[nr][nc] === opp) {
        nb[nr][nc] = player;
      }
    }
  }
  return nb;
};

// --- AI (Minimax) ---
const evaluateBoard = (board, player) => {
  const { p1, p2 } = getScores(board);
  return player === P2 ? p2 - p1 : p1 - p2;
};

const minimax = (board, depth, alpha, beta, isMaximizing, aiPlayer) => {
  const currentPlayer = isMaximizing ? aiPlayer : (aiPlayer === P1 ? P2 : P1);
  const moves = getAllValidMoves(board, currentPlayer);
  
  if (depth === 0 || moves.length === 0) return { score: evaluateBoard(board, aiPlayer) };

  let bestMove = moves[0];
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let m of moves) {
      const nb = applyMove(board, m, currentPlayer);
      const ev = minimax(nb, depth - 1, alpha, beta, false, aiPlayer).score;
      if (ev > maxEval) { maxEval = ev; bestMove = m; }
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    for (let m of moves) {
      const nb = applyMove(board, m, currentPlayer);
      const ev = minimax(nb, depth - 1, alpha, beta, true, aiPlayer).score;
      if (ev < minEval) { minEval = ev; bestMove = m; }
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return { score: minEval, move: bestMove };
  }
};

// --- MAIN COMPONENT ---
export default function App() {
  const [board, setBoard] = useState(createInitialBoard());
  const [turn, setTurn] = useState(P1);
  const [selected, setSelected] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [winner, setWinner] = useState(null);
  const [mode, setMode] = useState('menu'); // menu, ai, local, host, join, online
  const [aiThinking, setAiThinking] = useState(false);
  
  // Multiplayer State
  const [peerId, setPeerId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [connection, setConnection] = useState(null);
  const [isOnlineHost, setIsOnlineHost] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const peerRef = useRef(null);

  const { p1: score1, p2: score2 } = getScores(board);

  // Check Game Over
  useEffect(() => {
    if (mode === 'menu') return;
    const p1Moves = getAllValidMoves(board, P1);
    const p2Moves = getAllValidMoves(board, P2);
    if (p1Moves.length === 0 || p2Moves.length === 0 || score1 === 0 || score2 === 0 || score1 + score2 === SIZE * SIZE) {
      if (score1 > score2) setWinner(P1);
      else if (score2 > score1) setWinner(P2);
      else setWinner('draw');
    } else if (turn === P1 && p1Moves.length === 0) { setTurn(P2); } 
      else if (turn === P2 && p2Moves.length === 0) { setTurn(P1); }
  }, [board, turn, score1, score2, mode]);

  // AI Turn
  useEffect(() => {
    if (mode === 'ai' && turn === P2 && !winner) {
      setAiThinking(true);
      const timer = setTimeout(() => {
        const result = minimax(board, 3, -Infinity, Infinity, true, P2);
        if (result.move) {
          setBoard(applyMove(board, result.move, P2));
          setTurn(P1);
        }
        setAiThinking(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [board, turn, mode, winner]);

  // Handle Cell Click
  const handleCellClick = (r, c) => {
    if (winner || aiThinking || mode === 'menu') return;
    if (mode === 'online') {
      if ((isOnlineHost && turn !== P1) || (!isOnlineHost && turn !== P2)) return; // Not your turn
    }

    // Select Piece
    if (board[r][c] === turn) {
      setSelected({ r, c });
      setValidMoves(getValidMovesForPiece(board, r, c));
      return;
    }

    // Move Piece
    if (selected) {
      const move = validMoves.find(m => m.r === r && m.c === c);
      if (move) {
        const fullMove = { fromR: selected.r, fromC: selected.c, toR: r, toC: c, isClone: move.isClone };
        const newBoard = applyMove(board, fullMove, turn);
        setBoard(newBoard);
        setTurn(turn === P1 ? P2 : P1);
        setSelected(null);
        setValidMoves([]);
        
        // Send move if online
        if (mode === 'online' && connection) {
          connection.send({ type: 'move', move: fullMove, player: turn });
        }
      } else {
        setSelected(null);
        setValidMoves([]);
      }
    }
  };

  // --- PEER JS NETWORKING ---
  const generateId = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  const initPeer = (host) => {
    const id = host ? generateId() : null;
    const peer = new Peer(id);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      setOnlineStatus(host ? 'Waiting for opponent...' : 'Ready to join.');
    });

    peer.on('connection', (conn) => {
      setupConnection(conn, true);
    });
  };

  const setupConnection = (conn, isHost) => {
    setConnection(conn);
    setOnlineStatus('Connected! Game On.');
    setIsOnlineHost(isHost);
    setMode('online');
    setBoard(createInitialBoard());
    setTurn(P1);
    setWinner(null);

    conn.on('data', (data) => {
      if (data.type === 'move') {
        setBoard(prev => applyMove(prev, data.move, data.player));
        setTurn(data.player === P1 ? P2 : P1);
      } else if (data.type === 'reset') {
        setBoard(createInitialBoard());
        setTurn(P1);
        setWinner(null);
      }
    });

    conn.on('close', () => {
      setOnlineStatus('Opponent disconnected.');
      setConnection(null);
    });
  };

  const joinGame = () => {
    if (!peerRef.current || !joinId) return;
    setOnlineStatus('Connecting...');
    const conn = peerRef.current.connect(joinId.toUpperCase());
    conn.on('open', () => setupConnection(conn, false));
    conn.on('error', () => setOnlineStatus('Connection failed.'));
  };

  const copyId = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Utilities
  const resetGame = () => {
    setBoard(createInitialBoard());
    setTurn(P1);
    setWinner(null);
    setSelected(null);
    setValidMoves([]);
    if (mode === 'online' && connection) connection.send({ type: 'reset' });
  };

  const returnToMenu = () => {
    resetGame();
    setMode('menu');
    if (connection) connection.close();
    if (peerRef.current) peerRef.current.destroy();
    setConnection(null);
  };

  // Renderers
  const isMoveValid = (r, c) => validMoves.some(m => m.r === r && m.c === c);
  const getMoveType = (r, c) => validMoves.find(m => m.r === r && m.c === c)?.isClone;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans text-slate-100 p-4 select-none overflow-hidden relative">
      <style>{`
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(1.3); opacity: 0; } }
        .win-glow { animation: blink 1s infinite alternate; }
        @keyframes blink { from { filter: brightness(1); } to { filter: brightness(1.5) drop-shadow(0 0 10px currentColor); } }
      `}</style>

      {/* HEADER */}
      <div className="mb-6 z-10 text-center w-full max-w-md">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 uppercase drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">Neon Assimilation</h1>
        
        {mode === 'menu' && (
          <div className="mt-4 p-3 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-left">
             <div className="flex items-start gap-2 mb-2"><Info className="text-cyan-400 shrink-0" size={18} /><span><strong>GOAL:</strong> Have the most pieces.</span></div>
             <ul className="list-disc pl-8 space-y-1 text-slate-400 text-xs">
               <li>Move 1 space: Clone (Create a new piece).</li>
               <li>Move 2 spaces: Jump (Move existing piece).</li>
               <li>Captures adjacent enemy pieces upon landing!</li>
             </ul>
          </div>
        )}

        {mode !== 'menu' && !['host', 'join'].includes(mode) && (
          <div className="mt-4 flex items-center justify-between bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
            <div className={`flex flex-col items-center px-4 py-2 rounded-xl transition-all ${turn === P1 ? 'bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'opacity-50'}`}>
              <span className="text-cyan-400 font-bold text-xl">{score1}</span>
              <span className="text-xs uppercase tracking-widest text-cyan-500/80">{mode === 'online' && isOnlineHost ? 'YOU' : 'P1'}</span>
            </div>
            <div className="text-slate-600 font-black tracking-widest text-sm">VS</div>
            <div className={`flex flex-col items-center px-4 py-2 rounded-xl transition-all ${turn === P2 ? 'bg-fuchsia-500/20 shadow-[0_0_15px_rgba(217,70,239,0.4)]' : 'opacity-50'}`}>
              <span className="text-fuchsia-400 font-bold text-xl">{score2}</span>
              <span className="text-xs uppercase tracking-widest text-fuchsia-500/80">{mode === 'ai' ? (aiThinking ? 'AI...' : 'AI') : (mode === 'online' && !isOnlineHost ? 'YOU' : 'P2')}</span>
            </div>
          </div>
        )}
      </div>

      {/* MENUS */}
      {mode === 'menu' && (
        <div className="flex flex-col gap-3 w-full max-w-sm z-10">
          <button onClick={() => { setMode('ai'); resetGame(); }} className="flex items-center justify-center gap-3 py-4 bg-slate-900 border border-cyan-500/50 rounded-xl text-cyan-400 font-bold tracking-widest hover:bg-cyan-950 transition-all"><Cpu size={20}/> VS COMPUTER (HARD)</button>
          <button onClick={() => { setMode('local'); resetGame(); }} className="flex items-center justify-center gap-3 py-4 bg-slate-900 border border-fuchsia-500/50 rounded-xl text-fuchsia-400 font-bold tracking-widest hover:bg-fuchsia-950 transition-all"><Users size={20}/> LOCAL HOTSEAT</button>
          <div className="h-px w-full bg-slate-800 my-2"></div>
          <button onClick={() => { setMode('host'); initPeer(true); }} className="flex items-center justify-center gap-3 py-4 bg-slate-900 border border-emerald-500/50 rounded-xl text-emerald-400 font-bold tracking-widest hover:bg-emerald-950 transition-all"><Globe size={20}/> HOST ONLINE</button>
          <button onClick={() => { setMode('join'); initPeer(false); }} className="flex items-center justify-center gap-3 py-4 bg-slate-900 border border-amber-500/50 rounded-xl text-amber-400 font-bold tracking-widest hover:bg-amber-950 transition-all"><Globe size={20}/> JOIN ONLINE</button>
        </div>
      )}

      {/* MULTIPLAYER LOBBY */}
      {['host', 'join'].includes(mode) && (
        <div className="flex flex-col gap-4 w-full max-w-sm z-10 bg-slate-900 p-6 rounded-2xl border border-slate-700 text-center">
          <Globe className="mx-auto text-slate-500 mb-2" size={48} />
          <p className="text-emerald-400 font-bold tracking-wider">{onlineStatus}</p>
          
          {mode === 'host' && peerId && (
            <div className="mt-4">
              <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">Your Room Code</p>
              <div className="flex items-center justify-center gap-2 text-4xl font-black text-white tracking-widest bg-slate-950 py-4 rounded-xl border border-slate-800">
                {peerId}
                <button onClick={copyId} className="ml-2 p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-300">
                  {copied ? <Check size={20} className="text-emerald-400"/> : <Copy size={20} />}
                </button>
              </div>
            </div>
          )}

          {mode === 'join' && (
            <div className="mt-4 flex flex-col gap-2">
               <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Enter Room Code</p>
               <input type="text" maxLength={4} value={joinId} onChange={e => setJoinId(e.target.value.toUpperCase())} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 text-center text-4xl font-black text-white focus:outline-none focus:border-amber-500 transition-colors uppercase" placeholder="ABCD" />
               <button onClick={joinGame} disabled={joinId.length !== 4} className="mt-2 py-4 bg-amber-500/20 text-amber-400 border border-amber-500/50 font-bold rounded-xl tracking-widest disabled:opacity-50">CONNECT</button>
            </div>
          )}

          <button onClick={returnToMenu} className="mt-4 text-slate-500 text-sm hover:text-white">Cancel</button>
        </div>
      )}

      {/* GAME BOARD */}
      {!['menu', 'host', 'join'].includes(mode) && (
        <div className="w-full max-w-lg bg-slate-900/80 p-2 md:p-4 rounded-2xl border border-slate-800 shadow-2xl z-10">
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {board.map((row, r) => row.map((cell, c) => {
              const isSelected = selected?.r === r && selected?.c === c;
              const validMove = isMoveValid(r, c);
              const moveClone = validMove && getMoveType(r, c);
              
              return (
                <div key={`${r}-${c}`} onClick={() => handleCellClick(r, c)} className={`w-full aspect-square rounded-xl flex items-center justify-center relative transition-all duration-300
                  ${cell === EMPTY ? 'bg-slate-950 border border-slate-800' : 'bg-slate-800 border-2 border-transparent'}
                  ${isSelected ? 'ring-2 ring-white scale-90' : ''}
                  ${validMove ? 'cursor-pointer ring-1 ring-emerald-500/50 bg-emerald-900/20 hover:bg-emerald-800/40' : (cell !== EMPTY ? 'cursor-pointer' : '')}
                `}>
                  
                  {/* Valid Move Indicator */}
                  {validMove && (
                    <div className={`w-3 h-3 rounded-full ${moveClone ? 'bg-emerald-400' : 'bg-amber-400'} opacity-50 absolute`} />
                  )}

                  {/* Piece */}
                  {cell !== EMPTY && (
                    <div className={`w-[80%] h-[80%] rounded-full shadow-inner transition-colors duration-500 relative
                      ${cell === P1 ? 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)] text-cyan-400' : 'bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.6)] text-fuchsia-400'}
                      ${winner === cell ? 'win-glow' : ''}
                    `}>
                      {isSelected && <div className="absolute inset-0 rounded-full border-2 border-white animate-ping opacity-50"></div>}
                    </div>
                  )}
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* FOOTER CONTROLS */}
      {!['menu', 'host', 'join'].includes(mode) && !winner && (
        <div className="mt-8 flex gap-4 z-10">
          <button onClick={resetGame} className="p-3 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-all"><RotateCcw size={20} /></button>
          <button onClick={returnToMenu} className="px-6 py-2 text-sm font-bold tracking-widest text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-all border border-slate-800">ABORT MISSION</button>
        </div>
      )}

      {/* WIN OVERLAY */}
      {winner && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center backdrop-blur-md animate-in fade-in zoom-in duration-300">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full">
            <Trophy size={64} className={`mb-6 ${winner === P1 ? 'text-cyan-400' : winner === P2 ? 'text-fuchsia-400' : 'text-slate-400'}`} />
            <h2 className={`text-5xl font-black mb-2 tracking-tighter ${winner === P1 ? 'text-cyan-400' : winner === P2 ? 'text-fuchsia-400' : 'text-slate-300'}`}>
              {winner === 'draw' ? 'DRAW' : (winner === P1 ? 'P1 WINS' : 'P2 WINS')}
            </h2>
            <p className="text-slate-500 mb-8 uppercase tracking-widest font-bold">Score: {score1} - {score2}</p>
            <div className="flex flex-col w-full gap-3">
              <button onClick={resetGame} className="w-full py-4 bg-white text-black font-bold rounded-xl tracking-widest hover:bg-slate-200">PLAY AGAIN</button>
              <button onClick={returnToMenu} className="w-full py-4 bg-slate-800 text-white font-bold rounded-xl border border-slate-600 tracking-widest">MENU</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  }
