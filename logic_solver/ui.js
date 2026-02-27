// ===== UI =====
let lastSteps = [];
let exprInput, highlightDiv, lastVal;

function initUI() {
  exprInput = document.getElementById('expression');
  highlightDiv = document.getElementById('input-highlight');
  lastVal = exprInput.value;
  lastSteps = [];

  document.getElementById('solve-btn').addEventListener('click', run);
  exprInput.addEventListener('keydown', onKeydown);
  exprInput.addEventListener('beforeinput', onBeforeinput);
  exprInput.addEventListener('input', onInput);
  exprInput.addEventListener('keyup', syncHighlight);
  exprInput.addEventListener('click', syncHighlight);
  exprInput.addEventListener('scroll', () => {
    highlightDiv.scrollLeft = exprInput.scrollLeft;
  });
  document.getElementById('copy-btn').addEventListener('click', onCopy);
  document.getElementById('group-toggle').addEventListener('change', () => {
    if (lastSteps.length > 0) renderSteps(lastSteps);
  });
  syncHighlight();
}

// ===== STEP GROUPING =====
// Merges consecutive steps with the same base law name into one, keeping the final expression.
// Base name = everything before the first ':' (e.g. "Закон де Моргана" for both variants).
function lawBaseName(law) {
  const colon = law.indexOf(':');
  return colon !== -1 ? law.slice(0, colon).trim() : law;
}

function groupSteps(steps) {
  if (steps.length === 0) return steps;
  const result = [steps[0]]; // step 0 has no law — always kept as-is
  let i = 1;
  while (i < steps.length) {
    const baseName = lawBaseName(steps[i].law);
    let count = 1;
    while (i + count < steps.length && lawBaseName(steps[i + count].law) === baseName) {
      count++;
    }
    // If merged — show short base name; if single step — keep full law name
    const law = count > 1 ? baseName : steps[i].law;
    result.push({
      expr: steps[i + count - 1].expr,
      law,
      count: count > 1 ? count : null,
    });
    i += count;
  }
  return result;
}

// ===== RENDER STEPS =====
function renderSteps(steps) {
  const groupEl = document.getElementById('group-toggle');
  const displaySteps = groupEl && groupEl.checked ? groupSteps(steps) : steps;

  const stepsList = document.getElementById('steps-list');
  stepsList.innerHTML = '';

  for (let i = 0; i < displaySteps.length; i++) {
    const step = displaySteps[i];
    const li = document.createElement('li');
    if (i === 0) {
      li.innerHTML = `<span class="step-expr">${highlightExpr(step.expr)}</span>`;
    } else {
      const countBadge = step.count
        ? `<span class="step-count">×${step.count}</span>`
        : '';
      li.innerHTML =
        `<span class="step-law">${escHtml(step.law)}</span>` +
        `${countBadge}` +
        `<span class="step-arrow-wrap"><span class="step-arrow">=&gt;</span>` +
        `<span class="step-expr">${highlightExpr(step.expr)}</span></span>`;
    }
    stepsList.appendChild(li);
  }
}

function run() {
  const input = document.getElementById('expression').value.trim();
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const errorEl = document.getElementById('error-msg');
  const resultArea = document.getElementById('result-area');

  errorEl.hidden = true;
  resultArea.hidden = true;
  lastSteps = [];

  if (!input) { errorEl.textContent = 'Введите выражение'; errorEl.hidden = false; return; }

  try {
    const tokens = tokenize(input);
    let ast = parse(tokens);

    let steps;
    if (mode === 'invert') {
      // Just wrap in NOT, no simplification
      ast = { type: 'not', operand: ast };
      steps = [
        { expr: astToStr(parse(tokenize(input))), law: null },
        { expr: astToStr(ast), law: 'Инверсия функции' }
      ];
    } else if (mode === 'invert_simplify') {
      // Wrap in NOT, then simplify
      ast = { type: 'not', operand: ast };
      steps = solveAST(ast);
      // Prepend the original expression as step 0
      steps[0].law = 'Инверсия функции';
      steps.unshift({ expr: astToStr(parse(tokenize(input))), law: null });
    } else {
      // Default: simplify
      steps = solveAST(ast);
    }

    lastSteps = steps;
    renderSteps(steps);
    resultArea.hidden = false;
  } catch (e) {
    errorEl.textContent = 'Ошибка: ' + e.message;
    errorEl.hidden = false;
  }
}

