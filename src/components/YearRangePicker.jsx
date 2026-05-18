import React, { useMemo } from 'react';
import { FP } from '@/lib/fp';

/**
 * YearRangePicker — selector visual de rango de años.
 *
 *  • Display grande con la franja seleccionada en gradient flame.
 *  • Chips de presets ("Este año", "Últimos 5", "Últimos 10", "Cualquier año").
 *  • Dual-thumb slider con pista coloreada entre las dos manillas y
 *    marcas de década. Cada manilla recibe el valor que le corresponde
 *    (la izquierda nunca pasa a la derecha y viceversa).
 *
 * Props:
 *   yearFrom      number | null   (null = sin límite inferior, equivale a `min`)
 *   yearTo        number | null   (null = sin límite superior, equivale a `max`)
 *   onChange({ yearFrom, yearTo })
 *   min           year  (default 1980)
 *   max           year  (default current year)
 *   allowAny      boolean — muestra chip "Cualquier año" que pone null/null
 */
export default function YearRangePicker({
  yearFrom, yearTo, onChange,
  min = 1980, max = new Date().getFullYear(),
  allowAny = true,
}) {
  const fromValue = yearFrom ?? min;
  const toValue   = yearTo ?? max;
  const thisYear  = max;

  const presets = useMemo(() => {
    const items = [];
    if (allowAny) items.push({ key: 'any',   label: 'Cualquier año', from: null,             to: null });
    items.push({ key: 'this',  label: 'Este año',       from: thisYear,         to: thisYear });
    items.push({ key: 'last5', label: 'Últimos 5',      from: thisYear - 4,     to: thisYear });
    items.push({ key: 'last10', label: 'Últimos 10',    from: thisYear - 9,     to: thisYear });
    items.push({ key: 'last20', label: 'Últimos 20',    from: thisYear - 19,    to: thisYear });
    items.push({ key: '00s',   label: '2000s',          from: 2000,             to: 2009 });
    items.push({ key: '90s',   label: '90s',            from: 1990,             to: 1999 });
    return items;
  }, [thisYear, allowAny]);

  const matchesPreset = (p) => (p.from === yearFrom) && (p.to === yearTo);

  // Position percentages for the colored track between the two thumbs.
  const span = max - min;
  const leftPct  = ((fromValue - min) / span) * 100;
  const rightPct = ((toValue   - min) / span) * 100;
  const isAny = yearFrom === null && yearTo === null;

  const setFrom = (v) => {
    const next = Math.min(v, toValue);
    onChange?.({ yearFrom: next, yearTo: yearTo ?? max });
  };
  const setTo = (v) => {
    const next = Math.max(v, fromValue);
    onChange?.({ yearFrom: yearFrom ?? min, yearTo: next });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Big display */}
      <div style={{
        textAlign: 'center', padding: '4px 0 2px',
      }}>
        <div style={{
          fontFamily: '"Inter", "Space Grotesk", system-ui',
          fontSize: 32, fontWeight: 800, letterSpacing: -0.8,
          background: isAny
            ? 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55))'
            : 'linear-gradient(135deg, #FFB547 0%, #FF6B4A 30%, #FF3B6B 65%, #9B3BFF 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text',
          color: 'transparent', lineHeight: 1.1,
        }}>
          {isAny ? 'Cualquier año' : `${fromValue} – ${toValue}`}
        </div>
        {!isAny && (
          <div style={{ fontSize: 11, color: FP.textMuted, marginTop: 2, letterSpacing: 1 }}>
            {toValue - fromValue === 0 ? 'Solo ese año' : `${toValue - fromValue + 1} años`}
          </div>
        )}
      </div>

      {/* Presets */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {presets.map(p => {
          const active = matchesPreset(p);
          return (
            <button key={p.key} onClick={() => onChange?.({ yearFrom: p.from, yearTo: p.to })} style={{
              padding: '7px 13px', borderRadius: 999,
              fontFamily: '"Space Grotesk", system-ui',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.15s',
              background: active
                ? 'linear-gradient(135deg, rgba(255,107,74,0.30), rgba(255,59,107,0.20))'
                : 'rgba(255,255,255,0.05)',
              border: active
                ? '1px solid rgba(255,107,74,0.55)'
                : '1px solid rgba(255,255,255,0.10)',
              color: active ? '#fff' : 'rgba(255,255,255,0.65)',
            }}>{p.label}</button>
          );
        })}
      </div>

      {/* Dual slider */}
      <div style={{
        position: 'relative',
        padding: '22px 14px 18px',
        borderRadius: 18,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Slider area */}
        <div style={{ position: 'relative', height: 32 }}>
          {/* Base track */}
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '50%',
            height: 6, marginTop: -3, borderRadius: 999,
            background: 'rgba(255,255,255,0.10)',
          }}/>
          {/* Selected segment */}
          <div style={{
            position: 'absolute', top: '50%', height: 6, marginTop: -3, borderRadius: 999,
            left: `${leftPct}%`, width: `${Math.max(0, rightPct - leftPct)}%`,
            background: 'linear-gradient(90deg, #FF6B4A 0%, #FF3B6B 50%, #9B3BFF 100%)',
            boxShadow: '0 0 16px rgba(255,59,107,0.40)',
          }}/>
          {/* Inputs (transparent, only thumbs interactive) */}
          <input
            type="range" min={min} max={max} step={1}
            value={fromValue}
            onChange={(e) => setFrom(+e.target.value)}
            className="fp-yr-range fp-yr-range--lo"
            style={sliderStyle}
          />
          <input
            type="range" min={min} max={max} step={1}
            value={toValue}
            onChange={(e) => setTo(+e.target.value)}
            className="fp-yr-range fp-yr-range--hi"
            style={sliderStyle}
          />
        </div>
        {/* Decade markers */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 10, padding: '0 4px',
          fontSize: 10, color: 'rgba(255,255,255,0.40)',
          fontFamily: '"Space Grotesk", system-ui', fontWeight: 600,
          letterSpacing: 0.4,
        }}>
          <span>{min}</span>
          {min < 1990 && 1990 < max && <span>1990</span>}
          {min < 2000 && 2000 < max && <span>2000</span>}
          {min < 2010 && 2010 < max && <span>2010</span>}
          {min < 2020 && 2020 < max && <span>2020</span>}
          <span>{max}</span>
        </div>
      </div>

      <style>{YEAR_RANGE_CSS}</style>
    </div>
  );
}

