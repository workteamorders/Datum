"use client";

import { useEffect, useState, type CSSProperties } from "react";

export function Confirmed() {
  const [burst, setBurst] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setBurst(false), 1200);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="confirmed-art">
      <span className="art-seal art-seal--confirmed" aria-hidden="true">Confirmed</span>
      {burst && (
        <span className="confirmed-art__burst" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => {
            const angle = i * Math.PI * (3 - Math.sqrt(5));
            const distance = 24 + i % 6 * 9;
            const style = {
              "--dx": `${Math.cos(angle) * distance}px`,
              "--dy": `${Math.sin(angle) * distance}px`,
              "--turn": `${i * 33}deg`,
            } as CSSProperties;
            return <i key={i} style={style} />;
          })}
        </span>
      )}
    </div>
  );
}
