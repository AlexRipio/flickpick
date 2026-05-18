import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FP } from '@/lib/fp';
import { searchTitle, posterUrl } from '@/lib/tmdb';
import { addToWatchlist, isInWatchlist } from '@/lib/watchlist';

/**
 * ImportListSheet — pega un bloque de texto con películas/series, una por
 * línea (también acepta "," o ";" como separador). Para cada entrada se
 * busca en TMDB de forma fuzzy y se muestra un preview con alternativas
 * cuando no hay un único hit claro. El usuario revisa, marca/desmarca y
 * confirma — el bloque añadido va a la watchlist ("Quiero ver").
 *
 * Estados internos:
 *   step = 'input'   → textarea
 *   step = 'review'  → lista de resultados con checkboxes y alternativas
 */
const ImportListSheet = ({ open, onClose, onImported }) => {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState('input');
  const [text, setText] = useState('');
  const [includeTV, setIncludeTV] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  // Per-line: { query, candidates[], selectedIdx, checked }
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!open) { setShow(false); return; }
    setStep('input'); setText(''); setRows([]); setBusy(false);
    setProgress({ done: 0, total: 0 });
    const t = setTimeout(() => setShow(true), 20);
    return () => clearTimeout(t);
  }, [open]);

  // Hooks MUST be declared before any conditional return, even when
  // the sheet is closed — otherwise React detects a hook-order change
  // between renders and crashes the tree.
  const queries = useMemo(() => {
    const raw = text;
    if (!raw) return [];
    const parts = raw
      .split(/[\n,;]+/)
      .map(s => s
        .replace(/^[\s\-*•◦▪▫●·●→]+/, '')
        .replace(/^\d+[.)]\s*/, '')
        .replace(/^\[[ xX]\]\s*/, '')
        .replace(/^[🎬🎞📽📺🍿✨⭐]+\s*/, '')
        .trim())
      .map(s => s.replace(/\s*[\-—–]\s*\d{4}.*$/, '').replace(/\s*\(.*?\)\s*$/, '').trim())
      .filter(s => s.length >= 2);
    const seen = new Set();
    const out = [];
    for (const q of parts) {
      const key = q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(q);
    }
    return out;
  }, [text]);

  if (!open) return null;

  const close = () => { setShow(false); setTimeout(() => onClose?.(), 220); };

  const search = async () => {
    if (queries.length === 0) return;
    setBusy(true);
    setProgress({ done: 0, total: queries.length });
    // Throttle: 5 in flight at a time.
    const results = new Array(queries.length).fill(null);
    let idx = 0;
    const worker = async () => {
      while (idx < queries.length) {
        const i = idx++;
        const q = queries[i];
        try {
          const candidates = await searchTitle(q, { limit: 4, includeTV });
          results[i] = {
            query: q,
            candidates,
            selectedIdx: 0,
            checked: candidates.length > 0,
          };
        } catch {
          results[i] = { query: q, candidates: [], selectedIdx: 0, checked: false };
        }
        setProgress(p => ({ done: p.done + 1, total: p.total }));
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
    setRows(results);
    setBusy(false);
    setStep('review');
  };

  const toggleCheck = (i) => setRows(rs => rs.map((r, j) => j === i ? { ...r, checked: !r.checked } : r));
  const setSelected = (i, k) => setRows(rs => rs.map((r, j) => j === i ? { ...r, selectedIdx: k } : r));

  const importNow = () => {
    let added = 0;
    let skipped = 0;
    for (const r of rows) {
      if (!r.checked) { skipped++; continue; }
      const c = r.candidates[r.selectedIdx];
      if (!c) { skipped++; continue; }
      // Normalise to the shape used by Watchlist (movie object with id).
      const movie = {
        id: c.id,
        title: c.title || c.name,
        name:  c.name,
        poster_path: c.poster_path,
        backdrop_path: c.backdrop_path,
        release_date: c.release_date || c.first_air_date,
        first_air_date: c.first_air_date,
        vote_average: c.vote_average,
        overview: c.overview,
        media_type: c.media_type,
      };
      if (isInWatchlist(movie.id)) { skipped++; continue; }
      if (addToWatchlist(movie)) added++;
      else skipped++;
    }
    onImported?.({ added, skipped, total: rows.length });
    close();
  };

  const matchedCount = rows.filter(r => r.checked && r.candidates.length > 0).length;

  return createPortal(
    <div onClick={close} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: show ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)',
      backdropFilter: show ? 'blur(10px)' : 'blur(0px)',
      WebkitBackdropFilter: show ? 'blur(10px)' : 'blur(0px)',
      transition: 'background 0.25s, backdrop-filter 0.25s',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560, height: '92vh',
        background: 'linear-gradient(180deg, #1a0f2e 0%, #0B0420 100%)',
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 -30px 60px rgba(0,0,0,0.6)',
        transform: show ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.32s cubic-bezier(.2,.8,.3,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 44, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.25)' }}/>
        </div>

        {/* header */}
        <div style={{
          padding: '6px 24px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: FP.text, fontFamily: '"Space Grotesk", system-ui' }}>
              {step === 'input' ? 'Importar lista' : 'Revisa y confirma'}
            </div>
            <div style={{ fontSize: 12, color: FP.textDim, marginTop: 2 }}>
              {step === 'input'
                ? 'Pega una película o serie por línea. Las buscamos por ti.'
                : `${matchedCount} ${matchedCount === 1 ? 'seleccionada' : 'seleccionadas'} de ${rows.length}.`}
            </div>
          </div>
          {step === 'review' && (
            <button onClick={() => setStep('input')} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 999, padding: '8px 14px', color: FP.textDim,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: '"Space Grotesk", system-ui',
            }}>← Editar</button>
          )}
        </div>

        {/* body */}
        <div className="no-scrollbar" style={{
          overflowY: 'auto', padding: '4px 24px 12px',
          flex: 1, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {step === 'input' && (
            <InputStep
              text={text} setText={setText}
              includeTV={includeTV} setIncludeTV={setIncludeTV}
              queries={queries} busy={busy} progress={progress}
            />
          )}
          {step === 'review' && (
            <ReviewStep
              rows={rows}
              onToggle={toggleCheck}
              onSelect={setSelected}
            />
          )}
        </div>

        {/* sticky footer */}
        <div style={{
          padding: '12px 20px 18px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(11,4,32,0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex', gap: 10,
        }}>
          {step === 'input' ? (
            <>
              <button onClick={close} disabled={busy} style={btnSecondary(busy)}>Cancelar</button>
              <button onClick={search} disabled={busy || queries.length === 0} style={btnPrimary(busy || queries.length === 0)}>
                {busy
                  ? `Buscando ${progress.done}/${progress.total}…`
                  : queries.length === 0
                    ? 'Pega tu lista'
                    : `Buscar ${queries.length}`}
              </button>
            </>
          ) : (
            <>
              <button onClick={close} style={btnSecondary(false)}>Cancelar</button>
              <button onClick={importNow} disabled={matchedCount === 0} style={btnPrimary(matchedCount === 0)}>
                Añadir {matchedCount} a mi lista
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Step 1: input ────────────────────────────────────────────────────
function InputStep({ text, setText, includeTV, setIncludeTV, queries, busy, progress }) {
  const taRef = useRef(null);
  return (
    <>
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Pega o escribe una película/serie por línea:\n\nDune Parte 2\nThe Bear\nEverything Everywhere All At Once\nLa sociedad de la nieve`}
        rows={10}
        style={{
          width: '100%', minHeight: 220,
          padding: '14px 16px', borderRadius: 16,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#fff', fontSize: 14, lineHeight: 1.55,
          fontFamily: '"Space Grotesk", system-ui',
          outline: 'none', boxSizing: 'border-box', resize: 'vertical',
        }}
      />

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 12, color: FP.textDim }}>
          {queries.length === 0
            ? 'Una entrada por línea (o separadas por coma).'
            : `${queries.length} ${queries.length === 1 ? 'título detectado' : 'títulos detectados'}.`}
        </div>
        <button
          type="button"
          onClick={() => setIncludeTV(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 999,
            background: includeTV ? 'rgba(78,255,170,0.14)' : 'rgba(255,255,255,0.06)',
            border: includeTV ? '1px solid rgba(78,255,170,0.45)' : '1px solid rgba(255,255,255,0.10)',
            color: includeTV ? '#5BFFB0' : FP.textDim,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: '"Space Grotesk", system-ui',
          }}
        >
          {includeTV ? '✓' : '○'} Incluir series
        </button>
      </div>

      {busy && (
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: 'rgba(255,107,74,0.10)',
          border: '1px solid rgba(255,107,74,0.30)',
          color: '#FFB199', fontSize: 13, fontWeight: 600,
          textAlign: 'center',
        }}>
          Buscando {progress.done}/{progress.total}…
        </div>
      )}
    </>
  );
}

// ── Step 2: review ───────────────────────────────────────────────────
function ReviewStep({ rows, onToggle, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r, i) => (
        <ResultRow key={i} idx={i} row={r} onToggle={onToggle} onSelect={onSelect} />
      ))}
    </div>
  );
}

function ResultRow({ idx, row, onToggle, onSelect }) {
  const c = row.candidates[row.selectedIdx];
  const hasMatch = !!c;
  const ambiguous = row.candidates.length > 1;
  return (
    <div style={{
      padding: 12, borderRadius: 16,
      background: hasMatch
        ? (row.checked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)')
        : 'rgba(255,59,107,0.08)',
      border: hasMatch
        ? (row.checked ? '1px solid rgba(255,107,74,0.35)' : '1px solid rgba(255,255,255,0.08)')
        : '1px solid rgba(255,59,107,0.30)',
      transition: 'background 0.15s, border-color 0.15s',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {/* Checkbox */}
        <button
          type="button"
          onClick={() => onToggle(idx)}
          disabled={!hasMatch}
          style={{
            width: 24, height: 24, flexShrink: 0,
            borderRadius: 8, cursor: hasMatch ? 'pointer' : 'default',
            background: hasMatch && row.checked
              ? 'linear-gradient(135deg, #FF6B4A, #FF3B6B)'
              : 'rgba(255,255,255,0.05)',
            border: hasMatch && row.checked
              ? 'none'
              : '1.5px solid rgba(255,255,255,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {row.checked && hasMatch && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Poster */}
        <div style={{
          width: 44, height: 64, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
          background: '#1a0f2e',
        }}>
          {c?.poster_path
            ? <img src={posterUrl(c.poster_path, 'w154')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{hasMatch ? '🎬' : '⚠'}</div>}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: FP.textMuted, marginBottom: 2, fontWeight: 600 }}>
            Tu lista: <span style={{ color: 'rgba(255,255,255,0.70)' }}>"{row.query}"</span>
          </div>
          {hasMatch ? (
            <>
              <div style={{
                fontFamily: '"Space Grotesk", system-ui',
                fontSize: 14, fontWeight: 700, color: '#fff',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{c.title || c.name}</div>
              <div style={{ fontSize: 11, color: FP.textDim, marginTop: 2 }}>
                {c.media_type === 'tv' ? 'Serie' : 'Película'}
                {(c.release_date || c.first_air_date)
                  && ` · ${(c.release_date || c.first_air_date).slice(0, 4)}`}
                {c.vote_average > 0 && ` · ★ ${c.vote_average.toFixed(1)}`}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: '#FF7A99', fontWeight: 700 }}>
              No encontrada en TMDB
            </div>
          )}
        </div>
      </div>

      {/* Alternative candidates */}
      {ambiguous && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, overflowX: 'auto' }} className="no-scrollbar">
          {row.candidates.map((alt, k) => {
            const active = k === row.selectedIdx;
            return (
              <button
                key={alt.id}
                type="button"
                onClick={() => onSelect(idx, k)}
                style={{
                  flexShrink: 0, padding: '6px 10px', borderRadius: 999,
                  background: active
                    ? 'linear-gradient(135deg, rgba(255,107,74,0.30), rgba(255,59,107,0.18))'
                    : 'rgba(255,255,255,0.05)',
                  border: active
                    ? '1px solid rgba(255,107,74,0.55)'
                    : '1px solid rgba(255,255,255,0.10)',
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: '"Space Grotesk", system-ui',
                  whiteSpace: 'nowrap',
                }}
              >
                {(alt.title || alt.name)}
                {(alt.release_date || alt.first_air_date)
                  && ` (${(alt.release_date || alt.first_air_date).slice(0, 4)})`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const btnSecondary = (disabled) => ({
  flex: 1, height: 50, borderRadius: 999,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', fontWeight: 700, fontSize: 14,
  cursor: disabled ? 'default' : 'pointer',
  fontFamily: '"Space Grotesk", system-ui',
  opacity: disabled ? 0.6 : 1,
});
const btnPrimary = (disabled) => ({
  flex: 1.4, height: 50, borderRadius: 999,
  background: disabled
    ? 'rgba(255,107,74,0.30)'
    : 'linear-gradient(135deg, #FF6B4A 0%, #FF3B6B 50%, #9B3BFF 100%)',
  border: 'none',
  color: '#fff', fontWeight: 800, fontSize: 14,
  cursor: disabled ? 'default' : 'pointer',
  fontFamily: '"Space Grotesk", system-ui',
  boxShadow: disabled ? 'none' : '0 8px 22px rgba(255,59,107,0.38)',
});

export default ImportListSheet;
