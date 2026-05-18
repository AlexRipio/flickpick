import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';

/**
 * Landing pública de FlickPick — recreada como ruta interna (/marca).
 * Todo el CSS va inline en un <style> con prefijo .fpl- para que no
 * colisione con el resto de la app. Se replican las animaciones,
 * tokens y comportamientos descritos en el README de handoff.
 */
const LandingPage = () => {
  const navigate = useNavigate();
  const phoneRef = useRef(null);
  const stageRef = useRef(null);
  const navRef = useRef(null);
  const tvQRef = useRef(null);
  const manifestoRef = useRef(null);
  const manifestoTextRef = useRef(null);
  const particlesRef = useRef(null);
  const cursorDotRef = useRef(null);
  const cursorRingRef = useRef(null);

  // ── Custom cursor (desktop only) ─────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(hover: none)').matches) return;
    const dot = cursorDotRef.current;
    const ring = cursorRingRef.current;
    if (!dot || !ring) return;
    let cx = 0, cy = 0, dx = 0, dy = 0;
    const onMove = (e) => { cx = e.clientX; cy = e.clientY; dot.style.left = cx + 'px'; dot.style.top = cy + 'px'; };
    window.addEventListener('mousemove', onMove);
    let raf;
    const tick = () => { dx += (cx - dx) * 0.18; dy += (cy - dy) * 0.18; ring.style.left = dx + 'px'; ring.style.top = dy + 'px'; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);

    const onEnter = () => { ring.style.transform = 'translate(-50%,-50%) scale(1.6)'; };
    const onLeave = () => { ring.style.transform = 'translate(-50%,-50%) scale(1)'; };
    const targets = document.querySelectorAll('.fpl-root a, .fpl-root button, .fpl-root .fpl-v-card, .fpl-root .fpl-counter, .fpl-root .fpl-swipe-card');
    targets.forEach(el => { el.addEventListener('mouseenter', onEnter); el.addEventListener('mouseleave', onLeave); });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
      targets.forEach(el => { el.removeEventListener('mouseenter', onEnter); el.removeEventListener('mouseleave', onLeave); });
    };
  }, []);

  // ── Nav scrolled state ───────────────────────────────────────────────
  // The landing scrolls *inside* the .fpl-root container (it's fixed +
  // overflow:auto so it can sit on top of the SPA), so window scroll
  // never fires. We listen on the container instead.
  useEffect(() => {
    const root = document.querySelector('.fpl-root');
    if (!root) return;
    const onScroll = () => {
      if (!navRef.current) return;
      navRef.current.classList.toggle('fpl-scr', root.scrollTop > 40);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, []);

  // ── Phone 3D tilt ────────────────────────────────────────────────────
  useEffect(() => {
    const stage = stageRef.current;
    const phone = phoneRef.current;
    if (!stage || !phone) return;
    const onMove = (e) => {
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      phone.style.transform = `rotateY(${-8 + px * 16}deg) rotateX(${4 - py * 12}deg)`;
    };
    const onLeave = () => { phone.style.transform = 'rotateY(-8deg) rotateX(4deg)'; };
    stage.addEventListener('mousemove', onMove);
    stage.addEventListener('mouseleave', onLeave);
    return () => { stage.removeEventListener('mousemove', onMove); stage.removeEventListener('mouseleave', onLeave); };
  }, []);

  // ── Manifesto word reveal (build words + scroll-driven highlight) ────
  useEffect(() => {
    const manifestoCopy = "Cada noche, millones de salones se quedan a oscuras discutiendo. El mando se convierte en arma, los gustos en frontera, la velada en un trámite. Nosotros creemos otra cosa: que [[elegir juntos]] debería ser el mejor momento. Por eso construimos FlickPick. Para que [[la pantalla]] vuelva a ser un punto de encuentro, no de batalla.";
    const el = manifestoTextRef.current;
    if (!el) return;
    el.innerHTML = '';
    const segments = [];
    let rest = manifestoCopy;
    const re = /\[\[(.+?)\]\]/;
    let m;
    while ((m = rest.match(re))) {
      if (m.index > 0) segments.push({ text: rest.slice(0, m.index), flame: false });
      segments.push({ text: m[1], flame: true });
      rest = rest.slice(m.index + m[0].length);
    }
    if (rest) segments.push({ text: rest, flame: false });
    segments.forEach(seg => {
      const words = seg.text.trim().split(/\s+/).filter(Boolean);
      words.forEach(w => {
        const sp = document.createElement('span');
        sp.className = 'fpl-word' + (seg.flame ? ' fpl-flame-w' : '');
        sp.textContent = w;
        el.appendChild(sp);
        el.appendChild(document.createTextNode(' '));
      });
    });

    const words = el.querySelectorAll('.fpl-word');
    // getBoundingClientRect is relative to the visual viewport, but our
    // landing scrolls inside the fixed .fpl-root container — same effect
    // since the container fills the viewport. The fix is to listen on
    // the container's scroll event (window scroll never fires here).
    const root = document.querySelector('.fpl-root');
    const onScroll = () => {
      const sec = manifestoRef.current;
      if (!sec || !root) return;
      const r = sec.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height + vh * 0.3;
      const passed = Math.max(0, Math.min(1, (vh * 0.6 - r.top) / total));
      const target = Math.floor(passed * words.length * 1.2);
      words.forEach((w, i) => { if (i < target) w.classList.add('fpl-lit'); else w.classList.remove('fpl-lit'); });
    };
    onScroll();
    if (root) root.addEventListener('scroll', onScroll, { passive: true });
    return () => { if (root) root.removeEventListener('scroll', onScroll); };
  }, []);

  // ── Reveal observer ──────────────────────────────────────────────────
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('fpl-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    document.querySelectorAll('.fpl-root .fpl-reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  // ── Counters ─────────────────────────────────────────────────────────
  useEffect(() => {
    const counters = document.querySelectorAll('.fpl-root .fpl-counter .fpl-n');
    const cIo = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const target = +el.dataset.count;
        const suffixHTML = el.querySelector('span') ? el.querySelector('span').outerHTML : '';
        const dur = 1800;
        const start = performance.now();
        const step = (now) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          const n = Math.round(target * eased);
          el.innerHTML = n + suffixHTML;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        cIo.unobserve(el);
      });
    }, { threshold: 0.5 });
    counters.forEach(c => cIo.observe(c));
    return () => cIo.disconnect();
  }, []);

  // ── TV question rotator ──────────────────────────────────────────────
  useEffect(() => {
    const qs = ['¿Qué vemos?', '¿Otra vez Netflix?', '¿Y comedia?', '¿Tú decides?', '¿Algo nuevo?'];
    let qi = 0;
    const tvQ = tvQRef.current;
    if (!tvQ) return;
    const interval = setInterval(() => {
      qi = (qi + 1) % qs.length;
      tvQ.style.opacity = 0;
      setTimeout(() => { tvQ.textContent = qs[qi]; tvQ.style.opacity = 1; }, 200);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  // ── Flame particles ──────────────────────────────────────────────────
  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#FFB547', '#FF6B4A', '#FF3B6B', '#9B3BFF'];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('div');
      p.className = 'fpl-p';
      p.style.left = (40 + Math.random() * 20) + '%';
      p.style.bottom = (10 + Math.random() * 30) + '%';
      const c = colors[Math.floor(Math.random() * colors.length)];
      p.style.color = c;
      p.style.background = c;
      const size = (4 + Math.random() * 8);
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.setProperty('--x', (Math.random() * 200 - 100) + 'px');
      p.style.animationDuration = (2 + Math.random() * 4) + 's';
      p.style.animationDelay = (Math.random() * 4) + 's';
      container.appendChild(p);
    }
  }, []);

  return (
    <div className="fpl-root">
      <Helmet>
        <title>FlickPick — Fin a la guerra del mando</title>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
      </Helmet>

      <style>{LANDING_CSS}</style>

      {/* CURSOR */}
      <div className="fpl-cur" ref={cursorDotRef}/>
      <div className="fpl-cur-d" ref={cursorRingRef}/>

      {/* NAV */}
      <nav className="fpl-nav" ref={navRef}>
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/home'); }} className="fpl-nav-logo">
          <img src="/Favicon.webp" alt=""/>
          <span className="fpl-nav-name">FlickPick</span>
        </a>
        <ul>
          <li><a href="#manifiesto">Manifiesto</a></li>
          <li><a href="#mision">Misión</a></li>
          <li><a href="#vision">Visión</a></li>
          <li><a href="#valores">Valores</a></li>
        </ul>
        <a href="https://flickpick.mov" className="fpl-nav-cta">Pruébalo ya</a>
      </nav>

      {/* HERO */}
      <section className="fpl-hero">
        <div className="fpl-grid-bg"/>
        <div className="fpl-hero-orb a"/>
        <div className="fpl-hero-orb b"/>
        <div className="fpl-hero-orb c"/>

        <div className="fpl-hero-grid">
          <div>
            <div className="fpl-hero-eyebrow"><span className="fpl-dot"/><span>Disponible ya · 2026</span></div>
            <h1 className="fpl-disp">
              <span className="fpl-ln"><span>Fin a la</span></span>
              <span className="fpl-ln"><span className="fpl-grad-anim">guerra del</span></span>
              <span className="fpl-ln"><span>mando.</span></span>
            </h1>
            <p className="fpl-hero-sub">FlickPick convierte el "¿qué vemos?" en un juego social, rápido y visual. Deslizas. Coincides. Veis juntos. Sin discusiones.</p>
            <div className="fpl-hero-actions">
              <a href="https://flickpick.mov" className="fpl-btn-primary">Pruébalo ya
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </a>
              <a href="#manifiesto" className="fpl-btn-ghost">
                <span className="fpl-play-i"><svg width="9" height="10" viewBox="0 0 9 10" fill="#fff"><path d="M0 0v10l9-5z"/></svg></span>
                Ver el manifiesto
              </a>
            </div>
            <div className="fpl-hero-meta">
              <div className="fpl-col"><div className="fpl-k fpl-grad">3.2s</div><div className="fpl-l">Por match</div></div>
              <div className="fpl-col"><div className="fpl-k fpl-grad">12k+</div><div className="fpl-l">Pelis y series</div></div>
              <div className="fpl-col"><div className="fpl-k fpl-grad">0</div><div className="fpl-l">Discusiones</div></div>
            </div>
          </div>

          <div className="fpl-hero-stage" ref={stageRef}>
            <div className="fpl-flame-bloom"/>
            <div className="fpl-phone-3d" ref={phoneRef}>
              <div className="fpl-swipe-stack">
                <SwipeCard cls="s4" pcls="poster-4" badge="98% MATCH" title="Neon Saints" genre="Sci-Fi" meta="2024 · 2h 04m"/>
                <SwipeCard cls="s3" pcls="poster-3" badge="87% MATCH" title="Cierra los ojos" genre="Drama" meta="2023 · 1h 58m"/>
                <SwipeCard cls="s2" pcls="poster-2" badge="92% MATCH" title="Last Night Out" genre="Comedy" meta="2025 · 1h 42m"/>
                <SwipeCard cls="s1" pcls="poster-1" badge="95% MATCH" title="Volcán Azul" genre="Thriller" meta="2024 · 2h 11m"/>
                <div className="fpl-match-popup">¡MATCH!</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="fpl-marquee">
        <div className="fpl-marquee-track">
          <MarqueeContent/>
          <MarqueeContent/>
        </div>
      </div>

      {/* MANIFESTO */}
      <section className="fpl-manifesto" id="manifiesto" ref={manifestoRef}>
        <div className="fpl-manifesto-inner">
          <div className="fpl-manifesto-eyebrow"><span className="fpl-eb-ln"/><span>Manifiesto</span></div>
          <h2 className="fpl-disp" ref={manifestoTextRef}/>
        </div>
      </section>

      {/* MISSION */}
      <section className="fpl-mission" id="mision">
        <div className="fpl-mission-grid">
          <div className="fpl-reveal">
            <div className="fpl-label fpl-orange">// Nuestra misión</div>
            <h2 className="fpl-disp">Eliminar la fricción de elegir.</h2>
            <p>Cada noche, millones de personas pierden su tiempo discutiendo qué ver. La tele encendida, el menú abierto, nadie decide. La velada se apaga antes de empezar.</p>
            <p>FlickPick convierte esos minutos perdidos en anticipación. Deslizas con tu pareja, amigos o familia. Cuando coincidís, el match aparece. La peli empieza.</p>
            <div className="fpl-stats">
              <div className="fpl-stat"><div className="fpl-n2">28 min</div><div className="fpl-l">Tiempo medio decidiendo</div></div>
              <div className="fpl-stat"><div className="fpl-n2">3.2 s</div><div className="fpl-l">Con FlickPick</div></div>
            </div>
          </div>

          <div className="fpl-scene fpl-reveal">
            <div className="fpl-tv">
              <div className="fpl-tv-glow"/>
              <div className="fpl-tv-content">
                <div className="fpl-tv-question" ref={tvQRef}>¿Qué vemos?</div>
              </div>
            </div>
            <div className="fpl-remote r1"/>
            <div className="fpl-remote r2"/>
            <div className="fpl-spark sp1"/>
            <div className="fpl-spark sp2"/>
            <div className="fpl-spark sp3"/>
            <div className="fpl-couch"/>
          </div>
        </div>
      </section>

      {/* VISION */}
      <section className="fpl-vision" id="vision">
        <div className="fpl-vision-orb x"/>
        <div className="fpl-vision-orb y"/>
        <div className="fpl-vision-inner">
          <div className="fpl-label fpl-violet fpl-reveal">// Nuestra visión</div>
          <h2 className="fpl-disp fpl-reveal">Ser <span className="fpl-grad-anim">la forma estándar</span> en que el mundo decide qué ver junto.</h2>
          <p className="fpl-reveal">Imagina una noche en cualquier salón del planeta. Antes de FlickPick: 28 minutos de discusión. Después de FlickPick: el primer match en segundos. La pantalla que todos merecen, sin la pelea.</p>

          <div className="fpl-counters">
            <div className="fpl-counter fpl-reveal">
              <div className="fpl-n" data-count="195">0</div>
              <div className="fpl-l">Países objetivo 2030</div>
              <div className="fpl-d">De Madrid a Manila, una sola forma de elegir.</div>
            </div>
            <div className="fpl-counter fpl-reveal">
              <div className="fpl-n" data-count="500">0<span style={{ fontSize: 48 }}>M</span></div>
              <div className="fpl-l">Personas conectadas</div>
              <div className="fpl-d">Parejas, grupos, familias. Watch parties globales.</div>
            </div>
            <div className="fpl-counter fpl-reveal">
              <div className="fpl-n" data-count="0">0<span style={{ fontSize: 48 }}>%</span></div>
              <div className="fpl-l">Discusiones</div>
              <div className="fpl-d">El mando deja de ser un campo de batalla.</div>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="fpl-values" id="valores">
        <div className="fpl-values-inner">
          <div className="fpl-values-head">
            <div className="fpl-reveal">
              <div className="fpl-label fpl-cyan">// Lo que nos mueve</div>
              <h2 className="fpl-disp">Tres valores.<br/>Cero excusas.</h2>
            </div>
            <p className="fpl-lead fpl-reveal">No somos un algoritmo frío. Somos la noche de cine que tu casa se merece. Esto es lo que nunca negociamos.</p>
          </div>

          <div className="fpl-value-grid">
            <div className="fpl-v-card fpl-v-1 fpl-reveal">
              <div className="fpl-glow"/>
              <div className="fpl-num">01 / DIVERSIÓN</div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="fpl-icon">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#FFB547"/></svg>
                </div>
                <h3>Diversión</h3>
                <p>Elegir peli debe sentirse como abrir un regalo, no como rellenar un formulario. Cada swipe es un pequeño chispazo. Los matches, una pequeña fiesta. Si no hace sonreír, no entra en la app.</p>
              </div>
            </div>
            <div className="fpl-v-card fpl-v-2 fpl-reveal">
              <div className="fpl-glow"/>
              <div className="fpl-num">02 / HONESTIDAD</div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="fpl-icon">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 8v6c0 5 4 9 10 10 6-1 10-5 10-10V8l-10-6z" stroke="#FF3B6B" strokeWidth="2" fill="rgba(255,59,107,.15)"/>
                    <path d="m9 12 2 2 4-4" stroke="#FF3B6B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>Honestidad</h3>
                <p>Sin trucos publicitarios disfrazados de recomendación. Tus gustos son tuyos, tu data es tuya. Te decimos qué hay y dónde verlo, no qué nos pagan por enseñarte.</p>
              </div>
            </div>
            <div className="fpl-v-card fpl-v-3 fpl-reveal">
              <div className="fpl-glow"/>
              <div className="fpl-num">03 / INCLUSIÓN</div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="fpl-icon">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                    <circle cx="9" cy="8" r="3.5" stroke="#9B3BFF" strokeWidth="2"/>
                    <circle cx="17" cy="10" r="2.5" stroke="#9B3BFF" strokeWidth="2"/>
                    <path d="M3 20c0-3 3-5 6-5s6 2 6 5" stroke="#9B3BFF" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M15 19c0-2 2-3.5 4-3.5s3 1 3 2.5" stroke="#9B3BFF" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3>Inclusión</h3>
                <p>Cine de todos lados, en todos los idiomas, para todos los grupos. Parejas, familias, pisos compartidos, amistades a distancia. La pantalla que todos merecen, sin filtros que excluyan.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="fpl-cta" id="descargar">
        <div className="fpl-flame-stage"><div className="fpl-flame-core"/></div>
        <div className="fpl-flame-particles" ref={particlesRef}/>
        <div className="fpl-cta-inner fpl-reveal">
          <h2 className="fpl-disp"><span className="fpl-grad-anim">Para las parejas.</span><br/>Por las parejas.</h2>
          <p>Abre FlickPick en tu móvil y empieza a deslizar con tu gente. Sin esperas, sin invitaciones.</p>
          <a href="https://flickpick.mov" className="fpl-cta-big">
            <span>Pruébalo ya en flickpick.mov</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          <div className="fpl-cta-platforms">
            <span>iOS</span><span className="fpl-pdot"/><span>Android</span><span className="fpl-pdot"/><span>Web</span><span className="fpl-pdot"/><span>TV</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="fpl-foot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/Favicon.webp" style={{ width: 24, height: 24 }} alt=""/>
          <span>© 2026 FlickPick. Para las parejas. Por las parejas.</span>
        </div>
        <ul>
          <li><a href="/privacidad" onClick={(e) => { e.preventDefault(); navigate('/privacidad'); }}>Privacidad</a></li>
          <li><a href="/terminos" onClick={(e) => { e.preventDefault(); navigate('/terminos'); }}>Términos</a></li>
          <li><a href="#">Prensa</a></li>
          <li><a href="#">Trabaja con nosotros</a></li>
        </ul>
      </footer>
    </div>
  );
};

