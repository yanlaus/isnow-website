/* 線條圖示（取代 emoji）：統一 24×24、1.75 線寬、跟文字顏色 */
const P = {
  // 遊戲
  sword: '<path d="M20 3.5 9.5 14l-1-1L19 2.5h1z"/><path d="M5.5 11.5l7 7"/><path d="M8 16l-4 4"/><circle cx="3.5" cy="20.5" r="1"/>',
  hammer: '<path d="M13 3.5 20.5 11l-3.5 3.5L9.5 7z"/><path d="M11.5 12.5 3.5 20.5"/><path d="M9.5 7l2-2"/>',
  chest: '<path d="M4 10h16v9.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5z"/><path d="M4 10V8.5A4.5 4.5 0 0 1 8.5 4h7A4.5 4.5 0 0 1 20 8.5V10"/><path d="M8 4.5V20M16 4.5V20"/><path d="M11 12.5h2v3h-2z"/>',
  crystal: '<path d="M12 2.5 18 8 12 21.5 6 8z"/><path d="M6 8h12"/><path d="M9.5 8 12 21.5 14.5 8 12 2.5 9.5 8"/>',
  tower: '<path d="M6 21V10h12v11"/><path d="M5 10V5h2.5v2H10V5h4v2h2.5V5H19v5"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/><path d="M3.5 21h17"/><path d="M11 12.5h2"/>',
  steps: '<path d="M8.5 3.5c1.6 0 2.7 2 2.7 4.6s-1.1 4.4-2.7 4.4S5.8 10.7 5.8 8.1 6.9 3.5 8.5 3.5z"/><path d="M6.8 15h3.4"/><path d="M15.5 8.5c1.6 0 2.7 2 2.7 4.6s-1.1 4.4-2.7 4.4-2.7-1.8-2.7-4.4 1.1-4.6 2.7-4.6z"/><path d="M13.8 20h3.4"/>',
  tile: '<rect x="5.5" y="2.5" width="13" height="19" rx="2"/><path d="M12 6v12"/><path d="M8.5 9.5h7v4h-7z"/>',
  scales: '<path d="M12 3v17"/><path d="M7.5 20.5h9"/><path d="M4.5 6.5h15"/><path d="M4.5 6.5 2 13a2.6 2.6 0 0 0 5 0z"/><path d="M19.5 6.5 17 13a2.6 2.6 0 0 0 5 0z"/><circle cx="12" cy="4" r="1"/>',
  stele: '<path d="M6.5 20V7a5.5 3.5 0 0 1 11 0v13"/><path d="M4 20.5h16"/><path d="M9.5 9.5h5M9.5 12.5h5M9.5 15.5h5"/>',
  // 類別
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  moon: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/><path d="M17 3.5v3M15.5 5h3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z"/>',
  lantern: '<path d="M9.5 3h5M12 3v2"/><path d="M7 9.5A5 5 0 0 1 17 9.5v5a5 5 0 0 1-10 0z"/><path d="M7 12h10"/><path d="M10 21h4M12 19.5V21"/>',
  // 介面
  back: '<path d="M15 4.5 7.5 12l7.5 7.5"/>',
  up: '<path d="M5 15.5 12 8l7 7.5"/>',
  down: '<path d="M5 8.5 12 16l7-7.5"/>',
  left: '<path d="M15.5 5 8 12l7.5 7"/>',
  right: '<path d="M8.5 5 16 12l-7.5 7"/>',
  north: '<path d="M12 3 7 20l5-4 5 4z"/>',
  play: '<path d="M7 4.5 19.5 12 7 19.5z"/>',
  'sound-on': '<path d="M4 9.5h3.5L12.5 5v14l-5-4.5H4z"/><path d="M16 9a4.2 4.2 0 0 1 0 6"/><path d="M18.5 6.5a7.8 7.8 0 0 1 0 11"/>',
  'sound-off': '<path d="M4 9.5h3.5L12.5 5v14l-5-4.5H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
  hourglass: '<path d="M6.5 3h11M6.5 21h11"/><path d="M8 3v2.5c0 3 8 3.8 8 6.5s-8 3.5-8 6.5V21"/><path d="M16 3v2.5c0 3-8 3.8-8 6.5s8 3.5 8 6.5V21"/>',
  gem: '<path d="M6.5 4h11l3.5 5L12 20.5 3 9z"/><path d="M3 9h18"/><path d="M9 4 12 9l3-5"/><path d="M12 9v11.5"/>',
  heart: '<path d="M12 20s-7.5-4.6-9-9.6A4.4 4.4 0 0 1 12 6.3a4.4 4.4 0 0 1 9 4.1C19.5 15.4 12 20 12 20z"/>',
  lamp: '<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9v1.6h7v-1.6A6 6 0 0 0 12 3z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  shuffle: '<path d="M16 3.5h4.5V8"/><path d="M4 20 20.5 3.5"/><path d="M20.5 16v4.5H16"/><path d="M14.5 14.5l6 6"/><path d="M4 4l5.5 5.5"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.5-5.8L4 8.5"/><path d="M4 3.5v5h5"/>',
  scroll: '<path d="M8 3.5h10.5a2 2 0 0 1 2 2V7h-3.5"/><path d="M17 5.5V18.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5h10.5v1.5"/><path d="M8 3.5a2 2 0 0 0-2 2V17"/><path d="M9.5 8.5h5M9.5 11.5h5M9.5 14.5h3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  basket: '<path d="M3 10h18l-2 10H5z"/><path d="M7.5 10 11 4M16.5 10 13 4"/><path d="M9 13.5v3.5M12 13.5v3.5M15 13.5v3.5"/>',
  person: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5a7 7 0 0 1 14 0"/>',
  medal: '<path d="M8 3h8l-2 6h-4z"/><circle cx="12" cy="15" r="5.5"/><path d="M12 12.5v5M10 14l2-1.5"/>',
  trophy: '<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5v1a3 3 0 0 0 3 3M16.5 6h3v1a3 3 0 0 1-3 3"/><path d="M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ico${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
}
