declare namespace YT {
  class Player {
    constructor(
      elementId: string,
      options: {
        videoId: string;
        playerVars?: Record<string, unknown>;
        events?: {
          onReady?: () => void;
          onStateChange?: (event: OnStateChangeEvent) => void;
        };
      }
    );
    getCurrentTime(): number;
    getDuration(): number;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    destroy(): void;
  }

  interface OnStateChangeEvent {
    data: number;
  }

  const PlayerState: {
    PLAYING: number;
    PAUSED: number;
    ENDED: number;
    BUFFERING: number;
  };
}
