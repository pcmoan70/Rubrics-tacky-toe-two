import React from 'react';
import { useGameStore } from '../store';
import { PLAYERS } from '../constants';
import { RotateCcw, RotateCw, Trophy, Crown, RefreshCcw } from 'lucide-react';
import clsx from 'clsx';
import { Face } from '../types';

export const UI = () => {
  const { 
    currentPlayer, 
    phase, 
    scores, 
    selectedColorIndex, 
    selectColor, 
    winner, 
    resetGame,
    isAnimating 
  } = useGameStore();

  const player = PLAYERS[currentPlayer];
  
  const triggerRotate = (face: Face, clockwise: boolean) => {
    if (isAnimating) return;
    const event = new CustomEvent('cube-rotate', { detail: { face, clockwise } });
    window.dispatchEvent(event);
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-8">
      {/* Header / Scoreboard */}
      <div className="flex justify-between items-start pointer-events-auto">
        {/* Player 1 Score */}
        <ScoreCard pid="P1" active={currentPlayer === 'P1'} score={scores.P1} />
        
        {/* Title */}
        <div className="bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-xl border border-white/10 shadow-2xl text-center hidden md:block">
           <h1 className="text-xl font-bold tracking-wider bg-gradient-to-r from-pink-500 to-yellow-500 bg-clip-text text-transparent">RUBIK'S TAC TOE</h1>
           <div className="text-xs text-gray-400 mt-1">
             {phase === 'PLACE' ? 'PLACE A TILE' : phase === 'TWIST' ? 'TWIST A FACE' : 'GAME OVER'}
           </div>
        </div>

        {/* Player 2 Score */}
        <ScoreCard pid="P2" active={currentPlayer === 'P2'} score={scores.P2} />
      </div>

      {/* Winner Overlay */}
      {winner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 pointer-events-auto">
          <div className="bg-gray-900 border-2 border-yellow-500 p-8 rounded-2xl text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] max-w-sm">
            <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-4xl font-black text-white mb-2">
              {winner === 'DRAW' ? 'DRAW!' : `${PLAYERS[winner].name} WINS!`}
            </h2>
            <p className="text-gray-400 mb-6">Final Score: {scores.P1.total} - {scores.P2.total}</p>
            <button 
              onClick={resetGame}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="flex flex-col items-center gap-4 pointer-events-auto pb-4">
        
        {/* Phase Indicator & Instruction (Mobile mainly) */}
        <div className="md:hidden bg-black/70 px-4 py-2 rounded-full text-white text-sm font-bold border border-white/20">
             {phase === 'PLACE' ? 'Phase 1: Place Tile' : phase === 'TWIST' ? 'Phase 2: Twist Face' : 'Game Over'}
        </div>

        {/* Action Panel */}
        {phase === 'PLACE' && !winner && (
          <div className="bg-black/80 backdrop-blur p-4 rounded-2xl border border-white/10 animate-slide-up">
            <p className="text-gray-300 text-xs mb-2 text-center uppercase tracking-widest">Select Color</p>
            <div className="flex gap-3">
              {player.colors.map((c, idx) => (
                <button
                  key={c}
                  onClick={() => selectColor(idx)}
                  className={clsx(
                    "w-10 h-10 md:w-12 md:h-12 rounded-full border-2 transition-all transform hover:scale-110 shadow-lg",
                    selectedColorIndex === idx ? "border-white scale-110 ring-2 ring-white/50" : "border-transparent opacity-80"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        )}

        {phase === 'TWIST' && !winner && (
          <div className="bg-black/80 backdrop-blur p-4 rounded-2xl border border-white/10 animate-slide-up max-w-[90vw] overflow-x-auto">
             <p className="text-gray-300 text-xs mb-2 text-center uppercase tracking-widest">Rotate Face</p>
             <div className="flex gap-4">
                {(['U', 'D', 'F', 'B', 'L', 'R'] as Face[]).map(face => (
                  <div key={face} className="flex flex-col items-center gap-1">
                    <span className="text-white/50 text-[10px] font-bold">{face}</span>
                    <div className="flex gap-1">
                      <button onClick={() => triggerRotate(face, false)} disabled={isAnimating} className="p-2 bg-white/10 hover:bg-white/20 rounded active:scale-95 transition-all disabled:opacity-50">
                        <RotateCcw className="w-4 h-4 text-white" />
                      </button>
                      <button onClick={() => triggerRotate(face, true)} disabled={isAnimating} className="p-2 bg-white/10 hover:bg-white/20 rounded active:scale-95 transition-all disabled:opacity-50">
                        <RotateCw className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ScoreCard = ({ pid, active, score }: any) => {
  const config = PLAYERS[pid];
  return (
    <div className={clsx(
      "bg-black/80 backdrop-blur rounded-xl p-3 md:p-4 border transition-all duration-300 min-w-[100px]",
      active ? `border-[${config.baseColor}] shadow-[0_0_15px_${config.baseColor}40]` : "border-white/5 opacity-80"
    )}
    style={{ borderColor: active ? config.baseColor : undefined }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ background: config.baseColor }} />
        <span className={clsx("font-bold text-sm md:text-base", active ? "text-white" : "text-gray-400")}>
          {config.name}
        </span>
      </div>
      <div className="text-2xl md:text-3xl font-black text-white mb-1">
        {score.total}
      </div>
      <div className="text-[10px] text-gray-500 flex flex-col gap-0.5">
        <div className="flex justify-between"><span>Lines</span><span>{score.lines}</span></div>
        <div className="flex justify-between"><span>Squares</span><span>{score.squares}</span></div>
        <div className="flex justify-between"><span>Faces</span><span>{score.faces}</span></div>
      </div>
    </div>
  );
}
