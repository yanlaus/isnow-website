/* ===== NAVBAR SCROLL ===== */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ===== HAMBURGER MENU ===== */
const hamburger    = document.getElementById('hamburger');
const mobileDrawer = document.getElementById('mobileDrawer');
const mobileOverlay = document.getElementById('mobileOverlay');

function openMenu() {
  hamburger.classList.add('open');
  mobileDrawer.classList.add('open');
  mobileOverlay.classList.add('open');
  mobileDrawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeMenu() {
  hamburger.classList.remove('open');
  mobileDrawer.classList.remove('open');
  mobileOverlay.classList.remove('open');
  mobileDrawer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

hamburger.addEventListener('click', () => {
  mobileDrawer.classList.contains('open') ? closeMenu() : openMenu();
});
mobileOverlay.addEventListener('click', closeMenu);
mobileDrawer.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

/* ===== SNOWFLAKES ===== */
function createSnowflakes(containerId, count = 40) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const chars = ['❄', '❅', '❆', '✦', '·'];
  for (let i = 0; i < count; i++) {
    const flake = document.createElement('span');
    flake.className = 'snowflake';
    flake.textContent = chars[Math.floor(Math.random() * chars.length)];
    const size = Math.random() * 14 + 8;
    const left = Math.random() * 100;
    const duration = Math.random() * 10 + 8;
    const delay = Math.random() * 10;
    const drift = (Math.random() - .5) * 120;
    flake.style.cssText = `
      left: ${left}%;
      font-size: ${size}px;
      animation-duration: ${duration}s;
      animation-delay: -${delay}s;
      --drift: ${drift}px;
      opacity: ${Math.random() * .6 + .2};
    `;
    container.appendChild(flake);
  }
}
createSnowflakes('snowflakes', 50);
createSnowflakes('snowflakes2', 25);

/* ===== EQUIPMENT TABS ===== */
const tabs   = document.querySelectorAll('.eq-tab');
const panels = document.querySelectorAll('.eq-panel');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

/* ===== RESORT FILTER ===== */
const filterBtns = document.querySelectorAll('.resort-filter-btn');
const resortCards = document.querySelectorAll('.resort-card');
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const country = btn.dataset.country;
    resortCards.forEach(card => {
      const show = country === 'all' || card.dataset.country === country;
      card.classList.toggle('hidden', !show);
    });
  });
});

/* ===== SCROLL REVEAL ===== */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

function addRevealToChildren(selector, delay = true) {
  document.querySelectorAll(selector).forEach((el, i) => {
    el.classList.add('reveal');
    if (delay) el.classList.add(`reveal-delay-${(i % 3) + 1}`);
    revealObserver.observe(el);
  });
}

addRevealToChildren('.eq-card');
addRevealToChildren('.resort-card');
addRevealToChildren('.std-item');
addRevealToChildren('.pillar-card');
addRevealToChildren('.overview-item');

/* Section headers */
document.querySelectorAll('.section-header, .casi-intro, .casi-pillars, .casi-cta-block').forEach(el => {
  el.classList.add('reveal');
  revealObserver.observe(el);
});

/* ===== SMOOTH SCROLL FOR NAV LINKS ===== */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = navbar.offsetHeight + 20;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ===== CTA FORM ===== */
document.getElementById('ctaForm').addEventListener('submit', e => {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const btn   = e.target.querySelector('button');
  btn.textContent = '✓ 訂閱成功！';
  btn.style.background = '#2ecc71';
  input.value = '';
  input.disabled = true;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = '立即加入';
    btn.style.background = '';
    input.disabled = false;
    btn.disabled = false;
  }, 3500);
});

/* ===== ACTIVE NAV LINK ON SCROLL ===== */
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
const onScroll = () => {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
  });
  navAnchors.forEach(a => {
    a.style.color = '';
    if (a.getAttribute('href') === '#' + current) {
      a.style.color = 'var(--sky)';
    }
  });
};
window.addEventListener('scroll', onScroll, { passive: true });
