export interface ARSupportResult { supported: boolean; reason: string; }
export interface ARSessionOptions { canvas: HTMLCanvasElement; modelUrl: string; scale?: number; rotationY?: number; yOffset?: number; }
export type ARSessionLike = { end: () => Promise<void>; addEventListener: (type: string, listener: () => void) => void };