const sliderStyle = {
  position: 'absolute',
  top: 0, left: 0, right: 0,
  width: '100%', height: 32, margin: 0,
  background: 'transparent',
  appearance: 'none', WebkitAppearance: 'none',
  pointerEvents: 'none',
};

const YEAR_RANGE_CSS = `
.fp-yr-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 24px; height: 24px; border-radius: 999px;
  background: linear-gradient(135deg, #FF6B4A 0%, #FF3B6B 50%, #9B3BFF 100%);
  border: 3px solid #0E0719;
  box-shadow: 0 4px 14px rgba(255,59,107,0.40), 0 0 0 1px rgba(255,255,255,0.20);
  cursor: grab; pointer-events: auto;
  transition: transform 0.12s;
}
.fp-yr-range::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.15); }
.fp-yr-range::-moz-range-thumb {
  width: 24px; height: 24px; border-radius: 999px;
  background: linear-gradient(135deg, #FF6B4A 0%, #FF3B6B 50%, #9B3BFF 100%);
  border: 3px solid #0E0719;
  box-shadow: 0 4px 14px rgba(255,59,107,0.40), 0 0 0 1px rgba(255,255,255,0.20);
  cursor: grab; pointer-events: auto;
}
.fp-yr-range::-webkit-slider-runnable-track { background: transparent; }
.fp-yr-range::-moz-range-track { background: transparent; }
/* Lo handle on top so it can always be grabbed */
.fp-yr-range--lo { z-index: 2; }
.fp-yr-range--hi { z-index: 3; }
`;
