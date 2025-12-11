
import { create } from 'zustand';
import { GamePhase, PlayerId, ScoreBreakdown, StickerState, Face, GameMode, MultiplayerStatus } from './types';
import { PLAYERS, DEFAULT_STICKER_COLOR, FACE_OFFSETS, MAX_PER_COLOR } from './constants';

declare global {
  interface Window {
    Peer: any;
  }
}

interface GameState {
  stickers: StickerState[];
  currentPlayer: PlayerId;
  phase: GamePhase;
  scores: Record<PlayerId, ScoreBreakdown>;
  selectedColorIndex: number;
  winner: PlayerId | 'DRAW' | null;
  isAnimating: boolean;
  gameMode: GameMode;
  colorCounts: Record<PlayerId, number[]>;
  lastPlacedStickerIndex: number | null;
  consecutiveSkips: number;
  
  mpStatus: MultiplayerStatus;
  myId: string | null;
  peerId: string | null;
  isHost: boolean;
  
  selectColor: (index: number) => void;
  placeTile: (index: number, fromNetwork?: boolean) => void;
  rotateFace: (face: Face, clockwise: boolean, fromNetwork?: boolean) => Promise<void>;
  skipTwist: (fromNetwork?: boolean) => void;
  setIsAnimating: (animating: boolean) => void;
  resetGame: () => void;
  startGame: (mode: GameMode) => void;
  setGameMode: (mode: GameMode) => void;
  hostGame: () => void;
  joinGame: (hostId: string) => void;
  leaveMultiplayer: () => void;
}

const createInitialStickers = (): StickerState[] => 
  Array(54).fill(null).map(() => ({ owner: null, color: DEFAULT_STICKER_COLOR }));

const checkLine = (a: StickerState, b: StickerState, c: StickerState, pid: PlayerId) => 
  a.owner === pid && b.owner === pid && c.owner === pid;