const SwipeCard = ({ cls, pcls, badge, title, genre, meta }) => (
  <div className={`fpl-swipe-card fpl-${cls}`}>
    <div className={`fpl-poster fpl-${pcls}`}>
      <div className="fpl-card-actions"><span className="fpl-match-badge">{badge}</span></div>
      <div className="fpl-scrim"/>
      <div className="fpl-meta">
        <div className="fpl-title">{title}</div>
        <div className="fpl-yr"><span className="fpl-pill">{genre}</span><span>{meta}</span></div>
      </div>
    </div>
  </div>
);

const MarqueeContent = () => (
  <span>
    <span className="fpl-grad">Swipe.</span><span className="fpl-mdot"/>
    <span>Match.</span><span className="fpl-mdot"/>
    <span className="fpl-grad">Watch together.</span><span className="fpl-mdot"/>
    <span>Sin discusiones.</span><span className="fpl-mdot"/>
    <span className="fpl-grad">Fin a la guerra del mando.</span><span className="fpl-mdot"/>
  </span>
);

const LANDING_CSS = `
.fpl-root, .fpl-root *, .fpl-root *::before, .fpl-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
.fpl-root {
  --flame: linear-gradient(135deg,#FFB547 0%,#FF6B4A 30%,#FF3B6B 65%,#9B3BFF 100%);
  --flameh: linear-gradient(90deg,#FFB547 0%,#FF6B4A 30%,#FF3B6B 65%,#9B3BFF 100%);
  --flame-anim: linear-gradient(90deg,#FFB547,#FF6B4A,#FF3B6B,#9B3BFF,#FF3B6B,#FF6B4A,#FFB547,#FF6B4A,#FF3B6B,#9B3BFF,#FF3B6B,#FF6B4A,#FFB547);
  --orange:#FF6B4A; --red:#FF3B6B; --violet:#8B5CF6; --vdeep:#5B1DB5;
  --gold:#FFB547; --pink:#FF2E93; --cyan:#4EFFD6;
  --bg0:#07050E; --bg1:#0E0719; --bg2:#1A0F2E;
  --t:#F5F2FF; --td:rgba(245,242,255,.7); --tm:rgba(245,242,255,.42);
  --bdr:rgba(255,255,255,.10);
  position: fixed; inset: 0; overflow-y: auto; overflow-x: hidden;
  background: var(--bg0); color: var(--t);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; scroll-behavior: smooth;
  z-index: 1;
}
.fpl-root a { color: inherit; text-decoration: none; }
.fpl-root img { display: block; max-width: 100%; }
.fpl-disp { font-family: 'Space Grotesk','Inter',sans-serif; font-weight: 800; letter-spacing: -.03em; }
.fpl-grad { background: var(--flameh); -webkit-background-clip: text; background-clip: text; color: transparent; }
.fpl-grad-anim { background: var(--flame-anim); background-size: 200% 100%; background-repeat: repeat; -webkit-background-clip: text; background-clip: text; color: transparent; animation: fpl-flameflow 14s linear infinite; will-change: background-position; }
@keyframes fpl-flameflow { from { background-position: 0% 50%; } to { background-position: 200% 50%; } }

/* CURSOR */
.fpl-cur, .fpl-cur-d { position: fixed; top: 0; left: 0; pointer-events: none; z-index: 9999; border-radius: 50%; mix-blend-mode: difference; }
.fpl-cur { width: 8px; height: 8px; background: #fff; transform: translate(-50%,-50%); transition: width .2s, height .2s; }
.fpl-cur-d { width: 36px; height: 36px; border: 1.5px solid rgba(255,255,255,.5); transform: translate(-50%,-50%); transition: transform .15s ease-out; }
@media (hover: none) { .fpl-cur, .fpl-cur-d { display: none; } }

/* NAV */
.fpl-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 24px 56px; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); background: rgba(7,5,14,.4); border-bottom: 1px solid transparent; transition: border-color .4s, background .4s; }
.fpl-nav.fpl-scr { border-bottom-color: var(--bdr); background: rgba(7,5,14,.7); }
.fpl-nav-logo { display: flex; align-items: center; gap: 12px; font-family: 'Space Grotesk'; font-weight: 800; font-size: 22px; letter-spacing: -.02em; }
.fpl-nav-logo img { width: 34px; height: 34px; }
.fpl-nav-name { background: linear-gradient(90deg,#FFB547 0%,#FF6B4A 35%,#FF3B6B 65%,#9B3BFF 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.fpl-nav ul { display: flex; gap: 36px; list-style: none; }
.fpl-nav ul a { font-size: 14px; color: var(--td); font-weight: 500; transition: color .2s; }
.fpl-nav ul a:hover { color: var(--t); }
.fpl-nav-cta { padding: 11px 22px; border-radius: 999px; background: var(--flameh); color: #fff; font-size: 14px; font-weight: 700; letter-spacing: .02em; transition: transform .2s, box-shadow .3s; box-shadow: 0 6px 20px rgba(255,107,74,.25); }
.fpl-nav-cta:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(255,59,107,.45); }

/* HERO */
.fpl-hero { position: relative; min-height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 120px 56px 60px; }
.fpl-hero-orb { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; }
.fpl-hero-orb.a { top: -12%; left: -8%; width: 60vmin; height: 60vmin; background: radial-gradient(circle, rgba(255,107,74,.55), transparent 65%); animation: fpl-float 14s ease-in-out infinite; }
.fpl-hero-orb.b { bottom: -15%; right: -8%; width: 65vmin; height: 65vmin; background: radial-gradient(circle, rgba(155,59,255,.5), transparent 65%); animation: fpl-float 18s ease-in-out infinite reverse; }
.fpl-hero-orb.c { top: 30%; left: 40%; width: 40vmin; height: 40vmin; background: radial-gradient(circle, rgba(255,59,107,.4), transparent 65%); animation: fpl-float 22s ease-in-out infinite; }
@keyframes fpl-float { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.08); } }

.fpl-grid-bg { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px); background-size: 64px 64px; mask-image: radial-gradient(ellipse at center, #000 30%, transparent 75%); -webkit-mask-image: radial-gradient(ellipse at center, #000 30%, transparent 75%); }

.fpl-hero-grid { position: relative; z-index: 3; display: grid; grid-template-columns: 1.15fr 1fr; gap: 80px; align-items: center; width: 100%; max-width: 1440px; margin: 0 auto; }
.fpl-hero-eyebrow { display: inline-flex; align-items: center; gap: 10px; padding: 8px 16px; border-radius: 999px; background: rgba(255,255,255,.05); border: 1px solid var(--bdr); font-size: 13px; font-weight: 600; color: var(--td); letter-spacing: .04em; text-transform: uppercase; width: fit-content; margin-bottom: 28px; }
.fpl-hero-eyebrow .fpl-dot { width: 8px; height: 8px; border-radius: 50%; background: #4EFFD6; box-shadow: 0 0 12px #4EFFD6; animation: fpl-pulse 2s ease-in-out infinite; }
@keyframes fpl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }

.fpl-hero h1 { font-size: clamp(56px, 8.4vw, 128px); line-height: .94; letter-spacing: -.045em; margin-bottom: 32px; }
.fpl-hero h1 .fpl-ln { display: block; overflow: hidden; }
.fpl-hero h1 .fpl-ln span { display: inline-block; white-space: nowrap; transform: translateY(110%); animation: fpl-lnUp 1s cubic-bezier(.2,.7,.1,1) forwards; }
.fpl-hero h1 .fpl-ln:nth-child(1) span { animation-delay: .1s; }
.fpl-hero h1 .fpl-ln:nth-child(2) span { animation-delay: .25s; }
.fpl-hero h1 .fpl-ln:nth-child(3) span { animation-delay: .4s; }
@keyframes fpl-lnUp { to { transform: translateY(0); } }

.fpl-hero-sub { font-size: 22px; line-height: 1.5; color: var(--td); max-width: 520px; margin-bottom: 40px; opacity: 0; animation: fpl-fadeUp 1s .8s forwards; }
@keyframes fpl-fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

.fpl-hero-actions { display: flex; gap: 16px; align-items: center; opacity: 0; animation: fpl-fadeUp 1s 1s forwards; }
.fpl-btn-primary { padding: 18px 32px; border-radius: 999px; background: var(--flameh); color: #fff; font-weight: 700; font-size: 16px; letter-spacing: .01em; border: none; display: inline-flex; align-items: center; gap: 10px; position: relative; overflow: hidden; transition: transform .2s; box-shadow: 0 12px 40px rgba(255,107,74,.35); }
.fpl-btn-primary::before { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent); transform: translateX(-100%); transition: transform .6s; }
.fpl-btn-primary:hover::before { transform: translateX(100%); }
.fpl-btn-primary:hover { transform: translateY(-2px); }
.fpl-btn-ghost { padding: 18px 28px; border-radius: 999px; background: rgba(255,255,255,.05); color: var(--t); font-weight: 600; font-size: 16px; border: 1px solid var(--bdr); display: inline-flex; align-items: center; gap: 10px; transition: background .2s, border-color .2s; }
.fpl-btn-ghost:hover { background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.2); }
.fpl-play-i { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,.12); display: inline-flex; align-items: center; justify-content: center; }

.fpl-hero-meta { margin-top: 64px; display: flex; gap: 48px; opacity: 0; animation: fpl-fadeUp 1s 1.2s forwards; }
.fpl-hero-meta .fpl-col .fpl-k { font-family: 'Space Grotesk'; font-size: 36px; font-weight: 800; line-height: 1; }
.fpl-hero-meta .fpl-col .fpl-l { font-size: 13px; color: var(--tm); text-transform: uppercase; letter-spacing: .1em; margin-top: 6px; }

.fpl-hero-stage { position: relative; height: 680px; display: flex; align-items: center; justify-content: center; perspective: 1400px; }
.fpl-flame-bloom { position: absolute; width: 560px; height: 560px; border-radius: 50%; background: radial-gradient(circle, rgba(255,107,74,.35), transparent 60%); filter: blur(40px); animation: fpl-bloom 5s ease-in-out infinite; }
@keyframes fpl-bloom { 0%, 100% { transform: scale(1); opacity: .8; } 50% { transform: scale(1.15); opacity: 1; } }

.fpl-phone-3d { position: relative; width: 340px; height: 680px; border-radius: 54px; background: linear-gradient(160deg, #1A0F2E, #0E0719); border: 1.5px solid rgba(255,255,255,.12); box-shadow: 0 60px 120px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04), 0 0 80px rgba(255,107,74,.15), 0 0 80px rgba(155,59,255,.15); overflow: hidden; transform: rotateY(-8deg) rotateX(4deg); transition: transform .3s ease; }
.fpl-phone-3d::before { content: ""; position: absolute; top: 14px; left: 50%; transform: translateX(-50%); width: 96px; height: 28px; background: #000; border-radius: 16px; z-index: 20; }
.fpl-phone-3d::after { content: ""; position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); width: 120px; height: 5px; background: rgba(255,255,255,.5); border-radius: 3px; z-index: 20; }

.fpl-swipe-stack { position: absolute; inset: 60px 24px 80px; display: flex; align-items: center; justify-content: center; }
.fpl-swipe-card { position: absolute; width: 100%; height: 100%; border-radius: 28px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.5); }
.fpl-swipe-card .fpl-poster { position: absolute; inset: 0; display: flex; align-items: flex-end; padding: 24px; color: #fff; }
.fpl-swipe-card .fpl-poster .fpl-meta { position: relative; z-index: 2; }
.fpl-swipe-card .fpl-poster .fpl-title { font-family: 'Space Grotesk'; font-weight: 800; font-size: 30px; letter-spacing: -.02em; line-height: 1; margin-bottom: 6px; }
.fpl-swipe-card .fpl-poster .fpl-yr { font-size: 13px; color: rgba(255,255,255,.7); font-weight: 500; display: flex; gap: 10px; align-items: center; }
.fpl-swipe-card .fpl-poster .fpl-yr .fpl-pill { padding: 3px 10px; border-radius: 999px; background: rgba(255,255,255,.18); backdrop-filter: blur(8px); font-weight: 600; }
.fpl-swipe-card .fpl-scrim { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.2) 50%, transparent 80%); }

.fpl-poster-1 { background: linear-gradient(135deg, #FF6B4A, #9B3BFF); }
.fpl-poster-1::before { content: ""; position: absolute; top: 30%; left: 50%; transform: translate(-50%,-50%); width: 160px; height: 160px; border-radius: 50%; background: radial-gradient(circle, #FFB547, transparent 70%); filter: blur(20px); }
.fpl-poster-2 { background: linear-gradient(160deg, #0E0719, #1A0F2E, #5B1DB5); }
.fpl-poster-2::before { content: ""; position: absolute; top: 25%; left: 25%; width: 50%; height: 50%; border-radius: 50%; background: radial-gradient(circle, rgba(78,255,214,.7), transparent 60%); filter: blur(30px); }
.fpl-poster-3 { background: linear-gradient(135deg, #FFB547, #FF3B6B); }
.fpl-poster-3::before { content: ""; position: absolute; bottom: 30%; right: 20%; width: 140px; height: 140px; border-radius: 50%; background: radial-gradient(circle, #fff, transparent 65%); opacity: .4; filter: blur(15px); }
.fpl-poster-4 { background: linear-gradient(135deg, #1A0F2E, #FF2E93, #9B3BFF); }
.fpl-poster-4::before { content: ""; position: absolute; top: 40%; left: 30%; width: 40%; height: 30%; background: linear-gradient(45deg, rgba(255,255,255,.2), transparent); transform: rotate(15deg); filter: blur(20px); }

.fpl-card-actions { position: absolute; top: 20px; right: 20px; left: 20px; display: flex; justify-content: space-between; align-items: center; z-index: 3; }
.fpl-match-badge { padding: 6px 12px; border-radius: 999px; background: rgba(78,255,214,.25); border: 1px solid rgba(78,255,214,.5); font-size: 11px; font-weight: 700; letter-spacing: .05em; color: #4EFFD6; backdrop-filter: blur(8px); }

@keyframes fpl-swipeR { 0% { transform: translateX(0) rotate(0); opacity: 1; } 30% { transform: translateX(120%) rotate(20deg); opacity: 0; } 30.01%, 100% { transform: translateX(0) rotate(0); opacity: 1; } }
@keyframes fpl-swipeL { 0% { transform: translateX(0) rotate(0); opacity: 1; } 30% { transform: translateX(-120%) rotate(-20deg); opacity: 0; } 30.01%, 100% { transform: translateX(0) rotate(0); opacity: 1; } }
.fpl-swipe-card.fpl-s1 { animation: fpl-swipeR 12s 0s infinite; z-index: 4; }
.fpl-swipe-card.fpl-s2 { animation: fpl-swipeL 12s 3s infinite; z-index: 3; transform: scale(.96) translateY(8px); }
.fpl-swipe-card.fpl-s3 { animation: fpl-swipeR 12s 6s infinite; z-index: 2; transform: scale(.92) translateY(16px); }
.fpl-swipe-card.fpl-s4 { animation: fpl-swipeL 12s 9s infinite; z-index: 1; transform: scale(.88) translateY(24px); }

.fpl-match-popup { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%) scale(.6); font-family: 'Space Grotesk'; font-size: 64px; font-weight: 800; letter-spacing: -.04em; background: var(--flameh); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: 0 0 60px rgba(255,107,74,.6); opacity: 0; animation: fpl-matchPop 12s 5s infinite; z-index: 10; pointer-events: none; }
@keyframes fpl-matchPop { 0%, 40%, 55%, 100% { opacity: 0; transform: translate(-50%,-50%) scale(.6); } 43%, 52% { opacity: 1; transform: translate(-50%,-50%) scale(1); } }

/* MARQUEE */
.fpl-marquee { position: relative; padding: 32px 0; border-top: 1px solid var(--bdr); border-bottom: 1px solid var(--bdr); overflow: hidden; background: rgba(0,0,0,.3); }
.fpl-marquee-track { display: flex; gap: 80px; width: max-content; animation: fpl-marq 40s linear infinite; font-family: 'Space Grotesk'; font-size: 64px; font-weight: 800; letter-spacing: -.03em; }
.fpl-marquee-track > span { white-space: nowrap; display: inline-flex; align-items: center; gap: 80px; }
.fpl-marquee-track .fpl-mdot { width: 14px; height: 14px; border-radius: 50%; background: var(--flameh); display: inline-block; }
@keyframes fpl-marq { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* MANIFESTO */
.fpl-manifesto { position: relative; min-height: 140vh; padding: 200px 56px; display: flex; align-items: center; justify-content: center; }
.fpl-manifesto-inner { max-width: 1240px; }
.fpl-manifesto-eyebrow { display: flex; align-items: center; gap: 14px; font-size: 13px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--tm); margin-bottom: 32px; }
.fpl-manifesto-eyebrow .fpl-eb-ln { width: 48px; height: 1.5px; background: var(--flameh); display: inline-block; }
.fpl-manifesto h2 { font-size: clamp(40px, 6vw, 98px); line-height: 1.04; letter-spacing: -.035em; }
.fpl-word { display: inline-block; margin-right: .22em; color: rgba(245,242,255,.12); transition: color .4s ease; }
.fpl-word.fpl-lit { color: var(--t); }
.fpl-word.fpl-flame-w { background: var(--flameh); -webkit-background-clip: text; background-clip: text; color: transparent; }

/* MISSION */
.fpl-mission { position: relative; min-height: 100vh; padding: 140px 56px; overflow: hidden; background: linear-gradient(180deg, #07050E, #0E0719, #07050E); }
.fpl-mission-grid { max-width: 1440px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1.1fr; gap: 80px; align-items: center; }
.fpl-label { font-family: 'Space Grotesk'; font-size: 13px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; margin-bottom: 18px; }
.fpl-orange { color: var(--orange); }
.fpl-violet { color: var(--violet); }
.fpl-cyan { color: var(--cyan); }
.fpl-mission h2 { font-size: clamp(44px, 5.5vw, 84px); line-height: 1.02; letter-spacing: -.035em; margin-bottom: 28px; }
.fpl-mission p { font-size: 22px; line-height: 1.55; color: var(--td); max-width: 540px; margin-bottom: 24px; }
.fpl-stats { display: flex; gap: 32px; margin-top: 40px; }
.fpl-stat { padding: 24px 28px; border-radius: 18px; background: rgba(255,255,255,.04); border: 1px solid var(--bdr); }
.fpl-stat .fpl-n2 { font-family: 'Space Grotesk'; font-size: 48px; font-weight: 800; background: var(--flameh); -webkit-background-clip: text; background-clip: text; color: transparent; line-height: 1; }
.fpl-stat .fpl-l { font-size: 13px; color: var(--tm); text-transform: uppercase; letter-spacing: .08em; margin-top: 8px; }

.fpl-scene { position: relative; height: 640px; border-radius: 36px; background: radial-gradient(ellipse at top, rgba(155,59,255,.25), transparent 60%), linear-gradient(160deg, #0E0719, #1A0F2E); border: 1px solid var(--bdr); overflow: hidden; }
.fpl-couch { position: absolute; bottom: 0; left: 0; right: 0; height: 120px; background: linear-gradient(180deg, #2A1850, #1A0F2E); border-top: 1px solid rgba(255,255,255,.08); }
.fpl-couch::before, .fpl-couch::after { content: ""; position: absolute; bottom: 30px; width: 36%; height: 80px; background: linear-gradient(180deg, #3D2266, #2A1850); border-radius: 18px 18px 4px 4px; }
.fpl-couch::before { left: 8%; }
.fpl-couch::after { right: 8%; }
.fpl-tv { position: absolute; top: 50px; left: 50%; transform: translateX(-50%); width: 62%; height: 50%; border-radius: 14px; background: #000; border: 6px solid #1A0F2E; box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 30px 80px rgba(0,0,0,.6); overflow: hidden; }
.fpl-tv::before { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, #FF6B4A, #9B3BFF); opacity: .7; }
.fpl-tv-content { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.fpl-tv-question { font-family: 'Space Grotesk'; font-size: 34px; font-weight: 800; color: #fff; text-shadow: 0 4px 20px rgba(0,0,0,.5); letter-spacing: -.02em; text-align: center; animation: fpl-flash 4s ease-in-out infinite; transition: opacity .2s; }
@keyframes fpl-flash { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
.fpl-tv-glow { position: absolute; left: 50%; top: 30%; transform: translateX(-50%); width: 120%; height: 80%; background: radial-gradient(ellipse, rgba(255,107,74,.4), transparent 60%); filter: blur(40px); pointer-events: none; }

.fpl-remote { position: absolute; width: 48px; height: 140px; border-radius: 14px; background: linear-gradient(160deg, #2A1850, #0E0719); border: 1px solid rgba(255,255,255,.1); box-shadow: 0 12px 30px rgba(0,0,0,.5); }
.fpl-remote::before { content: ""; position: absolute; top: 14px; left: 50%; transform: translateX(-50%); width: 24px; height: 24px; border-radius: 50%; background: var(--flameh); box-shadow: 0 0 16px rgba(255,107,74,.6); }
.fpl-remote::after { content: ""; position: absolute; top: 50px; left: 8px; right: 8px; bottom: 14px; background: repeating-linear-gradient(0deg, rgba(255,255,255,.08) 0, rgba(255,255,255,.08) 8px, transparent 8px, transparent 18px); border-radius: 6px; }
.fpl-remote.r1 { bottom: 140px; left: 18%; animation: fpl-tug 3s ease-in-out infinite; transform-origin: bottom center; }
.fpl-remote.r2 { bottom: 140px; right: 18%; animation: fpl-tug 3s ease-in-out infinite reverse; transform-origin: bottom center; }
@keyframes fpl-tug { 0%, 100% { transform: rotate(-15deg) translateY(0); } 50% { transform: rotate(20deg) translateY(-10px); } }

.fpl-spark { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: #FFB547; box-shadow: 0 0 12px #FFB547; }
.fpl-spark.sp1 { top: 62%; left: 48%; animation: fpl-sparkle 1.5s ease-in-out infinite; }
.fpl-spark.sp2 { top: 60%; left: 52%; animation: fpl-sparkle 1.5s ease-in-out .3s infinite; }
.fpl-spark.sp3 { top: 64%; left: 50%; animation: fpl-sparkle 1.5s ease-in-out .6s infinite; }
@keyframes fpl-sparkle { 0%, 100% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.5); opacity: 1; } }

/* VISION */
.fpl-vision { position: relative; min-height: 100vh; padding: 160px 56px; overflow: hidden; }
.fpl-vision-orb { position: absolute; border-radius: 50%; filter: blur(100px); pointer-events: none; }
.fpl-vision-orb.x { top: 0; right: 10%; width: 50vmin; height: 50vmin; background: radial-gradient(circle, rgba(155,59,255,.5), transparent 65%); animation: fpl-float 16s ease-in-out infinite; }
.fpl-vision-orb.y { bottom: 0; left: 5%; width: 55vmin; height: 55vmin; background: radial-gradient(circle, rgba(255,46,147,.4), transparent 65%); animation: fpl-float 20s ease-in-out infinite reverse; }
.fpl-vision-inner { position: relative; z-index: 2; max-width: 1240px; margin: 0 auto; text-align: center; }
.fpl-vision h2 { font-size: clamp(48px, 7vw, 116px); line-height: .98; letter-spacing: -.04em; margin-bottom: 36px; }
.fpl-vision p { font-size: 24px; line-height: 1.55; color: var(--td); max-width: 780px; margin: 0 auto 80px; }
.fpl-counters { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 80px; }
.fpl-counter { padding: 48px 32px; border-radius: 24px; background: rgba(255,255,255,.04); border: 1px solid var(--bdr); position: relative; overflow: hidden; transition: transform .35s, border-color .35s; }
.fpl-counter:hover { transform: translateY(-6px); border-color: rgba(255,255,255,.2); }
.fpl-counter::before { content: ""; position: absolute; inset: 0; background: var(--flameh); opacity: 0; transition: opacity .35s; border-radius: 24px; }
.fpl-counter:hover::before { opacity: .05; }
.fpl-counter .fpl-n { font-family: 'Space Grotesk'; font-size: 88px; font-weight: 800; line-height: 1; background: var(--flameh); -webkit-background-clip: text; background-clip: text; color: transparent; letter-spacing: -.03em; }
.fpl-counter .fpl-l { font-size: 14px; text-transform: uppercase; letter-spacing: .12em; color: var(--td); margin-top: 14px; }
.fpl-counter .fpl-d { font-size: 15px; color: var(--tm); margin-top: 8px; line-height: 1.4; }

/* VALUES */
.fpl-values { position: relative; padding: 160px 56px; background: linear-gradient(180deg, transparent, rgba(255,255,255,.02), transparent); }
.fpl-values-inner { max-width: 1440px; margin: 0 auto; }
.fpl-values-head { display: grid; grid-template-columns: 1.4fr 1fr; align-items: end; margin-bottom: 80px; gap: 60px; }
.fpl-values h2 { font-size: clamp(40px, 4.6vw, 72px); line-height: 1.02; letter-spacing: -.035em; }
.fpl-lead { font-size: 20px; color: var(--td); max-width: 480px; line-height: 1.55; }

.fpl-value-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.fpl-v-card { position: relative; padding: 48px 36px; border-radius: 28px; background: rgba(255,255,255,.03); border: 1px solid var(--bdr); overflow: hidden; transition: transform .4s, border-color .4s; min-height: 480px; display: flex; flex-direction: column; }
.fpl-v-card:hover { transform: translateY(-8px); border-color: rgba(255,255,255,.18); }
.fpl-v-card .fpl-num { font-family: 'Space Grotesk'; font-size: 14px; font-weight: 700; letter-spacing: .16em; color: var(--tm); margin-bottom: 48px; }
.fpl-v-card .fpl-icon { width: 88px; height: 88px; border-radius: 24px; display: flex; align-items: center; justify-content: center; margin-bottom: 32px; position: relative; overflow: hidden; }
.fpl-v-card h3 { font-family: 'Space Grotesk'; font-size: 42px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 18px; line-height: 1; }
.fpl-v-card p { font-size: 16px; line-height: 1.6; color: var(--td); }
.fpl-v-card .fpl-glow { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 160%; height: 160%; background: radial-gradient(circle, var(--gc), transparent 60%); opacity: 0; transition: opacity .5s; pointer-events: none; }
.fpl-v-card:hover .fpl-glow { opacity: .18; }
.fpl-v-1 { --gc: #FFB547; }
.fpl-v-1 .fpl-icon { background: rgba(255,183,71,.12); border: 1px solid rgba(255,183,71,.3); }
.fpl-v-2 { --gc: #FF3B6B; }
.fpl-v-2 .fpl-icon { background: rgba(255,59,107,.12); border: 1px solid rgba(255,59,107,.3); }
.fpl-v-3 { --gc: #9B3BFF; }
.fpl-v-3 .fpl-icon { background: rgba(155,59,255,.12); border: 1px solid rgba(155,59,255,.3); }

/* CTA */
.fpl-cta { position: relative; min-height: 100vh; padding: 160px 56px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.fpl-flame-stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.fpl-flame-core { width: 60vmin; height: 60vmin; border-radius: 50%; background: radial-gradient(circle, rgba(255,183,71,.7) 0%, rgba(255,107,74,.55) 25%, rgba(255,59,107,.45) 50%, rgba(155,59,255,.3) 75%, transparent 100%); filter: blur(20px); animation: fpl-bloom 4s ease-in-out infinite; }
.fpl-flame-particles { position: absolute; inset: 0; pointer-events: none; }
.fpl-flame-particles .fpl-p { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: #FFB547; bottom: 30%; left: 50%; animation: fpl-rise 3s linear infinite; box-shadow: 0 0 10px currentColor; }
@keyframes fpl-rise { 0% { transform: translate(-50%, 0) scale(1); opacity: 1; } 100% { transform: translate(calc(-50% + var(--x,0px)), -100vh) scale(0); opacity: 0; } }

.fpl-cta-inner { position: relative; z-index: 2; max-width: 920px; text-align: center; }
.fpl-cta h2 { font-size: clamp(48px, 6.4vw, 108px); line-height: 1; letter-spacing: -.04em; margin-bottom: 32px; }
.fpl-cta p { font-size: 20px; color: var(--td); line-height: 1.55; max-width: 520px; margin: 0 auto 44px; }
.fpl-cta-big { display: inline-flex; align-items: center; gap: 14px; padding: 22px 40px; border-radius: 999px; background: var(--flameh); color: #fff; font-weight: 800; font-size: 20px; letter-spacing: .005em; box-shadow: 0 16px 50px rgba(255,107,74,.45), 0 0 80px rgba(155,59,255,.25); transition: transform .25s, box-shadow .35s; position: relative; overflow: hidden; }
.fpl-cta-big::before { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.4), transparent); transform: translateX(-100%); transition: transform .7s; }
.fpl-cta-big:hover::before { transform: translateX(100%); }
.fpl-cta-big:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 22px 70px rgba(255,59,107,.55), 0 0 100px rgba(155,59,255,.4); }
.fpl-cta-platforms { display: flex; justify-content: center; gap: 24px; margin-top: 48px; color: var(--tm); font-size: 13px; letter-spacing: .1em; text-transform: uppercase; font-weight: 600; align-items: center; }
.fpl-cta-platforms .fpl-pdot { width: 4px; height: 4px; border-radius: 50%; background: var(--tm); display: inline-block; }

/* FOOTER */
.fpl-foot { padding: 48px 56px 36px; border-top: 1px solid var(--bdr); display: flex; justify-content: space-between; align-items: center; gap: 32px; flex-wrap: wrap; color: var(--tm); font-size: 13px; }
.fpl-foot a:hover { color: var(--t); }
.fpl-foot ul { display: flex; gap: 28px; list-style: none; }

/* SCROLL REVEAL */
.fpl-reveal { opacity: 0; transform: translateY(40px); transition: opacity 1s cubic-bezier(.2,.7,.1,1), transform 1s cubic-bezier(.2,.7,.1,1); }
.fpl-reveal.fpl-in { opacity: 1; transform: translateY(0); }

/* RESPONSIVE */
@media (max-width: 980px) {
  .fpl-cur, .fpl-cur-d { display: none; }
  .fpl-nav { padding: 14px 18px; }
  .fpl-nav ul { display: none; }
  .fpl-nav-logo { font-size: 18px; gap: 9px; }
  .fpl-nav-logo img { width: 28px; height: 28px; }
  .fpl-nav-cta { padding: 10px 16px; font-size: 13px; }
  .fpl-hero { padding: 100px 20px 40px; min-height: auto; }
  .fpl-hero-grid { grid-template-columns: 1fr; gap: 48px; text-align: left; }
  .fpl-hero h1 { font-size: clamp(34px, 9vw, 60px); margin-bottom: 22px; letter-spacing: -.035em; }
  .fpl-hero-sub { font-size: 17px; margin-bottom: 28px; max-width: 100%; }
  .fpl-hero-actions { flex-wrap: wrap; gap: 12px; }
  .fpl-btn-primary, .fpl-btn-ghost { padding: 14px 22px; font-size: 14px; width: 100%; justify-content: center; }
  .fpl-hero-stage { height: 520px; order: -1; }
  .fpl-phone-3d { width: 240px; height: 480px; border-radius: 42px; }
  .fpl-phone-3d::before { width: 78px; height: 22px; }
  .fpl-swipe-card .fpl-poster { padding: 18px; }
  .fpl-swipe-card .fpl-poster .fpl-title { font-size: 24px; }
  .fpl-flame-bloom { width: 340px; height: 340px; }
  .fpl-match-popup { font-size: 48px; }
  .fpl-hero-meta { margin-top: 40px; gap: 24px; }
  .fpl-hero-meta .fpl-col .fpl-k { font-size: 28px; }
  .fpl-hero-meta .fpl-col .fpl-l { font-size: 11px; }
  .fpl-marquee { padding: 20px 0; }
  .fpl-marquee-track { font-size: 36px; gap: 48px; }
  .fpl-marquee-track > span { gap: 48px; }
  .fpl-marquee-track .fpl-mdot { width: 8px; height: 8px; }
  .fpl-manifesto, .fpl-mission, .fpl-vision, .fpl-values, .fpl-cta { padding: 80px 20px; }
  .fpl-manifesto { min-height: auto; }
  .fpl-manifesto-eyebrow { font-size: 11px; margin-bottom: 20px; }
  .fpl-manifesto h2 { font-size: clamp(28px, 7.5vw, 44px); }
  .fpl-mission-grid { grid-template-columns: 1fr; gap: 40px; }
  .fpl-mission h2 { font-size: clamp(34px, 8vw, 52px); }
  .fpl-mission p { font-size: 17px; }
  .fpl-stats { flex-direction: column; gap: 14px; margin-top: 32px; }
  .fpl-stat { padding: 18px 22px; }
  .fpl-stat .fpl-n2 { font-size: 36px; }
  .fpl-scene { height: 380px; border-radius: 24px; }
  .fpl-tv { width: 72%; height: 46%; border: 4px solid #1A0F2E; }
  .fpl-tv-question { font-size: 22px; }
  .fpl-remote { width: 36px; height: 100px; }
  .fpl-remote::before { width: 18px; height: 18px; top: 10px; }
  .fpl-remote.r1 { left: 8%; bottom: 120px; }
  .fpl-remote.r2 { right: 8%; bottom: 120px; }
  .fpl-vision h2 { font-size: clamp(36px, 9vw, 60px); }
  .fpl-vision p { font-size: 17px; margin-bottom: 48px; }
  .fpl-counters { grid-template-columns: 1fr; gap: 14px; margin-top: 48px; }
  .fpl-counter { padding: 32px 24px; }
  .fpl-counter .fpl-n { font-size: 64px; }
  .fpl-counter .fpl-l { font-size: 12px; }
  .fpl-counter .fpl-d { font-size: 14px; }
  .fpl-values-head { grid-template-columns: 1fr; align-items: flex-start; gap: 20px; margin-bottom: 48px; }
  .fpl-values h2 { font-size: clamp(34px, 8vw, 52px); }
  .fpl-lead { font-size: 16px; max-width: 100%; }
  .fpl-value-grid { grid-template-columns: 1fr; gap: 16px; }
  .fpl-v-card { padding: 32px 26px; min-height: auto; }
  .fpl-v-card h3 { font-size: 32px; }
  .fpl-v-card .fpl-icon { width: 64px; height: 64px; border-radius: 18px; margin-bottom: 24px; }
  .fpl-v-card .fpl-icon svg { width: 32px; height: 32px; }
  .fpl-v-card p { font-size: 15px; }
  .fpl-cta { min-height: auto; }
  .fpl-cta h2 { font-size: clamp(44px, 11vw, 72px); }
  .fpl-cta p { font-size: 17px; margin-bottom: 36px; }
  .fpl-cta-big { padding: 18px 26px; font-size: 16px; width: 100%; justify-content: center; }
  .fpl-cta-platforms { flex-wrap: wrap; justify-content: center; gap: 14px; font-size: 11px; }
  .fpl-flame-core { width: 80vmin; height: 80vmin; }
  .fpl-foot { padding: 32px 20px; flex-direction: column; align-items: flex-start; gap: 20px; }
  .fpl-foot ul { flex-wrap: wrap; gap: 18px; }
}
@media (max-width: 420px) {
  .fpl-hero h1 { font-size: clamp(30px, 8.6vw, 46px); }
  .fpl-hero-stage { height: 460px; }
  .fpl-phone-3d { width: 210px; height: 420px; }
  .fpl-swipe-stack { inset: 50px 18px 64px; }
  .fpl-swipe-card .fpl-poster .fpl-title { font-size: 20px; }
  .fpl-hero-meta { gap: 18px; }
  .fpl-hero-meta .fpl-col { flex: 1 1 calc(33% - 12px); }
}
`;

export default LandingPage;
