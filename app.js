const defaults = {
  R: 1,
  L: 1,
  C: 0.25,
  inputType: "step"
};

const state = { ...defaults };

const els = {
  rRange: document.getElementById("rRange"),
  lRange: document.getElementById("lRange"),
  cRange: document.getElementById("cRange"),
  rNumber: document.getElementById("rNumber"),
  lNumber: document.getElementById("lNumber"),
  cNumber: document.getElementById("cNumber"),
  rValue: document.getElementById("rValue"),
  lValue: document.getElementById("lValue"),
  cValue: document.getElementById("cValue"),
  resetBtn: document.getElementById("resetBtn"),
  runBtn: document.getElementById("runBtn"),
  transferText: document.getElementById("transferText"),
  polesText: document.getElementById("polesText"),
  stabilityText: document.getElementById("stabilityText"),
  dampingText: document.getElementById("dampingText"),
  waveCanvas: document.getElementById("waveCanvas"),
  poleCanvas: document.getElementById("poleCanvas"),
  previewWaveCanvas: document.getElementById("previewWaveCanvas"),
  previewPoleCanvas: document.getElementById("previewPoleCanvas"),
  slideGrid: document.getElementById("slideGrid"),
  previewModal: document.getElementById("previewModal"),
  modalImage: document.getElementById("modalImage"),
  modalCaption: document.getElementById("modalCaption"),
  modalClose: document.getElementById("modalClose")
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value, digits = 4) {
  if (Math.abs(value) < 1e-10) return "0";
  return Number(value).toFixed(digits);
}

function compactNumber(value, digits = 3) {
  if (Math.abs(value) < 1e-10) return "0";
  const fixed = Number(value).toFixed(digits);
  return fixed.replace(/\.?0+$/, "");
}

function readControlValue(input) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : Number(input.min);
}

function setStateFromControls() {
  state.R = clamp(readControlValue(els.rNumber), 0.1, 8);
  state.L = clamp(readControlValue(els.lNumber), 0.1, 5);
  state.C = clamp(readControlValue(els.cNumber), 0.05, 2);
  state.inputType = document.querySelector("input[name='inputType']:checked").value;
}

function syncControls() {
  els.rRange.value = state.R;
  els.lRange.value = state.L;
  els.cRange.value = state.C;
  els.rNumber.value = state.R;
  els.lNumber.value = state.L;
  els.cNumber.value = state.C;
  els.rValue.textContent = `${state.R.toFixed(2)} Ω`;
  els.lValue.textContent = `${state.L.toFixed(2)} H`;
  els.cValue.textContent = `${state.C.toFixed(2)} F`;
  document.querySelector(`input[name='inputType'][value='${state.inputType}']`).checked = true;
}

function calculatePoles(R, L, C) {
  const a = R / L;
  const b = 1 / (L * C);
  const discriminant = a * a - 4 * b;

  if (discriminant > 1e-10) {
    const root = Math.sqrt(discriminant);
    return [
      { re: (-a + root) / 2, im: 0 },
      { re: (-a - root) / 2, im: 0 }
    ];
  }

  if (Math.abs(discriminant) <= 1e-10) {
    return [
      { re: -a / 2, im: 0 },
      { re: -a / 2, im: 0 }
    ];
  }

  return [
    { re: -a / 2, im: Math.sqrt(-discriminant) / 2 },
    { re: -a / 2, im: -Math.sqrt(-discriminant) / 2 }
  ];
}

function formatPoles(poles) {
  if (Math.abs(poles[0].im) > 1e-8) {
    return `s=${formatNumber(poles[0].re)} ± j${formatNumber(Math.abs(poles[0].im))}`;
  }

  if (Math.abs(poles[0].re - poles[1].re) < 1e-8) {
    return `s₁=s₂=${formatNumber(poles[0].re)}`;
  }

  return `s₁=${formatNumber(poles[0].re)}, s₂=${formatNumber(poles[1].re)}`;
}

function formatPolesLatex(poles) {
  if (Math.abs(poles[0].im) > 1e-8) {
    return `\\(s=${formatNumber(poles[0].re)}\\pm j${formatNumber(Math.abs(poles[0].im))}\\)`;
  }

  if (Math.abs(poles[0].re - poles[1].re) < 1e-8) {
    return `\\(s_1=s_2=${formatNumber(poles[0].re)}\\)`;
  }

  return `\\(s_1=${formatNumber(poles[0].re)},\\;s_2=${formatNumber(poles[1].re)}\\)`;
}

function typesetMath(elements) {
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise(elements).catch(() => {});
  }
}

