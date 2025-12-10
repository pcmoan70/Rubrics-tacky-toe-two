
import { PlayerConfig } from './types';

export const PLAYERS: Record<string, PlayerConfig> = {
  P1: {
    id: 'P1',
    name: 'Player 1',
    colors: ['#ef4444', '#f97316', '#eab308'], // Red, Orange, Yellow (Warm)
    baseColor: '#ef4444',
  },
  P2: {
    id: 'P2',
    name: 'Player 2',
    colors: ['#3b82f6', '#22c55e', '#ffffff'], // Blue, Green, White (Cool)
    baseColor: '#3b82f6',
  },
};

export const DEFAULT_STICKER_COLOR = '#333333';
export const HOVER_COLOR = '#555555';
export const MAX_PER_COLOR = 9;

// Map logical face indices (0-5) to 3D orientation
// Order in state: U, L, F, R, B, D (Standard unfolding)
// Indices:
// U: 0-8
// L: 9-17
// F: 18-26
// R: 27-35
// B: 36-44
// D: 45-53

export const FACE_OFFSETS = {
  U: 0,
  L: 9,
  F: 18,
  R: 27,
  B: 36,
  D: 45,
};