// ===== COPY SOLUTION =====
function onCopy() {
  if (lastSteps.length === 0) return;
  const groupEl = document.getElementById('group-toggle');
  const steps = groupEl && groupEl.checked ? groupSteps(lastSteps) : lastSteps;
  const lines = ['Пошаговое решение'];
  for (let i = 0; i < steps.length; i++) {
    if (i === 0) {
      lines.push(steps[i].expr);
    } else {
      const countSuffix = steps[i].count ? ` (×${steps[i].count})` : '';
      lines.push(steps[i].law + countSuffix);
      lines.push('=>' + steps[i].expr);
    }
  }
  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-btn');
    const original = btn.textContent;
    btn.textContent = 'Скопировано!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== SYNTAX HIGHLIGHTING =====
function highlightExpr(raw) {
  const s = escHtml(raw);
  let result = '';
  let i = 0;
  let bracketDepth = 0;
  const bracketColors = ['bracket-0', 'bracket-1', 'bracket-2', 'bracket-3', 'bracket-4'];

  while (i < s.length) {
    if (s[i] === ' ') { result += ' '; i++; continue; }

    if (s[i] === '(') {
      const cls = bracketColors[bracketDepth % bracketColors.length];
      result += `<span class="hl-bracket ${cls}">(</span>`;
      bracketDepth++;
      i++;
      continue;
    }

    if (s[i] === ')') {
      bracketDepth--;
      if (bracketDepth < 0) bracketDepth = 0;
      const cls = bracketColors[bracketDepth % bracketColors.length];
      result += `<span class="hl-bracket ${cls}">)</span>`;
      i++;
      continue;
    }

    // &lt;-&gt; is the escaped form of <->
    if (s.startsWith('&lt;-&gt;', i)) {
      result += '<span class="hl-op">&lt;-&gt;</span>';
      i += 9;
      continue;
    }

    // -&gt; is the escaped form of ->
    if (s.startsWith('-&gt;', i)) {
      result += '<span class="hl-op">-&gt;</span>';
      i += 5;
      continue;
    }

    if (s[i] === '!' && s[i + 1] === '!' && s[i + 2] === '+') {
      result += '<span class="hl-op">!!+</span>';
      i += 3;
      continue;
    }

    if (s[i] === '!' && s[i + 1] === '+') {
      result += '<span class="hl-op">!+</span>';
      i += 2;
      continue;
    }

    if (s[i] === '!' && s[i + 1] === '*') {
      result += '<span class="hl-op">!*</span>';
      i += 2;
      continue;
    }

    if (s[i] === '*' || s[i] === '+') {
      result += `<span class="hl-op">${s[i]}</span>`;
      i++;
      continue;
    }

    if (s[i] === '-') {
      result += '<span class="hl-not">-</span>';
      i++;
      continue;
    }

    if (s[i] === '0' || s[i] === '1') {
      result += `<span class="hl-const">${s[i]}</span>`;
      i++;
      continue;
    }

    if (/[a-zA-Z]/.test(s[i])) {
      result += `<span class="hl-var">${s[i]}</span>`;
      i++;
      continue;
    }

    result += s[i];
    i++;
  }
  return result;
}

// ===== INPUT HIGHLIGHT (works on raw characters, not HTML-escaped) =====
function findEnclosingBrackets(text, cursorPos) {
  // Find the innermost ( ) pair that contains the cursor
  let openPos = -1;
  let depth = 0;

  // Scan left from cursor to find the matching open bracket
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (text[i] === ')') depth++;
    if (text[i] === '(') {
      if (depth === 0) { openPos = i; break; }
      depth--;
    }
  }
  if (openPos === -1) return null;

  // Scan right from cursor to find the matching close bracket
  depth = 0;
  for (let i = cursorPos; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')') {
      if (depth === 0) return { open: openPos, close: i };
      depth--;
    }
  }
  return null;
}

