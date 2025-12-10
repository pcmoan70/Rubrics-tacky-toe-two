
import { create } from 'zustand';
import { GamePhase, PlayerId, ScoreBreakdown, StickerState, Face, GameMode } from './types';
import { PLAYERS, DEFAULT_STICKER_COLOR, FACE_OFFSETS, MAX_PER_COLOR } from './constants';

interface GameState {
  stickers: StickerState[]; // Array of 54 stickers
  currentPlayer: PlayerId;
  phase: GamePhase;
  scores: Record<PlayerId, ScoreBreakdown>;
  selectedColorIndex: number; // 0, 1, or 2 (index into player's color array)
  winner: PlayerId | 'DRAW' | null;
  isAnimating: boolean;
  gameMode: GameMode;
  colorCounts: Record<PlayerId, number[]>; // Track usage of each color index
  lastPlacedStickerIndex: number | null; // Track the most recently placed tile for highlighting
  consecutiveSkips: number; // Track consecutive skips to enforce limit
  
  // Actions
  selectColor: (index: number) => void;
  placeTile: (index: number) => void;
  rotateFace: (face: Face, clockwise: boolean) => Promise<void>;
  skipTwist: () => void;
  setIsAnimating: (animating: boolean) => void;
  resetGame: () => void; // Goes back to SETUP
  startGame: (mode: GameMode) => void; // Starts the game
  setGameMode: (mode: GameMode) => void; // Helper (less used now)
}

// Initial empty board
const createInitialStickers = (): StickerState[] => 
  Array(54).fill(null).map(() => ({ owner: null, color: DEFAULT_STICKER_COLOR }));

// --- Scoring Logic ---

const checkLine = (a: StickerState, b: StickerState, c: StickerState, pid: PlayerId) => 
  a.owner === pid && b.owner === pid && c.owner === pid;

const calculateScores = (stickers: StickerState[]): Record<PlayerId, ScoreBreakdown> => {
  const result: Record<PlayerId, ScoreBreakdown> = {
    P1: { lines: 0, squares: 0, faces: 0, crosses: 0, total: 0 },
    P2: { lines: 0, squares: 0, faces: 0, crosses: 0, total: 0 },
  };

  const faces = [
    [0,1,2,3,4,5,6,7,8], // U
    [9,10,11,12,13,14,15,16,17], // L
    [18,19,20,21,22,23,24,25,26], // F
    [27,28,29,30,31,32,33,34,35], // R
    [36,37,38,39,40,41,42,43,44], // B
    [45,46,47,48,49,50,51,52,53], // D
  ];

  (['P1', 'P2'] as PlayerId[]).forEach(pid => {
    faces.forEach(faceIndices => {
      const s = (i: number) => stickers[faceIndices[i]];
      
      // Lines: Rows (3) + Cols (3) + Diagonals (2)
      let lines = 0;
      // Rows
      if (checkLine(s(0), s(1), s(2), pid)) lines++;
      if (checkLine(s(3), s(4), s(5), pid)) lines++;
      if (checkLine(s(6), s(7), s(8), pid)) lines++;
      // Cols
      if (checkLine(s(0), s(3), s(6), pid)) lines++;
      if (checkLine(s(1), s(4), s(7), pid)) lines++;
      if (checkLine(s(2), s(5), s(8), pid)) lines++;
      // Diags
      if (checkLine(s(0), s(4), s(8), pid)) lines++;
      if (checkLine(s(2), s(4), s(6), pid)) lines++;

      // Squares (2x2)
      let squares = 0;
      const checkSq = (i1: number, i2: number, i3: number, i4: number) => 
        s(i1).owner === pid && s(i2).owner === pid && s(i3).owner === pid && s(i4).owner === pid;
      if (checkSq(0, 1, 3, 4)) squares++;
      if (checkSq(1, 2, 4, 5)) squares++;
      if (checkSq(3, 4, 6, 7)) squares++;
      if (checkSq(4, 5, 7, 8)) squares++;

      // Face Bonus
      let faceBonus = 0;
      if (faceIndices.every(idx => stickers[idx].owner === pid)) faceBonus = 1;

      // Cross Bonus (Same Color + Owner)
      // Shape: + (1, 3, 4, 5, 7)
      let crosses = 0;
      const center = s(4);
      if (center.owner === pid) {
        // Check surrounding
        const crossIndices = [1, 3, 5, 7];
        const isCross = crossIndices.every(i => {
          const neighbor = s(i);
          return neighbor.owner === pid && neighbor.color === center.color;
        });
        if (isCross) crosses = 1; // Max 1 cross per face
      }

      result[pid].lines += lines;
      result[pid].squares += squares;
      result[pid].faces += faceBonus;
      result[pid].crosses += crosses;
      result[pid].total += (lines * 1) + (squares * 2) + (faceBonus * 5) + (crosses * 3);
    });
  });

  return result;
};

