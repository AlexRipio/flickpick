/**
 * WrappedShareCard — VERBATIM reproduction of design_handoff_wrapped_story.
 *
 * STRICT RULES (from handoff README):
 *   1. NO rediseñar nada. CSS, layout, colores, fuentes copiados al pie de la letra.
 *   2. Solo se rellenan los textos marcados con `data-field` en el handoff.
 *   3. El bloque `.promo` (banner inferior) es estático.
 *   4. El `.header` (logo + pill) es estático.
 *   5. Avatares: solo iniciales y +N; ocultar sobrantes si la sala tiene <4.
 *   6. Poster: background-image + remover ph-icon/ph-label/ph-sub.
 *
 * Renderiza a 1080×1920 off-screen para captura PNG con html2canvas (scale 1).
 */
import React from 'react';
import { posterUrl } from '@/lib/tmdb';
import { computeRoomAnalysis, GENRE_NAMES } from '@/lib/roomAnalysis';

const CSS = `
.fp-wrapped *, .fp-wrapped *::before, .fp-wrapped *::after { box-sizing: border-box; margin: 0; padding: 0; }
.fp-wrapped {
  --bg0:#06010F; --t:#FFFFFF; --tm:rgba(255,255,255,.55); --td:rgba(255,255,255,.78); --bdr:rgba(255,255,255,.10);
  --flame-h:linear-gradient(90deg,#FFB547 0%,#FF6B4A 30%,#FF3B6B 65%,#9B3BFF 100%);
  --flame:linear-gradient(135deg,#FFB547 0%,#FF6B4A 30%,#FF3B6B 65%,#9B3BFF 100%);
  --orange:#FF6B4A; --pink:#FF3B6B; --violet:#9B3BFF; --mint:#4EFFD6; --gold:#FFB547;
}
.fp-wrapped .story{width:1080px;height:1920px;position:relative;background:var(--bg0);overflow:hidden;color:#fff;font-family:'Inter',system-ui;-webkit-font-smoothing:antialiased;}

.fp-wrapped .amb{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;}
.fp-wrapped .amb.orange{background:radial-gradient(circle,rgba(255,107,74,.45),transparent 65%);}
.fp-wrapped .amb.pink{background:radial-gradient(circle,rgba(255,59,107,.45),transparent 65%);}
.fp-wrapped .amb.violet{background:radial-gradient(circle,rgba(155,59,255,.5),transparent 65%);}
.fp-wrapped .amb.gold{background:radial-gradient(circle,rgba(255,181,71,.32),transparent 65%);}

.fp-wrapped .stage{position:absolute;inset:0;padding:160px 70px 110px;display:flex;flex-direction:column;z-index:2;}

.fp-wrapped .ig-chrome{position:absolute;top:60px;left:60px;right:60px;display:flex;gap:6px;z-index:50;pointer-events:none;}
.fp-wrapped .ig-chrome span{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.35);}
.fp-wrapped .ig-chrome span.active{background:#fff;}

.fp-wrapped .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;}
.fp-wrapped .brand-mark{display:flex;align-items:center;gap:14px;}
.fp-wrapped .brand-mark .logo-img{width:54px;height:54px;object-fit:contain;}
.fp-wrapped .brand-mark .name{font-family:'Space Grotesk';font-weight:800;font-size:38px;letter-spacing:-1.2px;}
.fp-wrapped .brand-mark .name .pink{color:var(--pink);}
.fp-wrapped .live-pill{display:inline-flex;align-items:center;gap:12px;padding:12px 22px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);}
.fp-wrapped .live-pill .dot{width:12px;height:12px;border-radius:50%;background:var(--mint);box-shadow:0 0 16px var(--mint);}
.fp-wrapped .live-pill span{font-family:'JetBrains Mono';font-size:18px;font-weight:600;letter-spacing:2px;}

.fp-wrapped .kicker{font-family:'JetBrains Mono';font-size:22px;letter-spacing:6px;text-transform:uppercase;background:var(--flame-h);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:700;margin-top:18px;margin-bottom:12px;}
.fp-wrapped .title{font-family:'Space Grotesk';font-size:96px;font-weight:800;line-height:.9;letter-spacing:-4px;margin-bottom:8px;}
.fp-wrapped .title .l1{color:var(--t);}
.fp-wrapped .title .l2{background:linear-gradient(90deg,#FFB547,#FF6B4A,#FF3B6B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.fp-wrapped .subtitle{font-size:24px;color:var(--td);font-weight:500;margin-bottom:24px;}
.fp-wrapped .subtitle b{color:var(--t);font-weight:700;}

.fp-wrapped .hero{display:flex;gap:30px;margin-bottom:24px;align-items:stretch;}
.fp-wrapped .poster{
  width:340px;flex-shrink:0;border-radius:20px;
  background:repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0 12px,rgba(255,255,255,.09) 12px 24px),linear-gradient(135deg,#2a1238,#0f0420);
  border:1.5px dashed rgba(255,255,255,.28);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  position:relative;box-shadow:0 30px 60px rgba(0,0,0,.5);
  min-height:480px;
}
.fp-wrapped .poster.has-image{border:none;background-color:#0f0420;background-size:cover;background-position:center;}
.fp-wrapped .poster .ph-icon{font-family:'Space Grotesk';font-weight:800;font-size:80px;color:rgba(255,255,255,.18);margin-bottom:14px;}
.fp-wrapped .poster .ph-label{font-family:'JetBrains Mono';font-size:18px;letter-spacing:3px;color:rgba(255,255,255,.5);text-transform:uppercase;}
.fp-wrapped .poster .ph-sub{font-family:'JetBrains Mono';font-size:13px;color:rgba(255,255,255,.32);margin-top:10px;letter-spacing:2px;text-align:center;padding:0 14px;}
.fp-wrapped .poster .corner{position:absolute;top:18px;left:18px;padding:8px 14px;border-radius:8px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.18);font-family:'JetBrains Mono';font-size:14px;letter-spacing:2px;font-weight:700;display:flex;align-items:center;gap:8px;}
.fp-wrapped .poster .corner .star{color:var(--gold);}

.fp-wrapped .hero-info{flex:1;display:flex;flex-direction:column;justify-content:space-between;}
.fp-wrapped .match-circle{
  width:240px;height:240px;border-radius:50%;background:var(--flame);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  box-shadow:0 20px 50px rgba(255,107,74,.45),inset 0 0 0 5px rgba(255,255,255,.18);
  align-self:flex-end;transform:rotate(6deg);
}
.fp-wrapped .match-circle .pct{font-family:'Space Grotesk';font-weight:800;font-size:72px;line-height:1;color:#fff;letter-spacing:-2px;}
.fp-wrapped .match-circle .lbl{font-family:'JetBrains Mono';font-size:14px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.95);margin-top:4px;}

.fp-wrapped .film-name{font-family:'Space Grotesk';font-weight:800;font-size:40px;line-height:1;letter-spacing:-1.5px;color:var(--t);}
.fp-wrapped .film-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;}
.fp-wrapped .film-meta .chip{padding:8px 14px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid var(--bdr);font-family:'JetBrains Mono';font-size:16px;font-weight:600;color:var(--td);letter-spacing:1px;}

.fp-wrapped .crew-strip{display:flex;align-items:center;gap:18px;padding:20px 26px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid var(--bdr);margin-bottom:24px;}
.fp-wrapped .crew-strip .label{font-family:'JetBrains Mono';font-size:14px;letter-spacing:3px;text-transform:uppercase;color:var(--tm);}
.fp-wrapped .crew-strip .avatars{display:flex;margin-left:6px;}
.fp-wrapped .crew-strip .av{width:60px;height:60px;border-radius:50%;border:3px solid var(--bg0);display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk';font-weight:800;font-size:22px;color:#fff;margin-left:-14px;overflow:hidden;}
.fp-wrapped .crew-strip .av img{width:100%;height:100%;object-fit:cover;display:block;}
.fp-wrapped .crew-strip .av:first-child{margin-left:0;}
.fp-wrapped .crew-strip .av.a1{background:linear-gradient(135deg,#FFB547,#FF6B4A);}
.fp-wrapped .crew-strip .av.a2{background:linear-gradient(135deg,#FF3B6B,#9B3BFF);}
.fp-wrapped .crew-strip .av.a3{background:linear-gradient(135deg,#9B3BFF,#4EFFD6);}
.fp-wrapped .crew-strip .av.a4{background:linear-gradient(135deg,#4EFFD6,#FFB547);}
.fp-wrapped .crew-strip .av.more{background:rgba(255,255,255,.08);font-size:18px;color:var(--t);}
.fp-wrapped .crew-strip .room{margin-left:auto;text-align:right;}
.fp-wrapped .crew-strip .room .nm{font-family:'Space Grotesk';font-weight:700;font-size:24px;}
.fp-wrapped .crew-strip .room .nm .h{color:var(--tm);}
.fp-wrapped .crew-strip .room .when{font-family:'JetBrains Mono';font-size:13px;color:var(--tm);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;}

.fp-wrapped .stats{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px;}
.fp-wrapped .stat{padding:24px 26px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid var(--bdr);position:relative;}
.fp-wrapped .stat .corner{position:absolute;top:18px;right:22px;font-family:'JetBrains Mono';font-size:18px;color:var(--tm);}
.fp-wrapped .stat .num{font-family:'Space Grotesk';font-weight:800;font-size:64px;line-height:.9;letter-spacing:-2px;margin-bottom:8px;}
.fp-wrapped .stat .num.orange{color:var(--orange);}
.fp-wrapped .stat .num.pink{color:var(--pink);}
.fp-wrapped .stat .num.violet{color:var(--violet);}
.fp-wrapped .stat .num.mint{color:var(--mint);}
.fp-wrapped .stat .lbl{font-family:'JetBrains Mono';font-size:14px;letter-spacing:2px;text-transform:uppercase;color:var(--td);font-weight:600;}
.fp-wrapped .stat .sub{font-size:14px;color:var(--tm);margin-top:4px;}

.fp-wrapped .mvp-card{display:flex;align-items:center;gap:22px;padding:22px 26px;border-radius:20px;background:linear-gradient(135deg,rgba(255,107,74,.18),rgba(155,59,255,.14));border:1.5px solid rgba(255,107,74,.35);position:relative;margin-bottom:28px;}
.fp-wrapped .mvp-card .badge{position:absolute;top:-12px;left:24px;padding:5px 12px;border-radius:7px;background:var(--flame);font-family:'JetBrains Mono';font-size:12px;letter-spacing:2px;font-weight:700;}
.fp-wrapped .mvp-card .av{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#FFB547,#FF6B4A);display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk';font-weight:800;font-size:28px;color:#fff;border:2px solid rgba(255,255,255,.2);flex-shrink:0;overflow:hidden;}
.fp-wrapped .mvp-card .av img{width:100%;height:100%;object-fit:cover;display:block;}
.fp-wrapped .mvp-card .info .nm{font-family:'Space Grotesk';font-weight:700;font-size:28px;}
.fp-wrapped .mvp-card .info .role{font-family:'JetBrains Mono';font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--tm);margin-top:2px;}
.fp-wrapped .mvp-card .stat-r{margin-left:auto;text-align:right;}
.fp-wrapped .mvp-card .stat-r .v{font-family:'Space Grotesk';font-weight:800;font-size:42px;line-height:1;background:var(--flame-h);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.fp-wrapped .mvp-card .stat-r .l{font-family:'JetBrains Mono';font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--tm);margin-top:2px;}

.fp-wrapped .promo{
  margin-top:auto;border-radius:24px;
  background:linear-gradient(135deg,rgba(255,181,71,.18) 0%,rgba(255,59,107,.22) 50%,rgba(155,59,255,.22) 100%);
  border:1.5px solid rgba(255,255,255,.18);
  padding:26px 30px;display:flex;align-items:center;gap:24px;
  position:relative;overflow:hidden;
  box-shadow:0 20px 60px rgba(255,107,74,.18),inset 0 1px 0 rgba(255,255,255,.12);
}
.fp-wrapped .promo::before{
  content:"";position:absolute;inset:0;
  background:radial-gradient(circle at 0% 50%,rgba(255,107,74,.25),transparent 50%),radial-gradient(circle at 100% 50%,rgba(155,59,255,.25),transparent 50%);
  pointer-events:none;
}
.fp-wrapped .promo .logo-wrap{
  width:100px;height:100px;flex-shrink:0;
  border-radius:22px;background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.18);
  display:flex;align-items:center;justify-content:center;
  position:relative;z-index:2;
  box-shadow:0 8px 24px rgba(0,0,0,.3);
}
.fp-wrapped .promo .logo-wrap img{width:78px;height:78px;object-fit:contain;}
.fp-wrapped .promo .promo-text{flex:1;position:relative;z-index:2;}
.fp-wrapped .promo .promo-eyebrow{font-family:'JetBrains Mono';font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.7);font-weight:600;margin-bottom:4px;}
.fp-wrapped .promo .promo-title{font-family:'Space Grotesk';font-weight:800;font-size:32px;letter-spacing:-1px;line-height:1.05;color:#fff;}
.fp-wrapped .promo .promo-title .grad{background:var(--flame-h);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.fp-wrapped .promo .promo-sub{font-family:'Inter';font-size:16px;color:rgba(255,255,255,.78);margin-top:6px;font-weight:500;}
.fp-wrapped .promo .cta{
  flex-shrink:0;position:relative;z-index:2;
  padding:18px 26px;border-radius:14px;
  background:#fff;color:#0a0118;
  font-family:'Space Grotesk';font-weight:800;font-size:20px;letter-spacing:-.3px;
  display:flex;align-items:center;gap:8px;
  box-shadow:0 12px 30px rgba(0,0,0,.3);
}
.fp-wrapped .promo .cta .arrow{font-size:22px;}
`;

