import React, { useMemo } from 'react';

const colorChannelMixer = (a: number, b: number, t: number) => a * t + b * (1 - t);
const colorMixer = (rgbA: number[], rgbB: number[], t: number) =>
  `rgb(${colorChannelMixer(rgbA[0],rgbB[0],t)},${colorChannelMixer(rgbA[1],rgbB[1],t)},${colorChannelMixer(rgbA[2],rgbB[2],t)})`;

const COLORS = {
  primary: [255, 82,  99],   // red
  second:  [61,  214, 140],  // green
  accent:  [211, 84,  0],    // orange
};

// Warna untuk durability bar (item)
const getDurabilityColor = (pct: number): string => {
  if (pct < 50) return colorMixer(COLORS.accent,  COLORS.primary, pct / 100);
  return           colorMixer(COLORS.second, COLORS.accent,  pct / 100);
};

// Warna untuk weight bar inventory — cyan tetap (sesuai tema cyberpunk)
const CYAN  = '#00e5ff';
const CYAN2 = '#00b4d8';

interface Props {
  percent: number;
  durability?: boolean;
}

const WeightBar: React.FC<Props> = ({ percent, durability }) => {
  const clampedPct = Math.min(100, Math.max(0, percent));

  // ── Durability bar — tetap pakai bar tipis seperti sebelumnya ──────────────
  if (durability) {
    const color = getDurabilityColor(clampedPct);
    return (
      <div className="durability-bar">
        <div
          style={{
            visibility: clampedPct > 0 ? 'visible' : 'hidden',
            height: '100%',
            width: `${clampedPct}%`,
            backgroundColor: color,
            transition: `background 0.3s ease, width 0.3s ease`,
          }}
        />
      </div>
    );
  }

  // ── Weight bar — cyberpunk parallelogram stripe style ─────────────────────
  // Warna berubah hijau→kuning→merah seiring bertambah
  const fillColor = clampedPct > 75
    ? colorMixer(COLORS.primary, COLORS.accent, (clampedPct - 75) / 25)
    : clampedPct > 40
    ? colorMixer(COLORS.accent, [255, 220, 0], (clampedPct - 40) / 35)
    : CYAN;

  const glowColor = clampedPct > 75 ? 'rgba(255,82,99,0.5)'
    : clampedPct > 40 ? 'rgba(255,160,0,0.4)'
    : 'rgba(0,229,255,0.45)';

  return (
    <div className="weight-bar-cyber">
      {/* Track outline parallelogram */}
      <div className="weight-bar-track">
        {/* Fill */}
        <div
          className="weight-bar-fill"
          style={{
            width: `${clampedPct}%`,
            backgroundColor: fillColor,
            boxShadow: `0 0 8px ${glowColor}, 0 0 2px ${glowColor}`,
            transition: 'width 0.35s ease, background-color 0.35s ease, box-shadow 0.35s ease',
          }}
        >
          {/* Diagonal stripe overlay */}
          <div className="weight-bar-stripes" />
        </div>
        {/* Percentage text */}
        <span className="weight-bar-pct" style={{ color: fillColor, textShadow: `0 0 6px ${glowColor}` }}>
          {Math.round(clampedPct)}%
        </span>
      </div>
    </div>
  );
};

export default WeightBar;