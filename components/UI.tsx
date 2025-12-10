
import React, { useState } from 'react';
import { useGameStore } from '../store';
import { PLAYERS, MAX_PER_COLOR } from '../constants';
import { Crown, SkipForward, Menu, Gamepad2, Grid3X3, X, Shuffle, AlertTriangle } from 'lucide-react';
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
    isAnimating,
    skipTwist,
    gameMode,
    colorCounts,
    startGame,
    consecutiveSkips
  } = useGameStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const player = PLAYERS[currentPlayer];
  
  // --- SETUP PHASE ---
  if (phase === 'SETUP') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/60 backdrop-blur-sm z-50 animate-fade-in pointer-events-auto">
            <div className="max-w-sm w-full bg-gray-900 border border-white/20 p-6 rounded-2xl shadow-2xl text-center">
                <div className="mb-6">
                    <h1 className="text-3xl font-black italic tracking-wider bg-gradient-to-r from-pink-500 via-yellow-500 to-cyan-500 bg-clip-text text-transparent mb-1">
                        TactiCube 
                    </h1>
                    <p className="text-gray-400 text-xs">Twist. Place. Dominate.</p>
                </div>
                
                <div className="space-y-3">
                    <button 
                        onClick={() => startGame('SINGLE')}
                        className="w-full group relative overflow-hidden bg-gradient-to-r from-red-500 to-blue-600 p-[1px] rounded-xl transition-transform hover:scale-105 active:scale-95"
                    >
                        <div className="bg-gray-900 rounded-[10px] p-3 flex items-center gap-3 w-full transition-colors group-hover:bg-gray-800">
                           <div className="bg-white/10 p-2 rounded-full flex-shrink-0">
                               <Gamepad2 className="w-5 h-5 text-white" />
                           </div>
                           <div className="text-left">
                               <h3 className="text-white font-bold text-sm">One Color (Classic)</h3>
                               <p className="text-gray-400 text-[10px]">Red vs Blue. Unlimited tiles.</p>
                           </div>
                        </div>
                    </button>

                    <button 
                        onClick={() => startGame('MULTI')}
                        className="w-full group relative overflow-hidden bg-gradient-to-r from-pink-500 via-yellow-500 to-cyan-500 p-[1px] rounded-xl transition-transform hover:scale-105 active:scale-95"
                    >
                        <div className="bg-gray-900 rounded-[10px] p-3 flex items-center gap-3 w-full transition-colors group-hover:bg-gray-800">
                           <div className="bg-white/10 p-2 rounded-full flex-shrink-0">
                               <Grid3X3 className="w-5 h-5 text-white" />
                           </div>
                           <div className="text-left">
                               <h3 className="text-white font-bold text-sm">Three Colors (Strategic)</h3>
                               <p className="text-gray-400 text-[10px]">3 Colors per player, 9 tiles of each.</p>
                           </div>
                        </div>
                    </button>

                    <button 
                        onClick={() => startGame('RANDOM')}
                        className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-500 to-indigo-600 p-[1px] rounded-xl transition-transform hover:scale-105 active:scale-95"
                    >
                        <div className="bg-gray-900 rounded-[10px] p-3 flex items-center gap-3 w-full transition-colors group-hover:bg-gray-800">
                           <div className="bg-white/10 p-2 rounded-full flex-shrink-0">
                               <Shuffle className="w-5 h-5 text-white" />
                           </div>
                           <div className="text-left">
                               <h3 className="text-white font-bold text-sm">Random Mode</h3>
                               <p className="text-gray-400 text-[10px]">System places tiles. You twist.</p>
                           </div>
                        </div>
                    </button>
                </div>

                <div className="mt-6 text-[10px] text-gray-500 uppercase tracking-widest">
                    Select a mode to begin
                </div>
            </div>
        </div>
      );
  }

  // --- GAME PHASE ---
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Header / Scoreboard - Absolute Top */}
      <div className="absolute top-0 left-0 w-full p-4 md:p-8 flex justify-between items-start pointer-events-auto z-10">
        {/* Player 1 Score */}
        <ScoreCard pid="P1" active={currentPlayer === 'P1'} score={scores.P1} />
        
        {/* Center: Title Only */}
        <div className="flex flex-col items-center gap-2">
            <div className="bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-xl border border-white/10 shadow-2xl text-center hidden md:block">
              <h1 className="text-xl font-bold tracking-wider bg-gradient-to-r from-pink-500 to-yellow-500 bg-clip-text text-transparent">TactiCube</h1>
              <div className="text-xs text-gray-400 mt-1">
                  {phase === 'PLACE' 
                    ? (gameMode === 'RANDOM' ? 'SYSTEM PLACING TILE...' : 'PLACE A TILE') 
                    : phase === 'TWIST' ? 'TWIST A FACE' : 'GAME OVER'}
              </div>
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
            {consecutiveSkips > 2 && <p className="text-red-400 text-xs mb-4">Opponent skipped too many times!</p>}
            <div className="flex flex-col gap-3">
                <button 
                onClick={resetGame}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105"
                >
                Play Again
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Controls - Absolute Bottom Center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 pointer-events-auto z-10 w-full max-w-md px-4">
        
        {/* Phase Indicator & Instruction (Mobile mainly) */}
        <div className="md:hidden bg-black/70 px-4 py-2 rounded-full text-white text-sm font-bold border border-white/20 mb-1">
             {phase === 'PLACE' 
                ? (gameMode === 'RANDOM' ? 'System Placing...' : 'Phase 1: Place Tile') 
                : phase === 'TWIST' ? 'Phase 2: Twist Face' : 'Game Over'}
        </div>

        {/* Action Panel */}
        {phase === 'PLACE' && !winner && gameMode !== 'RANDOM' && (
          <div className="bg-black/80 backdrop-blur p-2.5 rounded-xl border border-white/10 animate-slide-up shadow-xl">
            <p className="text-gray-300 text-[10px] mb-1.5 text-center uppercase tracking-widest">
                {gameMode === 'MULTI' ? 'Select Color' : 'Your Color'}
            </p>
            <div className="flex gap-2">
              {player.colors.map((c, idx) => {
                  // If Single Mode, only show index 0 (Red/Blue)
                  if (gameMode === 'SINGLE' && idx > 0) return null;

                  const count = colorCounts[currentPlayer][idx];
                  const remaining = MAX_PER_COLOR - count;
                  const isDisabled = gameMode === 'MULTI' && remaining <= 0;

                  return (
                    <button
                        key={c}
                        onClick={() => !isDisabled && selectColor(idx)}
                        disabled={isDisabled}
                        className={clsx(
                            "relative w-8 h-8 md:w-9 md:h-9 rounded-full border-2 transition-all transform shadow-lg flex items-center justify-center group",
                            selectedColorIndex === idx ? "border-white scale-110 ring-2 ring-white/50" : "border-transparent opacity-80 hover:scale-105",
                            isDisabled && "opacity-30 cursor-not-allowed grayscale"
                        )}
                        style={{ backgroundColor: c }}
                        title={gameMode === 'MULTI' ? `${remaining} remaining` : undefined}
                    >
                        {gameMode === 'MULTI' && (
                            <span className="absolute -bottom-1 -right-1 bg-black/70 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white/20">
                                {remaining}
                            </span>
                        )}
                    </button>
                  );
              })}
            </div>
          </div>
        )}

        {phase === 'TWIST' && !winner && (
          <div className="flex flex-col items-center gap-2">
            {consecutiveSkips > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-full animate-pulse backdrop-blur-sm">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span className="text-[10px] font-bold text-red-200">
                        {consecutiveSkips}/2 Consecutive Skips
                    </span>
                </div>
            )}
            <button 
               onClick={skipTwist}
               disabled={isAnimating}
               className={clsx(
                   "h-12 px-8 rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-lg",
                   consecutiveSkips >= 2 
                     ? "bg-red-900/90 hover:bg-red-800 text-red-100 border-red-500/30" 
                     : "bg-gray-800/90 hover:bg-gray-700 text-white backdrop-blur-md"
               )}
               title={consecutiveSkips >= 2 ? "Warning: Skipping again causes a loss!" : "Skip Twist Phase"}
            >
               <SkipForward className="w-4 h-4" />
               <span className="text-xs font-bold uppercase">
                   {consecutiveSkips >= 2 ? "Skip & Forfeit?" : "Skip Turn"}
               </span>
            </button>
          </div>
        )}
      </div>

      {/* Menu - Absolute Bottom Left */}
      {!winner && (
         <div className="absolute bottom-6 left-6 pointer-events-auto z-50 flex flex-col-reverse gap-4 items-start">
           {/* Button */}
           <button
             onClick={() => setIsMenuOpen(!isMenuOpen)}
             className={clsx(
               "p-3 rounded-full backdrop-blur-md border shadow-lg transition-all duration-300",
               isMenuOpen 
                 ? "bg-white text-black border-white rotate-90" 
                 : "bg-black/50 text-white/70 border-white/10 hover:bg-white/10 hover:text-white hover:scale-110"
             )}
             title="Main Menu"
           >
             {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
           </button>
        
           {/* Menu Content */}
           {isMenuOpen && (
              <div className="bg-black/90 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl flex flex-col min-w-[160px] animate-slide-up origin-bottom-left">
                 <div className="px-3 py-2 border-b border-white/5 mb-1">
                     <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Paused</span>
                 </div>
                 <button 
                   onClick={() => setIsMenuOpen(false)}
                   className="text-left px-3 py-2.5 text-sm font-medium text-white hover:bg-white/10 rounded-xl transition-colors"
                 >
                   Resume Game
                 </button>
                 <button 
                   onClick={() => { resetGame(); setIsMenuOpen(false); }}
                   className="text-left px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                 >
                   Quit to Title
                 </button>
              </div>
           )}
        </div>
      )}
    </div>
  );
};

const ScoreCard = ({ pid, active, score }: any) => {
  const config = PLAYERS[pid];
  return (
    <div className={clsx(
      "bg-black/80 backdrop-blur rounded-xl p-3 md:p-4 border transition-all duration-300 min-w-[100px] shadow-lg",
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
        <div className="flex justify-between"><span>Crosses</span><span>{score.crosses}</span></div>
        <div className="flex justify-between"><span>Faces</span><span>{score.faces}</span></div>
      </div>
    </div>
  );
}
