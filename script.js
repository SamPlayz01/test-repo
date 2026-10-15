(() => {
const $ = (s, r = document) => r.querySelector(s);
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get(k){ try { return localStorage.getItem(k); } catch { return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch {} } };

/* ---------- Theme ---------- */
const sw = $('#themeSwitch');
const saved = store.get('sw-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const setTheme = (t, animate) => {
  if (animate) { document.body.classList.add('theming'); setTimeout(() => document.body.classList.remove('theming'), 800); }
  root.dataset.theme = t; sw.setAttribute('aria-checked', t === 'dark'); store.set('sw-theme', t);
  target = t === 'dark' ? palettes.dark : palettes.light;
};
sw.addEventListener('click', () => {
  sw.classList.remove('wobble'); void sw.offsetWidth; sw.classList.add('wobble');
  setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
});

/* ---------- WebGL background ---------- */
const hex = h => [1,3,5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const palettes = {
  light: ['#e6ebfa', '#c9d4ff', '#ffd0e4', '#bdeee4'].map(hex),
  dark:  ['#080a19', '#1b2062', '#4b1d63', '#0d4a58'].map(hex)
};
let target = palettes.light;
let current = palettes.light.map(c => c.slice());
const canvas = $('#bg');
const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
let mouse = [.5, .5], mouseT = [.5, .5];
if (gl) {
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `precision mediump float;
  uniform vec2 uRes,uMouse;uniform float uTime;uniform vec3 c0,c1,c2,c3;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  void main(){
    vec2 uv=gl_FragCoord.xy/uRes;float r=uRes.x/uRes.y;
    vec2 p=uv*vec2(r,1.)*1.5,m=uMouse*vec2(r,1.)*1.5;
    float d=distance(p,m);p+=(p-m)*.18*exp(-d*1.8);
    float t=uTime*.05;
    float a=n(p+vec2(t,-t));
    float b=n(p*1.6+a*1.6-t);
    float c=n(p*2.3+b*2.+t);
    vec3 col=mix(c0,c1,smoothstep(.15,.85,a));
    col=mix(col,c2,smoothstep(.3,.9,b)*.85);
    col=mix(col,c3,smoothstep(.45,.95,c)*.6);
    col+=(h(gl_FragCoord.xy+uTime)-.5)*.018;
    gl_FragColor=vec4(col,1.);}`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  const resize = () => { const s = Math.min(devicePixelRatio, 1.5) * .6; canvas.width = innerWidth * s; canvas.height = innerHeight * s; gl.viewport(0, 0, canvas.width, canvas.height); };
  addEventListener('resize', resize); resize();
  addEventListener('pointermove', e => { mouseT = [e.clientX / innerWidth, 1 - e.clientY / innerHeight]; });
  const t0 = performance.now();
  const frame = now => {
    mouse = mouse.map((v, i) => v + (mouseT[i] - v) * .04);
    current = current.map((c, i) => c.map((v, j) => v + (target[i][j] - v) * .05));
    gl.uniform2f(U('uRes'), canvas.width, canvas.height); gl.uniform2f(U('uMouse'), mouse[0], mouse[1]);
    gl.uniform1f(U('uTime'), (now - t0) / 1000);
    current.forEach((c, i) => gl.uniform3f(U('c' + i), ...c));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduce) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  if (reduce) { current = target.map(c => c.slice()); sw.addEventListener('click', () => setTimeout(() => { current = target.map(c => c.slice()); requestAnimationFrame(frame); }, 0)); }
} else {
  document.body.style.background = 'linear-gradient(135deg,var(--bg),#c9d4ff)';
}
setTheme(saved, false);

/* ---------- Glass light follows pointer ---------- */
document.querySelectorAll('.glass').forEach(el => {
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
});

/* ---------- Timer ---------- */
const DUR = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const LABEL = { focus: 'Time to focus', short: 'Take a breather', long: 'Rest properly' };
const C = 553;
let mode = 'focus', left = DUR.focus, timer = null, end = 0, done = +(store.get('sw-done') || 0);
const clock = $('#clock'), prog = $('#prog'), status = $('#status'), ring = $('.ring'), toggle = $('#toggle'), modes = $('#modes');
$('#done').textContent = done;
const paint = () => {
  const m = String(Math.floor(left / 60)).padStart(2, '0'), s = String(left % 60).padStart(2, '0');
  clock.textContent = `${m}:${s}`; document.title = timer ? `${m}:${s} – Stillwater` : 'Stillwater – study in sessions you can finish';
  prog.style.strokeDashoffset = C * (1 - left / DUR[mode]);
};
const stop = () => { clearInterval(timer); timer = null; ring.classList.remove('run'); toggle.textContent = 'Start'; };
const finish = () => {
  stop(); left = 0; paint(); status.textContent = 'Nicely done';
  ring.classList.remove('finish'); void ring.offsetWidth; ring.classList.add('finish');
  if (mode === 'focus') { done++; store.set('sw-done', done); $('#done').textContent = done; }
};
const start = () => {
  if (left <= 0) left = DUR[mode];
  end = Date.now() + left * 1000; ring.classList.add('run'); toggle.textContent = 'Pause'; status.textContent = LABEL[mode];
  timer = setInterval(() => { left = Math.max(0, Math.round((end - Date.now()) / 1000)); paint(); if (!left) finish(); }, 250);
};
const setMode = m => {
  mode = m; stop(); left = DUR[m]; status.textContent = 'Ready when you are'; paint();
  const btns = [...modes.querySelectorAll('button')];
  btns.forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  modes.style.setProperty('--i', btns.findIndex(b => b.dataset.mode === m));
  modes.querySelector('.seg-thumb').style.setProperty('--i', btns.findIndex(b => b.dataset.mode === m));
};
modes.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
toggle.addEventListener('click', () => { if (timer) { stop(); status.textContent = 'Paused'; } else start(); });
$('#reset').addEventListener('click', () => setMode(mode));
$('#skip').addEventListener('click', () => setMode(mode === 'focus' ? 'short' : 'focus'));
$('#heroStart').addEventListener('click', () => { $('.timer').scrollIntoView({ behavior: 'smooth', block: 'center' }); if (!timer) setTimeout(start, 350); });
paint();

/* ---------- Flashcards ---------- */
const deck = [
  ['What does mitochondrial DNA get inherited from?', 'Almost always the mother'],
  ['Derivative of sin(x)', 'cos(x)'],
  ['Year the Treaty of Westphalia was signed', '1648'],
  ['Spanish: "I would have gone"', 'Habría ido'],
  ['Big-O of binary search', 'O(log n)']
];
let idx = 0;
const fc = $('#fc'), dots = $('#dots');
deck.forEach(() => dots.appendChild(document.createElement('i')));
const show = () => {
  $('#q').textContent = deck[idx][0]; $('#a').textContent = deck[idx][1];
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i === idx));
};
const next = step => {
  fc.classList.remove('flipped'); fc.classList.add('out');
  setTimeout(() => {
    fc.classList.remove('out'); idx = (idx + step + deck.length) % deck.length; show();
    fc.classList.add('in'); setTimeout(() => fc.classList.remove('in'), 600);
  }, 300);
};
fc.addEventListener('click', () => fc.classList.toggle('flipped'));
fc.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fc.classList.toggle('flipped'); } });
$('#gotit').addEventListener('click', () => next(1));
$('#again').addEventListener('click', () => next(2));
show();

