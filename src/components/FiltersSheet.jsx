import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FP } from '@/lib/fp';
import YearRangePicker from '@/components/YearRangePicker';

// Catalogues used by the sheet. Genre IDs match TMDB.
const MOVIE_GENRES = [
  { id: 28, label: 'Acción' },     { id: 12, label: 'Aventura' },
  { id: 16, label: 'Animación' },  { id: 35, label: 'Comedia' },
  { id: 80, label: 'Crimen' },     { id: 99, label: 'Documental' },
  { id: 18, label: 'Drama' },      { id: 10751, label: 'Familia' },
  { id: 14, label: 'Fantasía' },   { id: 36, label: 'Historia' },
  { id: 27, label: 'Terror' },     { id: 10402, label: 'Música' },
  { id: 9648, label: 'Misterio' }, { id: 10749, label: 'Romance' },
  { id: 878, label: 'Sci-Fi' },    { id: 53, label: 'Thriller' },
  { id: 10752, label: 'Bélica' },  { id: 37, label: 'Western' },
];
const TV_GENRES = [
  { id: 10759, label: 'Acción y aventura' }, { id: 16, label: 'Animación' },
  { id: 35, label: 'Comedia' },              { id: 80, label: 'Crimen' },
  { id: 99, label: 'Documental' },           { id: 18, label: 'Drama' },
  { id: 10751, label: 'Familia' },           { id: 10762, label: 'Kids' },
  { id: 9648, label: 'Misterio' },           { id: 10764, label: 'Reality' },
  { id: 10765, label: 'Sci-Fi & Fantasy' },  { id: 10766, label: 'Soap' },
  { id: 10767, label: 'Talk' },              { id: 10768, label: 'Bélica & Política' },
  { id: 37, label: 'Western' },
];