const calculateScores = (stickers: StickerState[]): Record<PlayerId, ScoreBreakdown> => {
  const result: Record<PlayerId, ScoreBreakdown> = {
    P1: { lines: 0, squares: 0, faces: 0, crosses: 0, total: 0 },
    P2: { lines: 0, squares: 0, faces: 0, crosses: 0, total: 0 },
  };
  const faces = [
    [0,1,2,3,4,5,6,7,8], [9,10,11,12,13,14,15,16,17], [18,19,20,21,22,23,24,25,26],
    [27,28,29,30,31,32,33,34,35], [36,37,38,39,40,41,42,43,44], [45,46,47,48,49,50,51,52,53]
  ];
  (['P1', 'P2'] as PlayerId[]).forEach(pid => {
    faces.forEach(faceIndices => {
      const s = (i: number) => stickers[faceIndices[i]];
      let lines = 0;
      if (checkLine(s(0), s(1), s(2), pid)) lines++;
      if (checkLine(s(3), s(4), s(5), pid)) lines++;
      if (checkLine(s(6), s(7), s(8), pid)) lines++;
      if (checkLine(s(0), s(3), s(6), pid)) lines++;
      if (checkLine(s(1), s(4), s(7), pid)) lines++;
      if (checkLine(s(2), s(5), s(8), pid)) lines++;
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
      let crosses = 0;
      const center = s(4);
      if (center.owner === pid) {
        const crossIndices = [1, 3, 5, 7];
        if (crossIndices.every(i => s(i).owner === pid && s(i).color === center.color)) crosses = 1;
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

const getRotatedIndices = (stickers: StickerState[], face: Face, clockwise: boolean): StickerState[] => {
  const newStickers = [...stickers];
  const cycle = (i1: number, i2: number, i3: number, i4: number) => {
    if (clockwise) {
      const temp = newStickers[i4]; newStickers[i4] = newStickers[i3]; newStickers[i3] = newStickers[i2]; newStickers[i2] = newStickers[i1]; newStickers[i1] = temp;
    } else {
      const temp = newStickers[i1]; newStickers[i1] = newStickers[i2]; newStickers[i2] = newStickers[i3]; newStickers[i3] = newStickers[i4]; newStickers[i4] = temp;
    }
  };
  const offset = FACE_OFFSETS[face];
  cycle(offset + 0, offset + 2, offset + 8, offset + 6);
  cycle(offset + 1, offset + 5, offset + 7, offset + 3);
  switch (face) {
    case 'U': cycle(18, 9, 36, 27); cycle(19, 10, 37, 28); cycle(20, 11, 38, 29); break;
    case 'D': cycle(24, 33, 42, 15); cycle(25, 34, 43, 16); cycle(26, 35, 44, 17); break;
    case 'L': cycle(0, 18, 45, 44); cycle(3, 21, 48, 41); cycle(6, 24, 51, 38); break;
    case 'R': cycle(20, 2, 42, 47); cycle(23, 5, 39, 50); cycle(26, 8, 36, 53); break;
    case 'F': cycle(6, 27, 47, 17); cycle(7, 30, 46, 14); cycle(8, 33, 45, 11); break;
    case 'B': cycle(2, 9, 51, 35); cycle(1, 12, 52, 32); cycle(0, 15, 53, 29); break;
  }
  return newStickers;
};

let peer: any = null;
let conn: any = null;
let processingNetworkMove = false;

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
  mpStatus: 'DISCONNECTED',
  myId: null,
  peerId: null,
  isHost: false,

  selectColor: (index) => set({ selectedColorIndex: index }),

  placeTile: (index, fromNetwork = false) => {
    const { phase, stickers, currentPlayer, selectedColorIndex, gameMode, colorCounts, mpStatus, isHost } = get();
    if (mpStatus === 'CONNECTED' && !fromNetwork) {
        const amIPlayer1 = isHost;
        const isMyTurn = (currentPlayer === 'P1' && amIPlayer1) || (currentPlayer === 'P2' && !amIPlayer1);
        if (!isMyTurn) return; 
    }
    if (phase !== 'PLACE' || stickers[index].owner !== null) return;
    if (gameMode === 'MULTI' && colorCounts[currentPlayer][selectedColorIndex] >= MAX_PER_COLOR) return; 

    if (mpStatus === 'CONNECTED' && !fromNetwork && conn) {
        conn.send({ type: 'PLACE', index, colorIdx: selectedColorIndex });
    }

    const newStickers = [...stickers];
    newStickers[index] = { owner: currentPlayer, color: PLAYERS[currentPlayer].colors[selectedColorIndex] };
    const newColorCounts = { ...colorCounts, [currentPlayer]: [...colorCounts[currentPlayer]] };
    newColorCounts[currentPlayer][selectedColorIndex]++;
    set({ stickers: newStickers, phase: 'TWIST', scores: calculateScores(newStickers), colorCounts: newColorCounts, lastPlacedStickerIndex: index });
  },

  rotateFace: async (face, clockwise, fromNetwork = false) => {
    // Flag check loopback
    if (processingNetworkMove) {
        fromNetwork = true;
        processingNetworkMove = false;
    }

    const { phase, stickers, currentPlayer, mpStatus, isHost } = get();

    if (mpStatus === 'CONNECTED' && !fromNetwork) {
        const amIPlayer1 = isHost;
        const isMyTurn = (currentPlayer === 'P1' && amIPlayer1) || (currentPlayer === 'P2' && !amIPlayer1);
        if (!isMyTurn) return;
    }

    if (phase !== 'TWIST') return;

    if (mpStatus === 'CONNECTED' && !fromNetwork && conn) {
        conn.send({ type: 'ROTATE', face, clockwise });
    }

    // If network initiated, we already triggered the visual event which calls this back.
    // We just proceed to update state.

    set({ isAnimating: true, consecutiveSkips: 0 });
    
    // For local moves, we also want to trigger the visual animation if we called this directly (rare, usually via UI interaction on Cube)
    // Actually, Cube calls this function.
    // If fromNetwork is true, it means we came from the Cube callback which was triggered by our CustomEvent.
    // So we just update state.

    const newStickers = getRotatedIndices(stickers, face, clockwise);
    const newScores = calculateScores(newStickers);
    const isFull = newStickers.every(s => s.owner !== null);
    let winner: PlayerId | 'DRAW' | null = null;
    
    if (isFull) {
      const s1 = newScores.P1.total; const s2 = newScores.P2.total;
      winner = s1 > s2 ? 'P1' : s2 > s1 ? 'P2' : 'DRAW';
    }

    set({
      stickers: newStickers,
      scores: newScores,
      phase: isFull ? 'GAME_OVER' : 'PLACE',
      currentPlayer: isFull ? currentPlayer : (currentPlayer === 'P1' ? 'P2' : 'P1'),
      winner,
      isAnimating: false,
      lastPlacedStickerIndex: null
    });
  },

  skipTwist: (fromNetwork = false) => {
    const { phase, stickers, currentPlayer, scores, consecutiveSkips, mpStatus, isHost } = get();
    if (mpStatus === 'CONNECTED' && !fromNetwork) {
        const amIPlayer1 = isHost;
        const isMyTurn = (currentPlayer === 'P1' && amIPlayer1) || (currentPlayer === 'P2' && !amIPlayer1);
        if (!isMyTurn) return;
    }
    if (phase !== 'TWIST') return;
    if (mpStatus === 'CONNECTED' && !fromNetwork && conn) conn.send({ type: 'SKIP' });

    const newSkips = consecutiveSkips + 1;
    if (newSkips > 2) {
       set({ winner: currentPlayer === 'P1' ? 'P2' : 'P1', phase: 'GAME_OVER', consecutiveSkips: newSkips });
       return;
    }
    const isFull = stickers.every(s => s.owner !== null);
    let winner: PlayerId | 'DRAW' | null = null;
    if (isFull) {
      const s1 = scores.P1.total; const s2 = scores.P2.total;
      winner = s1 > s2 ? 'P1' : s2 > s1 ? 'P2' : 'DRAW';
    }
    set({ phase: isFull ? 'GAME_OVER' : 'PLACE', currentPlayer: isFull ? currentPlayer : (currentPlayer === 'P1' ? 'P2' : 'P1'), winner, lastPlacedStickerIndex: null, consecutiveSkips: newSkips });
  },
  
  setIsAnimating: (animating) => set({ isAnimating: animating }),
  startGame: (mode) => set({
    gameMode: mode, stickers: createInitialStickers(), currentPlayer: 'P1', phase: 'PLACE', scores: { P1: {lines:0, squares:0, faces:0, crosses:0, total:0}, P2: {lines:0, squares:0, faces:0, crosses:0, total:0} }, winner: null, isAnimating: false, colorCounts: { P1: [0,0,0], P2: [0,0,0] }, selectedColorIndex: 0, lastPlacedStickerIndex: null, consecutiveSkips: 0
  }),
  setGameMode: (mode) => set({ gameMode: mode }),
  resetGame: () => {
    const { leaveMultiplayer } = get(); leaveMultiplayer();
    set({ phase: 'SETUP', stickers: createInitialStickers(), currentPlayer: 'P1', scores: { P1: {lines:0, squares:0, faces:0, crosses:0, total:0}, P2: {lines:0, squares:0, faces:0, crosses:0, total:0} }, winner: null, isAnimating: false, colorCounts: { P1: [0,0,0], P2: [0,0,0] }, selectedColorIndex: 0, lastPlacedStickerIndex: null, consecutiveSkips: 0, mpStatus: 'DISCONNECTED', myId: null, peerId: null, isHost: false });
  },

  hostGame: () => {
    if (peer) peer.destroy();
    peer = new window.Peer(null, { debug: 1 });
    set({ mpStatus: 'INIT' });
    peer.on('open', (id: string) => set({ mpStatus: 'WAITING', myId: id, isHost: true }));
    peer.on('connection', (connection: any) => {
        conn = connection;
        set({ mpStatus: 'CONNECTED', peerId: conn.peer });
        conn.on('data', (data: any) => {
            const state = get();
            if (data.type === 'PLACE') { set({ selectedColorIndex: data.colorIdx }); state.placeTile(data.index, true); }
            else if (data.type === 'ROTATE') { 
                processingNetworkMove = true; 
                window.dispatchEvent(new CustomEvent('cube-rotate', { detail: { face: data.face, clockwise: data.clockwise } })); 
            }
            else if (data.type === 'SKIP') { state.skipTwist(true); }
        });
        conn.on('close', () => { set({ mpStatus: 'DISCONNECTED', winner: null, phase: 'SETUP' }); alert("Opponent disconnected."); });
        get().startGame('SINGLE');
        conn.send({ type: 'SYNC_START', mode: 'SINGLE' });
    });
    peer.on('error', (err: any) => { console.error(err); set({ mpStatus: 'DISCONNECTED' }); alert("Connection Error: " + err.type); });
  },

  joinGame: (hostId: string) => {
    if (peer) peer.destroy();
    peer = new window.Peer(null, { debug: 1 });
    set({ mpStatus: 'INIT', isHost: false });
    peer.on('open', (id: string) => {
        set({ myId: id });
        conn = peer.connect(hostId);
        set({ mpStatus: 'CONNECTING' });
        conn.on('open', () => set({ mpStatus: 'CONNECTED', peerId: hostId }));
        conn.on('data', (data: any) => {
            const state = get();
            if (data.type === 'SYNC_START') { state.startGame(data.mode); }
            else if (data.type === 'PLACE') { set({ selectedColorIndex: data.colorIdx }); state.placeTile(data.index, true); }
            else if (data.type === 'ROTATE') { 
                processingNetworkMove = true; 
                window.dispatchEvent(new CustomEvent('cube-rotate', { detail: { face: data.face, clockwise: data.clockwise } })); 
            }
            else if (data.type === 'SKIP') { state.skipTwist(true); }
        });
        conn.on('close', () => { set({ mpStatus: 'DISCONNECTED', winner: null, phase: 'SETUP' }); alert("Host disconnected."); });
    });
    peer.on('error', (err: any) => { console.error(err); set({ mpStatus: 'DISCONNECTED' }); alert("Connection Error (Check ID): " + err.type); });
  },
  
  leaveMultiplayer: () => {
      if (conn) conn.close();
      if (peer) peer.destroy();
      conn = null; peer = null; processingNetworkMove = false;
      set({ mpStatus: 'DISCONNECTED', myId: null, peerId: null });
  }
}));
