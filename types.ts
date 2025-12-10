
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

export type GamePhase = 'SETUP' | 'PLACE' | 'TWIST' | 'GAME_OVER';

export type GameMode = 'SINGLE' | 'MULTI' | 'RANDOM';

export interface ScoreBreakdown {
  lines: number;
  squares: number;
  faces: number;
  crosses: number;
  total: number;
}

// Augment the global JSX namespace to include React Three Fiber elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      pointLight: any;
      group: any;
      mesh: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      planeGeometry: any;
      circleGeometry: any;
      ringGeometry: any;
    }
  }
}