const LANGUAGES = [
  { code: 'es', label: 'Español' }, { code: 'en', label: 'Inglés' },
  { code: 'ko', label: 'Coreano' }, { code: 'ja', label: 'Japonés' },
  { code: 'fr', label: 'Francés' }, { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Alemán' },  { code: 'pt', label: 'Portugués' },
];

const PLATFORMS = [
  { id: 8,    label: 'Netflix' },
  { id: 119,  label: 'Prime Video' },
  { id: 1899, label: 'Max' },
  { id: 337,  label: 'Disney+' },
  { id: 350,  label: 'Apple TV+' },
  { id: 149,  label: 'Movistar Plus+' },
  { id: 63,   label: 'Filmin' },
  { id: 1773, label: 'SkyShowtime' },
];

const SORT_OPTIONS_MOVIE = [
  { id: 'popularity.desc',           label: 'Más populares' },
  { id: 'vote_average.desc',         label: 'Mejor valoradas' },
  { id: 'primary_release_date.desc', label: 'Más recientes' },
  { id: 'primary_release_date.asc',  label: 'Más antiguas' },
];
const SORT_OPTIONS_TV = [
  { id: 'popularity.desc',     label: 'Más populares' },
  { id: 'vote_average.desc',   label: 'Mejor valoradas' },
  { id: 'first_air_date.desc', label: 'Más recientes' },
  { id: 'first_air_date.asc',  label: 'Más antiguas' },
];

export const DEFAULT_FILTERS = {
  genres: [],
  yearFrom: null,
  yearTo: null,
  language: null,
  minRating: 0,
  platformId: null,
  sortBy: 'popularity.desc',
};

export function countActiveFilters(f) {
  let n = 0;
  if (f.genres?.length) n++;
  if (f.yearFrom || f.yearTo) n++;
  if (f.language) n++;
  if (f.minRating > 0) n++;
  if (f.platformId) n++;
  if (f.sortBy && f.sortBy !== 'popularity.desc') n++;
  return n;
}

const Section = ({ title, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{
      fontSize: 11, fontWeight: 800, color: FP.textDim,
      letterSpacing: 1.5, textTransform: 'uppercase',
    }}>{title}</div>
    {children}
  </div>
);

const Chip = ({ active, onClick, children, accent = 'flame' }) => (
  <button onClick={onClick} style={{
    flexShrink: 0, padding: '7px 14px', borderRadius: 999,
    fontFamily: '"Space Grotesk", system-ui',
    fontWeight: 700, fontSize: 13, cursor: 'pointer',
    transition: 'all 0.15s',
    background: active
      ? (accent === 'flame'
          ? 'linear-gradient(135deg, rgba(255,107,74,0.30), rgba(255,59,107,0.20))'
          : 'rgba(78,255,170,0.18)')
      : 'rgba(255,255,255,0.06)',
    border: active
      ? `1px solid ${accent === 'flame' ? 'rgba(255,107,74,0.55)' : 'rgba(78,255,170,0.55)'}`
      : '1px solid rgba(255,255,255,0.10)',
    color: active ? '#fff' : 'rgba(255,255,255,0.70)',
  }}>{children}</button>
);

const FiltersSheet = ({ open, onClose, tab, filters, onApply }) => {
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState(filters);
  const showPlatforms = tab !== 'cartelera';
  const genreList = tab === 'series' ? TV_GENRES : MOVIE_GENRES;
  const sortOptions = tab === 'series' ? SORT_OPTIONS_TV : SORT_OPTIONS_MOVIE;
  const thisYear = new Date().getFullYear();

  useEffect(() => { if (open) setDraft(filters); }, [open, filters]);
  useEffect(() => {
    if (open) { const t = setTimeout(() => setShow(true), 20); return () => clearTimeout(t); }
    setShow(false);
  }, [open]);

  if (!open) return null;

  const close = () => { setShow(false); setTimeout(() => onClose?.(), 220); };
  const apply = () => { onApply?.(draft); close(); };
  const clear = () => setDraft(DEFAULT_FILTERS);

  const toggleGenre = (id) => {
    setDraft(d => ({
      ...d,
      genres: d.genres.includes(id) ? d.genres.filter(g => g !== id) : [...d.genres, id],
    }));
  };

  return createPortal(
    <div onClick={close} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: show ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
      backdropFilter: show ? 'blur(8px)' : 'blur(0px)',
      WebkitBackdropFilter: show ? 'blur(8px)' : 'blur(0px)',
      transition: 'background 0.25s, backdrop-filter 0.25s',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 520, maxHeight: '88vh',
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
          padding: '6px 24px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: FP.text, fontFamily: '"Space Grotesk", system-ui' }}>
            Filtros
          </div>
          <button onClick={clear} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
            color: FP.textDim, fontSize: 12, fontWeight: 700,
            padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
          }}>Limpiar</button>
        </div>

        {/* scrollable body */}
        <div className="no-scrollbar" style={{
          overflowY: 'auto', padding: '4px 24px 16px',
          display: 'flex', flexDirection: 'column', gap: 22, flex: 1,
        }}>
          <Section title="Ordenar por">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {sortOptions.map(o => (
                <Chip key={o.id} active={draft.sortBy === o.id} onClick={() => setDraft(d => ({ ...d, sortBy: o.id }))}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Géneros">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {genreList.map(g => (
                <Chip key={g.id} active={draft.genres.includes(g.id)} onClick={() => toggleGenre(g.id)}>
                  {g.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Año de estreno">
            <YearRangePicker
              yearFrom={draft.yearFrom}
              yearTo={draft.yearTo}
              min={1980}
              max={thisYear}
              onChange={({ yearFrom, yearTo }) => setDraft(d => ({ ...d, yearFrom, yearTo }))}
            />
          </Section>

          <Section title={`Nota mínima · ${draft.minRating > 0 ? `${draft.minRating.toFixed(1)} ★` : 'Cualquiera'}`}>
            <input type="range" min="0" max="9" step="0.5" value={draft.minRating}
              onChange={(e) => setDraft(d => ({ ...d, minRating: +e.target.value }))}
              style={{ width: '100%', accentColor: '#FFD700' }}/>
          </Section>

          <Section title="Idioma original">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip active={!draft.language} onClick={() => setDraft(d => ({ ...d, language: null }))}>Todos</Chip>
              {LANGUAGES.map(l => (
                <Chip key={l.code} active={draft.language === l.code} onClick={() => setDraft(d => ({ ...d, language: l.code }))}>
                  {l.label}
                </Chip>
              ))}
            </div>
          </Section>

          {showPlatforms && (
            <Section title="Plataforma">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip active={!draft.platformId} onClick={() => setDraft(d => ({ ...d, platformId: null }))}>Todas</Chip>
                {PLATFORMS.map(p => (
                  <Chip key={p.id} active={draft.platformId === p.id} onClick={() => setDraft(d => ({ ...d, platformId: p.id }))}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </Section>
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
          <button onClick={close} style={{
            flex: 1, height: 50, borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            fontFamily: '"Space Grotesk", system-ui',
          }}>Cancelar</button>
          <button onClick={apply} style={{
            flex: 1.4, height: 50, borderRadius: 999,
            background: FP.flame, border: 'none',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            fontFamily: '"Space Grotesk", system-ui',
            boxShadow: '0 8px 22px rgba(255,59,107,0.38)',
          }}>Aplicar</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FiltersSheet;
