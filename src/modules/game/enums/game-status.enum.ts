export const GameStatus = {
  WAITING: 'WAITING',
  STARTING: 'STARTING',
  ACTIVE: 'ACTIVE',
  REVIEWING: 'REVIEWING',
  ENDED: 'ENDED',
} as const;

export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];
