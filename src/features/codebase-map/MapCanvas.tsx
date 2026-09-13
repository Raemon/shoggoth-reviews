'use client';

import { useEffect, useRef, useState } from 'react';
import { MapEngine } from './mapEngine';
import type { MapNode } from './mapLayout';
import type { MapScene } from './mapRenderer';
import styles from './codebaseMap.module.css';

export function MapCanvas({ scene, focus, onSelect }: { scene: MapScene; focus: MapNode | null; onSelect: (node: MapNode) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const minimap = useRef<HTMLCanvasElement>(null);
  const engine = useRef<MapEngine | null>(null);
  const initial = useRef(scene);
  const select = useRef(onSelect);
  const [zoom, setZoom] = useState(100);
  const [hover, setHover] = useState('');
  select.current = onSelect;
  useEffect(() => {
    const map = new MapEngine(canvas.current!, minimap.current!, initial.current, { select: (node) => select.current(node), zoom: setZoom, hover: setHover });
    engine.current = map;
    return () => { map.destroy(); engine.current = null; };
  }, []);
  useEffect(() => engine.current?.update(scene), [scene]);
  useEffect(() => { if (focus) engine.current?.fit(focus); }, [focus]);
  return (
    <div className={styles.stage}>
      <canvas ref={canvas} className={styles.canvas} tabIndex={0} role="group" aria-label="Interactive code map. Drag to pan, scroll to zoom. Arrow keys pan, plus and minus zoom, zero fits the repository. Select files using the file list." />
      <div className={styles.mapTools} aria-label="Map navigation">
        <button onClick={() => engine.current?.zoom(1 / 1.5)} aria-label="Zoom out">−</button>
        <output aria-label="Zoom level">{zoom.toLocaleString()}%</output>
        <button onClick={() => engine.current?.zoom(1.5)} aria-label="Zoom in">+</button>
        <button onClick={() => engine.current?.fit()} title="Fit repository (0)">Fit repo</button>
      </div>
      <button className={styles.minimap} onClick={() => engine.current?.fit()} aria-label="Fit whole repository">
        <canvas ref={minimap} width={160} height={108} aria-hidden="true" />
      </button>
      <div className={styles.hoverPath}>{hover || 'Drag to pan · Scroll to zoom · Double-click to focus'}</div>
    </div>
  );
}