function highlightInput(raw, activeOpen, activeClose) {
  let result = '';
  let i = 0;
  let bracketDepth = 0;
  const bracketColors = ['bracket-0', 'bracket-1', 'bracket-2', 'bracket-3', 'bracket-4'];

  while (i < raw.length) {
    const char = raw[i];

    if (char === ' ') { result += ' '; i++; continue; }

    if (char === '(') {
      const cls = bracketColors[bracketDepth % bracketColors.length];
      const active = (i === activeOpen) ? ' hl-bracket-active' : '';
      result += `<span class="hl-bracket ${cls}${active}">(</span>`;
      bracketDepth++;
      i++;
      continue;
    }

    if (char === ')') {
      bracketDepth--;
      if (bracketDepth < 0) bracketDepth = 0;
      const cls = bracketColors[bracketDepth % bracketColors.length];
      const active = (i === activeClose) ? ' hl-bracket-active' : '';
      result += `<span class="hl-bracket ${cls}${active}">)</span>`;
      i++;
      continue;
    }

    // Operators
    if (raw.startsWith('<->', i)) { result += '<span class="hl-op">&lt;-&gt;</span>'; i += 3; continue; }
    if (raw.startsWith('->', i)) { result += '<span class="hl-op">-&gt;</span>'; i += 2; continue; }
    if (raw.startsWith('!!+', i)) { result += '<span class="hl-op">!!+</span>'; i += 3; continue; }
    if (raw.startsWith('!+', i)) { result += '<span class="hl-op">!+</span>'; i += 2; continue; }
    if (raw.startsWith('!*', i)) { result += '<span class="hl-op">!*</span>'; i += 2; continue; }
    if (char === '*' || char === '+') { result += `<span class="hl-op">${char}</span>`; i++; continue; }
    if (char === '-') { result += '<span class="hl-not">-</span>'; i++; continue; }

    // Constants
    if (char === '0' || char === '1') { result += `<span class="hl-const">${char}</span>`; i++; continue; }

    // Variables (single letter)
    if (/[a-zA-Z]/.test(char)) {
      result += `<span class="hl-var">${char}</span>`;
      i++;
      continue;
    }

    result += escHtml(char);
    i++;
  }
  return result;
}

// ===== INPUT HIGHLIGHT SYNC =====

function syncHighlight() {
  const val = exprInput.value;
  const pos = exprInput.selectionStart;
  const pair = findEnclosingBrackets(val, pos);
  const openPos = pair ? pair.open : -1;
  const closePos = pair ? pair.close : -1;
  highlightDiv.innerHTML = highlightInput(val, openPos, closePos) + '\u00a0';
}

// ===== HELPER: set value and cursor =====
function setVal(newVal, cursorPos) {
  exprInput.value = newVal;
  exprInput.setSelectionRange(cursorPos, cursorPos);
  syncHighlight();
}

// ===== BEFOREINPUT: character insertion tweaks (works on mobile + desktop) =====
function onBeforeinput(e) {
  const char = e.data;
  if (!char || char.length !== 1) return; // only single-char inserts
  if (e.inputType !== 'insertText' && e.inputType !== 'insertCompositionText') return;

  const pos = exprInput.selectionStart;
  const val = exprInput.value;
  const prev = pos > 0 ? val[pos - 1] : '';

  // --- Operator aliases: & → *, | → +, ~ → - ---
  const alias = { '&': '*', '|': '+', '~': '-' };
  if (alias[char]) {
    e.preventDefault();
    setVal(val.slice(0, pos) + alias[char] + val.slice(pos), pos + 1);
    return;
  }

  // --- V as OR: only in operator position ---
  if (char === 'V' && pos > 0 && (/[a-zA-Z01]/.test(prev) || prev === ')')) {
    e.preventDefault();
    setVal(val.slice(0, pos) + '+' + val.slice(pos), pos + 1);
    return;
  }

  const isPrevVar = /[a-zA-Z]/.test(prev);
  const isPrevConst = /[01]/.test(prev);
  const isPrevClose = prev === ')';

  const isCurrVar = /[a-zA-Z]/.test(char);
  const isCurrConst = /[01]/.test(char);
  const isCurrOpen = char === '(';

  const needsMult =
    ((isPrevVar || isPrevConst) && (isCurrVar || isCurrOpen)) ||
    (isPrevClose && (isCurrVar || isCurrOpen || isCurrConst));

  // --- Deferred subtraction: X-Y → X + -Y ---
  if (!needsMult && (isCurrVar || isCurrConst || isCurrOpen) && prev === '-' && pos >= 2) {
    let scanPos = pos - 2;
    if (scanPos >= 0 && val[scanPos] === ' ') scanPos--;
    if (scanPos >= 0) {
      const ch = val[scanPos];
      if (/[a-zA-Z]/.test(ch) || /[01]/.test(ch) || ch === ')') {
        e.preventDefault();
        const dashPos = pos - 1;
        let cutStart = dashPos;
        if (cutStart > 0 && val[cutStart - 1] === ' ') cutStart--;
        const before = val.slice(0, cutStart);
        const after = val.slice(pos);
        if (char === '(') {
          setVal(before + ' + -()' + after, before.length + 5);
        } else {
          setVal(before + ' + -' + char + after, before.length + 5);
        }
        return;
      }
    }
  }

  // --- Implicit conjunction: ab → a * b ---
  if (needsMult) {
    e.preventDefault();
    const before = val.slice(0, pos);
    const after = val.slice(pos);
    if (char === '(') {
      setVal(before + ' * ()' + after, pos + 4);
    } else {
      setVal(before + ' * ' + char + after, pos + 4);
    }
    return;
  }

  // --- Auto-close bracket ---
  if (char === '(') {
    e.preventDefault();
    setVal(val.slice(0, pos) + '()' + val.slice(pos), pos + 1);
    return;
  }

  // --- Skip over closing bracket ---
  if (char === ')' && val[pos] === ')') {
    e.preventDefault();
    exprInput.setSelectionRange(pos + 1, pos + 1);
    syncHighlight();
    return;
  }

  // --- Auto-expand < + > to <-> ---
  if (char === '>' && prev === '<') {
    e.preventDefault();
    setVal(val.slice(0, pos) + '->' + val.slice(pos), pos + 2);
    return;
  }
}