function classifyDamping(poles) {
  if (Math.abs(poles[0].im) > 1e-8) return "欠阻尼：共轭复极点";
  if (Math.abs(poles[0].re - poles[1].re) < 1e-8) return "临界阻尼：重复实极点";
  return "过阻尼：两个实极点";
}

function inputValue(t, inputType) {
  if (inputType === "step") return 1;
  const pulseWidth = 0.04;
  return t <= pulseWidth ? 1 / pulseWidth : 0;
}

function derivatives(t, x, params) {
  const u = inputValue(t, params.inputType);
  const di = (u - params.R * x.i - x.v) / params.L;
  const dv = x.i / params.C;
  return { di, dv };
}

function rk4Step(t, x, dt, params) {
  const k1 = derivatives(t, x, params);
  const k2 = derivatives(t + dt / 2, {
    i: x.i + k1.di * dt / 2,
    v: x.v + k1.dv * dt / 2
  }, params);
  const k3 = derivatives(t + dt / 2, {
    i: x.i + k2.di * dt / 2,
    v: x.v + k2.dv * dt / 2
  }, params);
  const k4 = derivatives(t + dt, {
    i: x.i + k3.di * dt,
    v: x.v + k3.dv * dt
  }, params);

  return {
    i: x.i + (dt / 6) * (k1.di + 2 * k2.di + 2 * k3.di + k4.di),
    v: x.v + (dt / 6) * (k1.dv + 2 * k2.dv + 2 * k3.dv + k4.dv)
  };
}

function simulate(params) {
  const duration = params.inputType === "step" ? 10 : 8;
  const dt = 0.005;
  const samples = [];
  let x = { i: 0, v: 0 };

  for (let t = 0; t <= duration; t += dt) {
    samples.push({ t, v: x.v, u: inputValue(t, params.inputType) });
    x = rk4Step(t, x, dt, params);
  }

  return samples;
}

function drawGrid(ctx, width, height, padding) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(37, 99, 235, 0.1)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 10; i += 1) {
    const x = padding.left + ((width - padding.left - padding.right) * i) / 10;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
  }

  for (let i = 0; i <= 8; i += 1) {
    const y = padding.top + ((height - padding.top - padding.bottom) * i) / 8;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }
}

