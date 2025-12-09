export type PlayerId = 'P1' | 'P2';

export interface PlayerConfig {
  id: PlayerId;
  name: string;
  colors: string[]; // The 3 colors available to this player
  baseColor: string; // Used for UI theming
}

export type Face = 'U' | 'D' | 'F' | 'B' | 'L' | 'R';

// The state of a single sticker
export interface StickerState {
  owner: PlayerId | null;
  color: string; // The hex color rendered
}

export type GamePhase = 'PLACE' | 'TWIST' | 'GAME_OVER';

export interface ScoreBreakdown {
  lines: number;
  squares: number;
  faces: number;
  total: number;
}