// --- Permutation Logic ---
const getRotatedIndices = (stickers: StickerState[], face: Face, clockwise: boolean): StickerState[] => {
  const newStickers = [...stickers];
  
  // Helper to cycle 4 indices
  const cycle = (i1: number, i2: number, i3: number, i4: number) => {
    if (clockwise) {
      const temp = newStickers[i4];
      newStickers[i4] = newStickers[i3];
      newStickers[i3] = newStickers[i2];
      newStickers[i2] = newStickers[i1];
      newStickers[i1] = temp;
    } else {
      const temp = newStickers[i1];
      newStickers[i1] = newStickers[i2];
      newStickers[i2] = newStickers[i3];
      newStickers[i3] = newStickers[i4];
      newStickers[i4] = temp;
    }
  };

  // 1. Rotate the face itself
  const offset = FACE_OFFSETS[face];
  cycle(offset + 0, offset + 2, offset + 8, offset + 6);
  cycle(offset + 1, offset + 5, offset + 7, offset + 3);

  // 2. Rotate adjacent sides
  switch (face) {
    case 'U': 
      cycle(18, 9, 36, 27);
      cycle(19, 10, 37, 28);
      cycle(20, 11, 38, 29);
      break;
    case 'D': 
      cycle(24, 33, 42, 15);
      cycle(25, 34, 43, 16);
      cycle(26, 35, 44, 17);
      break;
    case 'L': 
      cycle(0, 18, 45, 44);
      cycle(3, 21, 48, 41);
      cycle(6, 24, 51, 38);
      break;
    case 'R': 
      cycle(20, 2, 42, 47);
      cycle(23, 5, 39, 50);
      cycle(26, 8, 36, 53);
      break;
    case 'F': 
      cycle(6, 27, 47, 17);
      cycle(7, 30, 46, 14);
      cycle(8, 33, 45, 11);
      break;
    case 'B': 
      cycle(2, 9, 51, 35);
      cycle(1, 12, 52, 32);
      cycle(0, 15, 53, 29);
      break;
  }
  
  return newStickers;
};