// ── Helpers ─────────────────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, '0'); }
function mmss(ms) {
  if (!ms || ms < 0) return '00:00';
  const total = Math.round(ms / 1000);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}
function formatRuntime(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${pad2(m)}m` : `${m}m`;
}
function initial(name) {
  return ((name || '?')[0] || '?').toUpperCase();
}

// ── Component ───────────────────────────────────────────────────────────────
const WrappedShareCard = React.forwardRef(function WrappedShareCard({ room }, ref) {
  const analysis = room ? computeRoomAnalysis(room) : null;
  if (!analysis) return null;

  const { compatibilityPct, totalMatches, memberStats, topGenres, bestMatch } = analysis;

  // ── Data fields ──
  const allMembers = room?.members || memberStats.map(s => s.member);
  const totalSwipes = memberStats.reduce((s, m) => s + (m.totalVotes || 0), 0);
  const totalLikes  = memberStats.reduce((s, m) => s + (m.likes || 0), 0);
  const totalSkips  = memberStats.reduce((s, m) => s + (m.skips || 0), 0);
  const accuracy    = totalSwipes > 0 ? Math.round((totalLikes / totalSwipes) * 100) : 0;

  const lastMatchAt = (room?.matches || []).reduce((mx, m) => Math.max(mx, m.matchedAt || 0), 0);
  const decisionMs  = room?.createdAt ? (lastMatchAt || Date.now()) - room.createdAt : 0;
  const tiempo_total = mmss(decisionMs);
  const stat_decision = totalSwipes > 0 && decisionMs > 0
    ? `${(decisionMs / totalSwipes / 1000).toFixed(1)}s`
    : '0s';

  // MVP = más decisivo (más right-swipes)
  const mvpStat = [...memberStats].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0] || memberStats[0];
  const mvp_name = mvpStat?.member?.name || '—';
  const mvp_initial = initial(mvp_name);
  const mvp_right_swipes = mvpStat?.likes || 0;
  const mvp_sync = Math.round((mvpStat?.likeRate || 0) * 100);

  // Crew avatars (4 visibles + N extra) — Regla 5: ocultar si no hay
  const crew = allMembers.slice(0, 4);
  const num_extra = Math.max(0, allMembers.length - 4);

  // Film
  const film_title = bestMatch?.title || bestMatch?.name || 'Sin película';
  const film_year  = (bestMatch?.release_date || bestMatch?.first_air_date || '').slice(0, 4) || '—';
  const film_duration = formatRuntime(bestMatch?.runtime);
  const film_rating = bestMatch?.vote_average ? bestMatch.vote_average.toFixed(1) : '—';
  const film_genre = topGenres?.[0]?.name || (bestMatch?.genre_ids?.[0] && GENRE_NAMES[bestMatch.genre_ids[0]]) || '—';
  const poster_url = bestMatch?.poster_path ? posterUrl(bestMatch.poster_path, 'w780') : null;

  // Room / fecha
  const room_name = (room?.name || 'SalaSinNombre').replace(/\s+/g, '');
  const dateObj = new Date(room?.createdAt || Date.now());
  const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const fecha = `${pad2(dateObj.getDate())} ${months[dateObj.getMonth()]}`;
  const hora  = `${pad2(dateObj.getHours())}:${pad2(dateObj.getMinutes())}`;

  // Vetos: usados = total skips; disponibles = total swipes (proxy)
  const stat_vetos = totalSkips;
  const vetos_disponibles = totalSwipes;

  // Subtitle persona/personas
  const num_personas = allMembers.length;

  // Poster style — Regla 6
  const posterStyle = poster_url
    ? { background: `url('${poster_url}') center/cover no-repeat`, border: 'none' }
    : null;

  return (
    <div
      ref={ref}
      className="fp-wrapped"
      style={{
        position: 'fixed', top: 0, left: '-12000px',
        zIndex: -1, pointerEvents: 'none',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="story">
        <div className="amb orange" style={{ width: 600, height: 600, top: -180, left: -150 }} />
        <div className="amb pink"   style={{ width: 600, height: 600, top: '30%', right: -200 }} />
        <div className="amb violet" style={{ width: 700, height: 700, bottom: -200, left: -100 }} />
        <div className="amb gold"   style={{ width: 400, height: 400, top: '18%', left: '30%', opacity: 0.5 }} />

        <div className="ig-chrome"><span className="active" /></div>

        <div className="stage">

          {/* HEADER — estático (Regla 4) */}
          <div className="header">
            <div className="brand-mark">
              <img className="logo-img" src="/flickpick-mark.webp" alt="FlickPick" crossOrigin="anonymous" />
              <div className="name">Flick<span className="pink">Pick</span></div>
            </div>
            <div className="live-pill">
              <span className="dot" />
              <span>SALA TERMINADA</span>
            </div>
          </div>

          {/* KICKER + TITLE */}
          <div className="kicker">// MATCH WRAPPED</div>
          <div className="title">
            <div className="l1">Esta noche</div>
            <div className="l2">vemos…</div>
          </div>
          <div className="subtitle">
            Decidido en <b>{tiempo_total}</b> · entre <b>{num_personas}</b> {num_personas === 1 ? 'persona' : 'personas'}
          </div>

          {/* HERO */}
          <div className="hero">
            <div className={`poster${poster_url ? ' has-image' : ''}`} style={posterStyle || undefined}>
              <div className="corner"><span className="star">★</span> WINNER</div>
              {!poster_url && (
                <>
                  <div className="ph-icon">▶</div>
                  <div className="ph-label">POSTER</div>
                  <div className="ph-sub">Sin imagen disponible</div>
                </>
              )}
            </div>
            <div className="hero-info">
              <div className="match-circle">
                <div className="pct"><span>{compatibilityPct}</span>%</div>
                <div className="lbl">MATCH</div>
              </div>
              <div>
                <div className="film-name">{film_title}</div>
                <div className="film-meta">
                  <span className="chip">{film_year}</span>
                  <span className="chip">{film_duration}</span>
                  <span className="chip">★ <span>{film_rating}</span></span>
                  <span className="chip">{film_genre}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CREW STRIP */}
          <div className="crew-strip">
            <div className="label">CREW</div>
            <div className="avatars">
              {[1, 2, 3, 4].map(i => {
                const m = crew[i - 1];
                if (!m) return <div key={i} className={`av a${i}`} style={{ display: 'none' }} />;
                return (
                  <div key={i} className={`av a${i}`}>
                    {m.avatarUrl
                      ? <img src={m.avatarUrl} alt="" crossOrigin="anonymous" />
                      : initial(m.name)}
                  </div>
                );
              })}
              <div className="av more" style={num_extra > 0 ? undefined : { display: 'none' }}>
                +<span>{num_extra}</span>
              </div>
            </div>
            <div className="room">
              <div className="nm"><span className="h">#</span><span>{room_name}</span></div>
              <div className="when"><span>{fecha}</span> · <span>{hora}</span></div>
            </div>
          </div>

          {/* STATS 2x2 */}
          <div className="stats">
            <div className="stat">
              <div className="corner">↗</div>
              <div className="num orange">{totalSwipes}</div>
              <div className="lbl">SWIPES</div>
              <div className="sub">en <span>{tiempo_total}</span></div>
            </div>
            <div className="stat">
              <div className="corner">♥</div>
              <div className="num pink">{totalMatches}</div>
              <div className="lbl">MATCHES</div>
              <div className="sub"><span>{accuracy}</span>% acierto</div>
            </div>
            <div className="stat">
              <div className="corner">⚡</div>
              <div className="num mint">{stat_decision}</div>
              <div className="lbl">DECISIÓN MEDIA</div>
              <div className="sub">por película</div>
            </div>
            <div className="stat">
              <div className="corner">✕</div>
              <div className="num violet">{stat_vetos}</div>
              <div className="lbl">VETOS USADOS</div>
              <div className="sub">de <span>{vetos_disponibles}</span> disponibles</div>
            </div>
          </div>

          {/* MVP */}
          <div className="mvp-card">
            <div className="badge">★ MVP</div>
            <div className="av">
              {mvpStat?.member?.avatarUrl
                ? <img src={mvpStat.member.avatarUrl} alt="" crossOrigin="anonymous" />
                : mvp_initial}
            </div>
            <div className="info">
              <div className="nm">{mvp_name}</div>
              <div className="role">EL DECISIVO · <span>{mvp_right_swipes}</span> SWIPES ▶</div>
            </div>
            <div className="stat-r">
              <div className="v"><span>{mvp_sync}</span>%</div>
              <div className="l">SINTONÍA</div>
            </div>
          </div>

          {/* PROMO BANNER — estático, NO modificar (Regla 3) */}
          <div className="promo">
            <div className="logo-wrap">
              <img src="/flickpick-mark.webp" alt="FlickPick" crossOrigin="anonymous" />
            </div>
            <div className="promo-text">
              <div className="promo-eyebrow">// HECHO CON</div>
              <div className="promo-title">Decide qué ver <span className="grad">en 5 minutos</span></div>
              <div className="promo-sub">Swipe · Match · Watch together — pruébalo gratis</div>
            </div>
            <div className="cta">flickpick.app <span className="arrow">→</span></div>
          </div>

        </div>
      </div>
    </div>
  );
});

export default WrappedShareCard;
