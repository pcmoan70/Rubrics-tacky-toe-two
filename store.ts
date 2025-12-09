import { create } from 'zustand';
import { GamePhase, PlayerId, ScoreBreakdown, StickerState, Face } from './types';
import { PLAYERS, DEFAULT_STICKER_COLOR, FACE_OFFSETS } from './constants';

interface GameState {
  stickers: StickerState[]; // Array of 54 stickers
  currentPlayer: PlayerId;
  phase: GamePhase;
  scores: Record<PlayerId, ScoreBreakdown>;
  selectedColorIndex: number; // 0, 1, or 2 (index into player's color array)
  winner: PlayerId | 'DRAW' | null;
  isAnimating: boolean;
  
  // Actions
  selectColor: (index: number) => void;
  placeTile: (index: number) => void;
  rotateFace: (face: Face, clockwise: boolean) => Promise<void>;
  setIsAnimating: (animating: boolean) => void;
  resetGame: () => void;
}

// Initial empty board
const createInitialStickers = (): StickerState[] => 
  Array(54).fill(null).map(() => ({ owner: null, color: DEFAULT_STICKER_COLOR }));

// --- Scoring Logic ---

const checkLine = (a: StickerState, b: StickerState, c: StickerState, pid: PlayerId) => 
  a.owner === pid && b.owner === pid && c.owner === pid;

const calculateScoreForFace = (faceIndices: number[], stickers: StickerState[], pid: PlayerId): number => {
  let score = 0;
  // faceIndices is a 9-element array representing the 3x3 grid
  // 0 1 2
  // 3 4 5
  // 6 7 8
  
  const s = (i: number) => stickers[faceIndices[i]];

  // Rows
  if (checkLine(s(0), s(1), s(2), pid)) score += 1;
  if (checkLine(s(3), s(4), s(5), pid)) score += 1;
  if (checkLine(s(6), s(7), s(8), pid)) score += 1;
  
  // Cols
  if (checkLine(s(0), s(3), s(6), pid)) score += 1;
  if (checkLine(s(1), s(4), s(7), pid)) score += 1;
  if (checkLine(s(2), s(5), s(8), pid)) score += 1;
  
  // Diagonals
  if (checkLine(s(0), s(4), s(8), pid)) score += 1;
  if (checkLine(s(2), s(4), s(6), pid)) score += 1;

  // Squares (2x2)
  // Top-left, Top-right, Bottom-left, Bottom-right
  const checkSquare = (i1: number, i2: number, i3: number, i4: number) => 
    s(i1).owner === pid && s(i2).owner === pid && s(i3).owner === pid && s(i4).owner === pid;
    
  if (checkSquare(0, 1, 3, 4)) score += 2;
  if (checkSquare(1, 2, 4, 5)) score += 2;
  if (checkSquare(3, 4, 6, 7)) score += 2;
  if (checkSquare(4, 5, 7, 8)) score += 2;

  // Full Face
  const isFullFace = faceIndices.every(idx => stickers[idx].owner === pid);
  if (isFullFace) score += 5;

  return score;
};

const calculateScores = (stickers: StickerState[]): Record<PlayerId, ScoreBreakdown> => {
  const result: Record<PlayerId, ScoreBreakdown> = {
    P1: { lines: 0, squares: 0, faces: 0, total: 0 },
    P2: { lines: 0, squares: 0, faces: 0, total: 0 },
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
    let totalScore = 0;
    faces.forEach(faceIndices => {
      // We assume the prompt implies cumulative score.
      // However, calculating "Lines", "Squares", "Faces" separately for UI is nice.
      // Re-implementing logic to separate types for breakdown:
      
      const s = (i: number) => stickers[faceIndices[i]];
      
      // Rows (3 horizontal) + Cols (3 vertical) + Diagonals (2)
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

      let squares = 0;
      const checkSq = (i1: number, i2: number, i3: number, i4: number) => 
        s(i1).owner === pid && s(i2).owner === pid && s(i3).owner === pid && s(i4).owner === pid;
      if (checkSq(0, 1, 3, 4)) squares++;
      if (checkSq(1, 2, 4, 5)) squares++;
      if (checkSq(3, 4, 6, 7)) squares++;
      if (checkSq(4, 5, 7, 8)) squares++;

      let faceBonus = 0;
      if (faceIndices.every(idx => stickers[idx].owner === pid)) faceBonus = 1;

      result[pid].lines += lines;
      result[pid].squares += squares;
      result[pid].faces += faceBonus;
      result[pid].total += (lines * 1) + (squares * 2) + (faceBonus * 5);
    });
  });

  return result;
};

