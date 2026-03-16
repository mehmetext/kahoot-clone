export const GameStatus = {
  WAITING: 'WAITING',
  STARTING: 'STARTING',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
} as const;

export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];