// ===== KEYDOWN: Backspace tweaks + Enter (works fine on mobile) =====
function onKeydown(e) {
  if (e.key === 'Enter') { run(); return; }
  if (e.key !== 'Backspace') return;

  const pos = exprInput.selectionStart;
  const val = exprInput.value;

  // Smart delete: () pair
  if (pos > 0 && val[pos - 1] === '(' && val[pos] === ')') {
    e.preventDefault();
    setVal(val.slice(0, pos - 1) + val.slice(pos + 1), pos - 1);
    return;
  }

  // Smart delete: <-> — delete entire operator
  if (pos >= 3 && val.slice(pos - 3, pos) === '<->') {
    e.preventDefault();
    setVal(val.slice(0, pos - 3) + val.slice(pos), pos - 3);
    return;
  }

  // Smart delete: !!+ — delete !+ part, keep first !
  if (pos >= 3 && val.slice(pos - 3, pos) === '!!+') {
    e.preventDefault();
    setVal(val.slice(0, pos - 2) + val.slice(pos), pos - 2);
    return;
  }
}

// ===== FALLBACK: input event for IME / mobile keyboards =====
// Catches cases where beforeinput didn't fire (e.g. Android IME composing)
function onInput() {
  const val = exprInput.value;
  const pos = exprInput.selectionStart;

  // Detect single character insertion by comparing with last known value
  if (val.length === lastVal.length + 1 && pos > 0) {
    const inserted = val[pos - 1];
    const prev = pos > 1 ? val[pos - 2] : '';

    const isPrevVar = /[a-zA-Z]/.test(prev);
    const isPrevConst = /[01]/.test(prev);
    const isPrevClose = prev === ')';
    const isCurrVar = /[a-zA-Z]/.test(inserted);
    const isCurrConst = /[01]/.test(inserted);
    const isCurrOpen = inserted === '(';

    const needsMult =
      ((isPrevVar || isPrevConst) && (isCurrVar || isCurrOpen)) ||
      (isPrevClose && (isCurrVar || isCurrOpen || isCurrConst));

    if (needsMult) {
      // Insert " * " before the just-typed character
      const before = val.slice(0, pos - 1);
      const after = val.slice(pos);
      if (inserted === '(') {
        // Also need to auto-close
        setVal(before + ' * ()' + after, before.length + 4);
      } else {
        setVal(before + ' * ' + inserted + after, before.length + 4);
      }
      lastVal = exprInput.value;
      return;
    }

    // Operator aliases fallback
    const alias = { '&': '*', '|': '+', '~': '-' };
    if (alias[inserted]) {
      setVal(val.slice(0, pos - 1) + alias[inserted] + val.slice(pos), pos);
      lastVal = exprInput.value;
      return;
    }
  }

  lastVal = val;
  syncHighlight();
}

// Auto-init when loaded standalone (not via SPA)
if (document.getElementById('expression')) initUI();