// --- Permutation Logic ---
// We need to permute the 54-element array based on face rotations.
// Each face rotation cycles 5 sets of stickers: 
// 1. The face itself (corners cycle, edges cycle)
// 2. The adjacent rows on neighbors.

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
  // Corners: 0, 2, 8, 6 (TopLeft -> TopRight -> BottomRight -> BottomLeft)
  cycle(offset + 0, offset + 2, offset + 8, offset + 6);
  // Edges: 1, 5, 7, 3
  cycle(offset + 1, offset + 5, offset + 7, offset + 3);

  // 2. Rotate adjacent sides
  // Indicies are hardcoded based on standard flattened layout:
  // U(0-8), L(9-17), F(18-26), R(27-35), B(36-44), D(45-53)
  // Grid layout for ref:
  //       U0 U1 U2
  //       U3 U4 U5
  //       U6 U7 U8
  // L0 L1 L2  F0 F1 F2  R0 R1 R2  B0 B1 B2
  // L3 L4 L5  F3 F4 F5  R3 R4 R5  B3 B4 B5
  // L6 L7 L8  F6 F7 F8  R6 R7 R8  B6 B7 B8
  //       D0 D1 D2
  //       D3 D4 D5
  //       D6 D7 D8

  switch (face) {
    case 'U': // Top face. Neighbors: F, R, B, L (top rows)
      // F0->L0, F1->L1, F2->L2 ... wait.
      // Clockwise U moves F top row -> L top row -> B top row -> R top row -> F top row.
      // F(18,19,20), L(9,10,11), B(36,37,38), R(27,28,29)
      cycle(18, 9, 36, 27);
      cycle(19, 10, 37, 28);
      cycle(20, 11, 38, 29);
      break;
    case 'D': // Bottom face. Neighbors: F, R, B, L (bottom rows)
      // Clockwise D moves F bottom -> R bottom -> B bottom -> L bottom -> F bottom
      // F(24,25,26), R(33,34,35), B(42,43,44), L(15,16,17)
      cycle(24, 33, 42, 15);
      cycle(25, 34, 43, 16);
      cycle(26, 35, 44, 17);
      break;
    case 'L': // Left face. Neighbors: U, F, D, B
      // U left col (0,3,6) -> F left col (18,21,24) -> D left col (45,48,51) -> B right col (44,41,38) [Note B orientation]
      // Standard L move: U->F->D->B->U
      // Indices: U(0,3,6), F(18,21,24), D(45,48,51), B(44,41,38) (Inverse order for B typically?)
      // Let's visualize: Left face rotates. Top pieces move front.
      cycle(0, 18, 45, 44);
      cycle(3, 21, 48, 41);
      cycle(6, 24, 51, 38);
      break;
    case 'R': // Right face. Neighbors: U, B, D, F
      // U right col (2,5,8) -> B left col (36,39,42) -> D right col (47,50,53) -> F right col (20,23,26)
      // Clockwise R: U->B->D->F->U?
      // Imagine looking at R face. Top moves Back. Back moves Down. Down moves Front. Front moves Top.
      // U(2,5,8), B(42,39,36) [reversed], D(47,50,53), F(20,23,26)
      // Actually, on a standard cube, R moves F->U->B->D->F ??
      // Let's check: R turn moves the Front-Right column UP to Top-Right.
      // So F(20,23,26) -> U(2,5,8).
      // U(2,5,8) -> B(42,39,36) (B is usually upside down in unwrapped view).
      // B(42,39,36) -> D(47,50,53).
      // D(47,50,53) -> F(20,23,26).
      // So F -> U -> B -> D -> F is the flow of PIECES.
      // My cycle function moves i4->i3->i2->i1.
      // Order passed to cycle: Target1, Target2, Target3, Target4?
      // cycle(i1, i2, i3, i4) moves 4->3, 3->2, 2->1, 1->4 in clockwise arg mode.
      // Effectively: i1 gets i4's value. i2 gets i1's.
      // If F->U, then U needs F's value. So U is next in chain.
      // Sequence: F, U, B, D.
      // cycle(20, 2, 42, 47) -> 47->42, 42->2, 2->20, 20->47. Wait.
      // Let's stick to "i1 moves to i2".
      // If F moves to U, then cycle(F, U, B, D).
      // My cycle implementation: 
      // if CW: i4->i3, i3->i2, i2->i1, i1->i4. 
      // This means i1 GIVES to i4? No. `new[i1] = temp` (which was i4). So i1 TAKES from i4.
      // This is "Backward cycle".
      // To move A -> B -> C -> D -> A:
      // We want B to take A. C to take B.
      // My function: i1 takes i4. i2 takes i1.
      // So cycle(A, B, C, D) means B takes A. C takes B. D takes C. A takes D.
      // Correct.
      
      // R Move: F -> U -> B -> D -> F
      // Indices: F(20,23,26), U(2,5,8), B(42,39,36), D(47,50,53)
      cycle(20, 2, 42, 47);
      cycle(23, 5, 39, 50);
      cycle(26, 8, 36, 53);
      break;
    case 'F': // Front face. Neighbors: U, R, D, L
      // U bottom (6,7,8) -> R left (27,30,33) -> D top (45,46,47) -> L right (17,14,11)
      // Clockwise F: U->R->D->L->U
      // U(6,7,8) moves to R(27,30,33).
      // R(27,30,33) moves to D(47,46,45) [D top row reversed? No D is flat]. 
      // Actually F twist moves U(6,7,8) to R(27,30,33) is correct.
      // R(27,30,33) to D(47,46,45). (D0 is top left, D2 is top right. R bottom goes to D right? No.)
      // Imagine F face. Top (U) goes Right (R). Right (R) goes Bottom (D).
      // So U->R->D->L.
      // U(6,7,8), R(27,30,33), D(47,46,45), L(17,14,11)
      cycle(6, 27, 47, 17);
      cycle(7, 30, 46, 14);
      cycle(8, 33, 45, 11);
      break;
    case 'B': // Back face. Neighbors: U, L, D, R
      // U top (0,1,2) -> L left (9,12,15) ?? No.
      // Clockwise B: U top -> L side -> D bottom -> R side.
      // U(2,1,0) -> L(9,12,15) -> D(51,52,53) -> R(35,32,29)
      // Be careful with orientation.
      // Looking from back: U goes to L? No, U goes to L implies CCW from front?
      // B Clockwise (as seen from back) = CCW from front perspective relative to rings.
      // U top row moves to L left column.
      // U(2,1,0), L(9,12,15), D(51,52,53), R(35,32,29)
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
  phase: 'PLACE',
  scores: { P1: {lines:0, squares:0, faces:0, total:0}, P2: {lines:0, squares:0, faces:0, total:0} },
  selectedColorIndex: 0,
  winner: null,
  isAnimating: false,

  selectColor: (index) => set({ selectedColorIndex: index }),

  placeTile: (index) => {
    const { phase, stickers, currentPlayer, selectedColorIndex } = get();
    if (phase !== 'PLACE' || stickers[index].owner !== null) return;

    const newStickers = [...stickers];
    const playerConfig = PLAYERS[currentPlayer];
    newStickers[index] = {
      owner: currentPlayer,
      color: playerConfig.colors[selectedColorIndex],
    };

    // Calculate score immediately? The prompt says "When a user gets... he gets points".
    // Does score happen after PLACE or after TWIST? 
    // Usually logic implies checking state constantly.
    // We update score now.
    const newScores = calculateScores(newStickers);

    // Check if board is full
    const isFull = newStickers.every(s => s.owner !== null);

    set({
      stickers: newStickers,
      phase: 'TWIST',
      scores: newScores,
    });
  },

  rotateFace: async (face, clockwise) => {
    const { phase, stickers, currentPlayer } = get();
    if (phase !== 'TWIST') return;

    set({ isAnimating: true });

    // Wait for animation (handled by UI component triggering this, but we simulate delay here or in UI)
    // We expect the visual component to call this, wait a bit, then we update data.
    // For safety, let's just update data. The component can listen to change.
    // BUT, we want the data update to happen AFTER visual animation.
    // We will assume the caller waits for animation before calling this, OR
    // we use a promise.
    
    // We'll update state immediately but allow visual component to interpolate?
    // No, standard React pattern: Visuals animate -> onFinish -> Update State.
    // So this function acts as the "Commit Move".
    
    const newStickers = getRotatedIndices(stickers, face, clockwise);
    const newScores = calculateScores(newStickers);
    
    // Check End Game
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
      isAnimating: false
    });
  },
  
  setIsAnimating: (animating) => set({ isAnimating: animating }),

  resetGame: () => set({
    stickers: createInitialStickers(),
    currentPlayer: 'P1',
    phase: 'PLACE',
    scores: { P1: {lines:0, squares:0, faces:0, total:0}, P2: {lines:0, squares:0, faces:0, total:0} },
    winner: null,
    isAnimating: false
  })
}));
