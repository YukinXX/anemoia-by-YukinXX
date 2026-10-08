//by YukinX

const S = 256;
const C = S / 2;

const GLYPHS = {
  search(g) { g.arc(112, 112, 52, 0, Math.PI * 2); g.moveTo(150, 150); g.lineTo(196, 196); },
  globe(g) {
    g.arc(C, C, 78, 0, Math.PI * 2);
    g.moveTo(C + 34, C); g.ellipse(C, C, 34, 78, 0, 0, Math.PI * 2);
    g.moveTo(50, C); g.lineTo(206, C);
    g.moveTo(61, 88); g.lineTo(195, 88);
    g.moveTo(61, 168); g.lineTo(195, 168);
  },
  bookmark(g) { g.moveTo(84, 46); g.lineTo(172, 46); g.lineTo(172, 212); g.lineTo(C, 176); g.lineTo(84, 212); g.closePath(); },
  folder(g) { g.moveTo(46, 82); g.lineTo(104, 82); g.lineTo(120, 100); g.lineTo(210, 100); g.lineTo(210, 196); g.lineTo(46, 196); g.closePath(); },
  bars(g) { g.rect(56, 150, 32, 58); g.rect(112, 104, 32, 104); g.rect(168, 56, 32, 152); },
  clock(g) { g.arc(C, C, 80, 0, Math.PI * 2); g.moveTo(C, C); g.lineTo(C, 76); g.moveTo(C, C); g.lineTo(166, 150); },
  gear(g) {
    g.arc(C, C, 30, 0, Math.PI * 2);
    g.moveTo(C + 58, C); g.arc(C, C, 58, 0, Math.PI * 2);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.moveTo(C + Math.cos(a) * 62, C + Math.sin(a) * 62);
      g.lineTo(C + Math.cos(a) * 86, C + Math.sin(a) * 86);
    }
  },
  plus(g) { g.moveTo(C, 60); g.lineTo(C, 196); g.moveTo(60, C); g.lineTo(196, C); },
  note(g) {
    g.ellipse(100, 180, 26, 20, -0.35, 0, Math.PI * 2);
    g.moveTo(125, 174); g.lineTo(125, 56);
    g.quadraticCurveTo(150, 92, 184, 96);
  },
  wave(g) {
    for (let x = 36; x <= 220; x += 4) {
      const y = C + 42 * Math.sin(((x - 36) / 184) * Math.PI * 3) * Math.sin(((x - 36) / 184) * Math.PI);
      x === 36 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
  },
  star(g) {
    g.moveTo(C, 36);
    g.quadraticCurveTo(140, 116, 220, C); g.quadraticCurveTo(140, 140, C, 220);
    g.quadraticCurveTo(116, 140, 36, C); g.quadraticCurveTo(116, 116, C, 36);
  },
  tv(g) { g.rect(50, 78, 156, 112); g.moveTo(100, 44); g.lineTo(C, 78); g.lineTo(156, 44); g.moveTo(70, 210); g.lineTo(186, 210); },
  diamond(g) {
    g.moveTo(C, 40); g.lineTo(206, C); g.lineTo(C, 216); g.lineTo(50, C); g.closePath();
    g.moveTo(C, 84); g.lineTo(162, C); g.lineTo(C, 172); g.lineTo(94, C); g.closePath();
  },
  reset(g) {
    g.arc(C, C, 70, -Math.PI * 0.35, Math.PI * 1.45);
    const a = -Math.PI * 0.35, x = C + Math.cos(a) * 70, y = C + Math.sin(a) * 70;
    g.moveTo(x - 30, y - 6); g.lineTo(x, y); g.lineTo(x - 4, y + 30);
  },
  trash(g) {
    g.moveTo(66, 72); g.lineTo(190, 72);
    g.moveTo(108, 72); g.lineTo(108, 52); g.lineTo(148, 52); g.lineTo(148, 72);
    g.moveTo(80, 72); g.lineTo(92, 208); g.lineTo(164, 208); g.lineTo(176, 72);
  },
  up(g) { g.moveTo(70, 160); g.lineTo(C, 96); g.lineTo(186, 160); },
  down(g) { g.moveTo(70, 96); g.lineTo(C, 160); g.lineTo(186, 96); },
  pencil(g) { g.moveTo(66, 190); g.lineTo(78, 152); g.lineTo(170, 60); g.lineTo(196, 86); g.lineTo(104, 178); g.closePath(); },
  open(g) { g.rect(52, 84, 120, 120); g.moveTo(120, 136); g.lineTo(204, 52); g.moveTo(160, 52); g.lineTo(204, 52); g.lineTo(204, 96); },
  check(g) { g.moveTo(62, 134); g.lineTo(106, 178); g.lineTo(196, 84); },
  cross(g) { g.moveTo(76, 76); g.lineTo(180, 180); g.moveTo(180, 76); g.lineTo(76, 180); },
  orb(g) { g.arc(C, C, 74, 0, Math.PI * 2); g.moveTo(C + 30, C); g.arc(C, C, 30, 0, Math.PI * 2); },
  dot(g) { g.arc(C, C, 16, 0, Math.PI * 2); },
};

export function drawGlyph(name) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const draw = GLYPHS[name] || GLYPHS.orb;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#ffffff';

  for (const [w, blur, alpha] of [[14, 26, 0.35], [8, 10, 0.9], [5, 0, 1]]) {
    g.save();
    g.globalAlpha = alpha;
    g.lineWidth = w;
    g.shadowColor = 'rgba(160, 210, 255, 1)';
    g.shadowBlur = blur;
    g.beginPath();
    draw(g);
    g.stroke();
    g.restore();
  }
  return cv;
}

export function drawImageEmblem(img) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.shadowColor = 'rgba(200, 230, 255, 0.8)';
  g.shadowBlur = 24;
  const size = 120;
  g.drawImage(img, C - size / 2, C - size / 2, size, size);
  return cv;
}