export const useGameStore = create<GameState>((set, get) => ({
  stickers: createInitialStickers(),
  currentPlayer: 'P1',
  phase: 'SETUP',
  scores: { P1: {lines:0, squares:0, faces:0, crosses:0, total:0}, P2: {lines:0, squares:0, faces:0, crosses:0, total:0} },
  selectedColorIndex: 0,
  winner: null,
  isAnimating: false,
  gameMode: 'MULTI',
  colorCounts: { P1: [0,0,0], P2: [0,0,0] },
  lastPlacedStickerIndex: null,
  consecutiveSkips: 0,

  selectColor: (index) => set({ selectedColorIndex: index }),

  placeTile: (index) => {
    const { phase, stickers, currentPlayer, selectedColorIndex, gameMode, colorCounts } = get();
    // Allow auto-placement in RANDOM mode even if owner is null (validation happened before calling)
    if (phase !== 'PLACE' || stickers[index].owner !== null) return;

    // Check limits for MULTI mode
    if (gameMode === 'MULTI') {
        if (colorCounts[currentPlayer][selectedColorIndex] >= MAX_PER_COLOR) {
            return; // Limit reached
        }
    }

    const newStickers = [...stickers];
    const playerConfig = PLAYERS[currentPlayer];
    newStickers[index] = {
      owner: currentPlayer,
      color: playerConfig.colors[selectedColorIndex],
    };

    // Update counts
    const newColorCounts = { 
        ...colorCounts, 
        [currentPlayer]: [...colorCounts[currentPlayer]] 
    };
    newColorCounts[currentPlayer][selectedColorIndex]++;

    const newScores = calculateScores(newStickers);
    set({
      stickers: newStickers,
      phase: 'TWIST',
      scores: newScores,
      colorCounts: newColorCounts,
      lastPlacedStickerIndex: index
    });
  },

  rotateFace: async (face, clockwise) => {
    const { phase, stickers, currentPlayer } = get();
    if (phase !== 'TWIST') return;

    // Reset consecutive skips because a move was made
    set({ isAnimating: true, consecutiveSkips: 0 });
    
    // Slight delay is handled by animation duration in Cube component mostly, 
    // but the store update happens after 'animation finished' callback in Cube.tsx.
    
    const newStickers = getRotatedIndices(stickers, face, clockwise);
    
    const newScores = calculateScores(newStickers);
    
    const isFull = newStickers.every(s => s.owner !== null);
    let winner: PlayerId | 'DRAW' | null = null;
    
    if (isFull) {
      const s1 = newScores.P1.total;
      const s2 = newScores.P2.total;
      if (s1 > s2) winner = 'P1';
      else if (s2 > s1) winner = 'P2';
      else winner = 'DRAW';
    }

    const nextPlayer = isFull ? currentPlayer : (currentPlayer === 'P1' ? 'P2' : 'P1');
    const nextPhase = isFull ? 'GAME_OVER' : 'PLACE';

    set({
      stickers: newStickers,
      scores: newScores,
      phase: nextPhase,
      currentPlayer: nextPlayer,
      winner,
      isAnimating: false,
      lastPlacedStickerIndex: null // Clear highlight after twist
    });
  },

  skipTwist: () => {
    const { phase, stickers, currentPlayer, scores, consecutiveSkips } = get();
    if (phase !== 'TWIST') return;

    const newSkips = consecutiveSkips + 1;

    // Check excessive skipping condition: > 2 skips means the current player loses
    if (newSkips > 2) {
       const winner = currentPlayer === 'P1' ? 'P2' : 'P1';
       set({
           winner,
           phase: 'GAME_OVER',
           consecutiveSkips: newSkips
       });
       return;
    }

    const isFull = stickers.every(s => s.owner !== null);
    let winner: PlayerId | 'DRAW' | null = null;

    if (isFull) {
      const s1 = scores.P1.total;
      const s2 = scores.P2.total;
      if (s1 > s2) winner = 'P1';
      else if (s2 > s1) winner = 'P2';
      else winner = 'DRAW';
    }

    const nextPlayer = isFull ? currentPlayer : (currentPlayer === 'P1' ? 'P2' : 'P1');
    const nextPhase = isFull ? 'GAME_OVER' : 'PLACE';

    set({
      phase: nextPhase,
      currentPlayer: nextPlayer,
      winner,
      lastPlacedStickerIndex: null, // Clear highlight
      consecutiveSkips: newSkips
    });
  },
  
  setIsAnimating: (animating) => set({ isAnimating: animating }),

  startGame: (mode) => set({
    gameMode: mode,
    stickers: createInitialStickers(),
    currentPlayer: 'P1',
    phase: 'PLACE',
    scores: { P1: {lines:0, squares:0, faces:0, crosses:0, total:0}, P2: {lines:0, squares:0, faces:0, crosses:0, total:0} },
    winner: null,
    isAnimating: false,
    colorCounts: { P1: [0,0,0], P2: [0,0,0] },
    selectedColorIndex: 0,
    lastPlacedStickerIndex: null,
    consecutiveSkips: 0
  }),

  // Helper used if we wanted to switch mid-game (but we reset now)
  setGameMode: (mode) => set({ gameMode: mode }),

  resetGame: () => {
    set({
        phase: 'SETUP', // Go back to Setup
        stickers: createInitialStickers(),
        currentPlayer: 'P1',
        scores: { P1: {lines:0, squares:0, faces:0, crosses:0, total:0}, P2: {lines:0, squares:0, faces:0, crosses:0, total:0} },
        winner: null,
        isAnimating: false,
        colorCounts: { P1: [0,0,0], P2: [0,0,0] },
        selectedColorIndex: 0,
        lastPlacedStickerIndex: null,
        consecutiveSkips: 0
    });
  }
}));