/* ---------- Week chart ---------- */
const week = [['Mon', 62], ['Tue', 90], ['Wed', 45], ['Thu', 110], ['Fri', 75], ['Sat', 30], ['Sun', 55]];
const bars = $('#bars'), max = Math.max(...week.map(w => w[1])), todayI = (new Date().getDay() + 6) % 7;
week.forEach(([d, v], i) => {
  const b = document.createElement('div'); b.className = 'bar' + (i === todayI ? ' today' : ''); b.style.setProperty('--n', i);
  b.innerHTML = `<i data-h="${v / max * 100}" title="${v} min"></i><span>${d}</span>`; bars.appendChild(b);
});
const tot = week.reduce((a, w) => a + w[1], 0);
$('#weekTotal').textContent = `${Math.floor(tot / 60)}h ${tot % 60}m studied`;

/* ---------- Tasks ---------- */
const list = $('#tasks');
const addTask = (text, isDone, pop) => {
  const li = document.createElement('li'); if (isDone) li.classList.add('done'); if (pop) li.classList.add('pop');
  li.innerHTML = '<div class="box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><span></span>';
  li.querySelector('span').textContent = text;
  li.addEventListener('click', () => li.classList.toggle('done'));
  list.appendChild(li);
};
[['Review organic chemistry notes', 1], ['Past paper: calculus 2022', 0], ['Read chapter 6 of Westphalia', 0]].forEach(([t, d]) => addTask(t, d));
const input = $('#newTask');
const submit = () => { const v = input.value.trim(); if (v) { addTask(v, false, true); input.value = ''; } };
$('#addBtn').addEventListener('click', submit);
input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

/* ---------- Scroll reveal ---------- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  e.target.querySelectorAll('.bar i').forEach(i => i.style.height = i.dataset.h + '%');
  io.unobserve(e.target);
}), { threshold: .2 });
document.querySelectorAll('.bento article').forEach((a, i) => { a.classList.add('reveal'); a.style.transitionDelay = i * 90 + 'ms'; io.observe(a); });
})();