function drawWave(samples, params, targetCanvas = els.waveCanvas) {
  const canvas = targetCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = { left: 58, right: 28, top: 28, bottom: 46 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const values = samples.map((point) => point.v);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(params.inputType === "step" ? 1 : 0, ...values);
  const span = Math.max(maxValue - minValue, 0.5);
  const yMin = minValue - span * 0.12;
  const yMax = maxValue + span * 0.12;
  const tMax = samples[samples.length - 1].t;

  drawGrid(ctx, width, height, padding);

  const xOf = (t) => padding.left + (t / tMax) * plotW;
  const yOf = (v) => padding.top + ((yMax - v) / (yMax - yMin)) * plotH;

  ctx.strokeStyle = "#173b68";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding.left, yOf(0));
  ctx.lineTo(width - padding.right, yOf(0));
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.stroke();

  if (params.inputType === "step") {
    ctx.strokeStyle = "rgba(16, 185, 129, 0.7)";
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(padding.left, yOf(1));
    ctx.lineTo(width - padding.right, yOf(1));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 3;
  ctx.beginPath();
  samples.forEach((point, index) => {
    const x = xOf(point.t);
    const y = yOf(point.v);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#102033";
  ctx.font = "700 15px Microsoft YaHei, Arial";
  ctx.fillText("t / s", width - 62, height - 14);
  ctx.fillText("vC(t)", 16, 24);
  ctx.fillStyle = "#5d708a";
  ctx.font = "13px Microsoft YaHei, Arial";
  ctx.fillText(`输入：${params.inputType === "step" ? "阶跃 u(t)=1" : "冲激近似，面积约为 1"}`, padding.left, height - 14);
  ctx.fillText(`${formatNumber(yMax, 2)}`, 12, padding.top + 6);
  ctx.fillText(`${formatNumber(yMin, 2)}`, 12, height - padding.bottom);
}

function drawPolePlot(poles, targetCanvas = els.poleCanvas) {
  const canvas = targetCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = { left: 54, right: 26, top: 28, bottom: 42 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const maxAbsRe = Math.max(1, ...poles.map((p) => Math.abs(p.re))) * 1.35;
  const maxAbsIm = Math.max(1, ...poles.map((p) => Math.abs(p.im))) * 1.35;
  const xMin = -Math.max(1, maxAbsRe * 1.2);
  const xMax = Math.max(1, maxAbsRe * 0.45);
  const yMin = -maxAbsIm;
  const yMax = maxAbsIm;

  drawGrid(ctx, width, height, padding);

  const xOf = (re) => padding.left + ((re - xMin) / (xMax - xMin)) * plotW;
  const yOf = (im) => padding.top + ((yMax - im) / (yMax - yMin)) * plotH;
  const xAxis = yOf(0);
  const yAxis = xOf(0);

  ctx.strokeStyle = "#173b68";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(padding.left, xAxis);
  ctx.lineTo(width - padding.right, xAxis);
  ctx.moveTo(yAxis, padding.top);
  ctx.lineTo(yAxis, height - padding.bottom);
  ctx.stroke();

  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 3;
  poles.forEach((pole) => {
    const x = xOf(pole.re);
    const y = yOf(pole.im);
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 9);
    ctx.lineTo(x + 9, y + 9);
    ctx.moveTo(x + 9, y - 9);
    ctx.lineTo(x - 9, y + 9);
    ctx.stroke();
  });

  ctx.fillStyle = "#102033";
  ctx.font = "700 15px Microsoft YaHei, Arial";
  ctx.fillText("Re(s)", width - 72, xAxis - 10);
  ctx.fillText("Im(s)", yAxis + 8, padding.top + 16);
  ctx.fillStyle = "#5d708a";
  ctx.font = "13px Microsoft YaHei, Arial";
  ctx.fillText("○ 零点：无有限零点", padding.left, height - 16);
  ctx.fillText("× 极点", width - 86, height - 16);
}

function updateText(params, poles) {
  const numerator = 1 / (params.L * params.C);
  const sCoeff = params.R / params.L;
  const sTerm = Math.abs(sCoeff - 1) < 1e-10 ? "s" : `${compactNumber(sCoeff)}s`;
  els.transferText.innerHTML = `\\(H(s)=\\frac{${compactNumber(numerator)}}{s^2+${sTerm}+${compactNumber(numerator)}}\\)`;
  els.polesText.innerHTML = formatPolesLatex(poles);
  els.dampingText.textContent = classifyDamping(poles);

  const stable = poles.every((pole) => pole.re < 0);
  els.stabilityText.textContent = stable ? "稳定：极点实部均小于 0" : "不稳定：存在非负实部极点";
  typesetMath([els.transferText, els.polesText]);
}

function updateSimulation() {
  setStateFromControls();
  syncControls();
  const poles = calculatePoles(state.R, state.L, state.C);
  const samples = simulate(state);
  updateText(state, poles);
  drawWave(samples, state);
  drawPolePlot(poles);
  drawWave(samples, state, els.previewWaveCanvas);
  drawPolePlot(poles, els.previewPoleCanvas);
}

function bindParamPair(range, number, key) {
  range.addEventListener("input", () => {
    state[key] = Number(range.value);
    number.value = state[key];
    updateSimulation();
  });

  number.addEventListener("input", () => {
    state[key] = clamp(readControlValue(number), Number(number.min), Number(number.max));
    range.value = state[key];
    updateSimulation();
  });
}

function buildSlides() {
  for (let i = 1; i <= 12; i += 1) {
    const number = String(i).padStart(2, "0");
    const src = `assets/slides/slide_${number}.png`;
    const card = document.createElement("button");
    card.className = "slide-card";
    card.type = "button";
    card.innerHTML = `<img src="${src}" alt="第 ${i} 张 PPT 幻灯片"><span>Slide ${number}</span>`;
    card.addEventListener("click", () => openModal(src, `Slide ${number}`));
    els.slideGrid.appendChild(card);
  }
}

function openModal(src, caption) {
  els.modalImage.src = src;
  els.modalCaption.textContent = caption;
  els.previewModal.classList.add("is-open");
  els.previewModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  els.previewModal.classList.remove("is-open");
  els.previewModal.setAttribute("aria-hidden", "true");
  els.modalImage.src = "";
}

function init() {
  bindParamPair(els.rRange, els.rNumber, "R");
  bindParamPair(els.lRange, els.lNumber, "L");
  bindParamPair(els.cRange, els.cNumber, "C");

  document.querySelectorAll("input[name='inputType']").forEach((radio) => {
    radio.addEventListener("change", updateSimulation);
  });

  els.runBtn.addEventListener("click", updateSimulation);
  els.resetBtn.addEventListener("click", () => {
    Object.assign(state, defaults);
    syncControls();
    updateSimulation();
  });

  els.modalClose.addEventListener("click", closeModal);
  els.previewModal.addEventListener("click", (event) => {
    if (event.target === els.previewModal) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  buildSlides();
  syncControls();
  updateSimulation();
}

init();
