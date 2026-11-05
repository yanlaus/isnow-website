/* 迷你走勢線（SVG）：一律「越高越好」——用時類指標會上下倒轉 */
export function sparkline(values, { w = 96, h = 28, invert = false, cls = 'spark' } = {}) {
  if (!values || values.length < 2) return '';
  const pad = 6;
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => {
    let k = max === min ? 0.5 : (v - min) / (max - min);
    if (invert && max !== min) k = 1 - k;
    return [pad + (i * (w - pad * 2)) / (values.length - 1), h - pad - k * (h - pad * 2)];
  });
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const dots = pts.slice(0, -1).map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.7"/>`).join('');
  const [lx, ly] = pts[pts.length - 1];
  const now = `<path class="spark-now" d="M${lx.toFixed(1)} ${(ly - 4.5).toFixed(1)}l4.5 4.5-4.5 4.5-4.5-4.5z"/>`;
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path class="spark-line" d="${line}"/>${dots}${now}</svg>`;
}
