const HAND_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

// Scroll anchoring moves the scroller too, so only real input counts as taking over.
export function onHandInput(heard: () => void): () => void {
  for (const type of HAND_EVENTS) window.addEventListener(type, heard, true);
  return () => {
    for (const type of HAND_EVENTS) window.removeEventListener(type, heard, true);
  };
}
