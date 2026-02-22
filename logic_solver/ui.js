// ===== UI =====
document.getElementById('solve-btn').addEventListener('click', run);
document.getElementById('expression').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') run();
});

let lastSteps = [];

function run() {
  const input = document.getElementById('expression').value.trim();
  const errorEl = document.getElementById('error-msg');
  const resultArea = document.getElementById('result-area');
  const stepsList = document.getElementById('steps-list');

  errorEl.hidden = true;
  resultArea.hidden = true;
  stepsList.innerHTML = '';
  lastSteps = [];

  if (!input) { errorEl.textContent = 'Введите выражение'; errorEl.hidden = false; return; }

  try {
    const steps = solve(input);
    lastSteps = steps;
    for (let i = 0; i < steps.length; i++) {
      const li = document.createElement('li');
      if (i === 0) {
        li.innerHTML = `<span class="step-expr">${highlightExpr(steps[i].expr)}</span>`;
      } else {
        li.innerHTML = `<span class="step-law">${escHtml(steps[i].law)}</span><span class="step-arrow">→</span><span class="step-expr">${highlightExpr(steps[i].expr)}</span>`;
      }
      stepsList.appendChild(li);
    }
    resultArea.hidden = false;
  } catch (e) {
    errorEl.textContent = 'Ошибка: ' + e.message;
    errorEl.hidden = false;
  }
}

// ===== COPY SOLUTION =====
document.getElementById('copy-btn').addEventListener('click', () => {
  if (lastSteps.length === 0) return;
  const lines = ['Пошаговое решение'];
  for (let i = 0; i < lastSteps.length; i++) {
    if (i === 0) {
      lines.push(lastSteps[i].expr);
    } else {
      lines.push(lastSteps[i].law);
      lines.push('→' + lastSteps[i].expr);
    }
  }
  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-btn');
    const original = btn.textContent;
    btn.textContent = 'Скопировано!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
});

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
      let name = '';
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) { name += s[i]; i++; }
      result += `<span class="hl-var">${name}</span>`;
      continue;
    }

    result += s[i];
    i++;
  }
  return result;
}

// ===== ADD IMPLICIT MULTIPLICATION HINTS =====
function addImplicitMultiplication(raw) {
  let result = '';
  let i = 0;
  
  while (i < raw.length) {
    const char = raw[i];
    result += char;
    
    if (i < raw.length - 1) {
      const next = raw[i + 1];
      
      // Check if we need to insert implicit multiplication hint
      const isVarOrConst = (c) => /[a-zA-Z0-9]/.test(c);
      const isOpenParen = (c) => c === '(';
      const isCloseParen = (c) => c === ')';
      
      let needsMultiplication = false;
      
      // VAR/CONST followed by VAR/CONST or LPAREN
      if (isVarOrConst(char) && !raw[i - 1]?.match(/[a-zA-Z0-9_]/) && (isVarOrConst(next) || isOpenParen(next))) {
        needsMultiplication = true;
      }
      // RPAREN followed by VAR/CONST or LPAREN
      else if (isCloseParen(char) && (isVarOrConst(next) || isOpenParen(next))) {
        needsMultiplication = true;
      }
      
      if (needsMultiplication && next !== ' ') {
        result += '<span class="hl-implicit-op"> * </span>';
      }
    }
    
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
    if (raw[i] === ' ') { result += ' '; i++; continue; }

    if (raw[i] === '(') {
      const cls = bracketColors[bracketDepth % bracketColors.length];
      const active = (i === activeOpen) ? ' hl-bracket-active' : '';
      result += `<span class="hl-bracket ${cls}${active}">(</span>`;
      bracketDepth++;
      i++;
      continue;
    }

    if (raw[i] === ')') {
      bracketDepth--;
      if (bracketDepth < 0) bracketDepth = 0;
      const cls = bracketColors[bracketDepth % bracketColors.length];
      const active = (i === activeClose) ? ' hl-bracket-active' : '';
      result += `<span class="hl-bracket ${cls}${active}">)</span>`;
      i++;
      
      // Check if we need to insert implicit multiplication hint after )
      if (i < raw.length && raw[i] !== ' ') {
        const next = raw[i];
        if (/[a-zA-Z0-9]/.test(next) || next === '(') {
          result += '<span class="hl-implicit-op"> * </span>';
        }
      }
      continue;
    }

    // <->
    if (raw[i] === '<' && raw[i + 1] === '-' && raw[i + 2] === '>') {
      result += '<span class="hl-op">&lt;-&gt;</span>';
      i += 3;
      continue;
    }

    // ->
    if (raw[i] === '-' && raw[i + 1] === '>') {
      result += '<span class="hl-op">-&gt;</span>';
      i += 2;
      continue;
    }

    if (raw[i] === '!' && raw[i + 1] === '!' && raw[i + 2] === '+') {
      result += '<span class="hl-op">!!+</span>';
      i += 3;
      continue;
    }

    if (raw[i] === '!' && raw[i + 1] === '+') {
      result += '<span class="hl-op">!+</span>';
      i += 2;
      continue;
    }

    if (raw[i] === '!' && raw[i + 1] === '*') {
      result += '<span class="hl-op">!*</span>';
      i += 2;
      continue;
    }

    if (raw[i] === '*' || raw[i] === '+') {
      result += `<span class="hl-op">${raw[i]}</span>`;
      i++;
      continue;
    }

    if (raw[i] === '-') {
      result += '<span class="hl-not">-</span>';
      i++;
      continue;
    }

    if (raw[i] === '0' || raw[i] === '1') {
      result += `<span class="hl-const">${raw[i]}</span>`;
      i++;
      
      // Check if we need to insert implicit multiplication hint after constant
      if (i < raw.length && raw[i] !== ' ') {
        const next = raw[i];
        if (/[a-zA-Z]/.test(next) || next === '(') {
          result += '<span class="hl-implicit-op"> * </span>';
        }
      }
      continue;
    }

    if (/[a-zA-Z]/.test(raw[i])) {
      let name = '';
      let startPos = i;
      while (i < raw.length && /[a-zA-Z0-9_]/.test(raw[i])) { name += raw[i]; i++; }
      result += `<span class="hl-var">${name}</span>`;
      
      // Check if we need to insert implicit multiplication hint after this variable
      if (i < raw.length && raw[i] !== ' ') {
        const next = raw[i];
        if (/[a-zA-Z0-9]/.test(next) || next === '(') {
          result += '<span class="hl-implicit-op"> * </span>';
        }
      }
      continue;
    }

    result += escHtml(raw[i]);
    i++;
  }
  return result;
}

// ===== INPUT HIGHLIGHT SYNC =====
const exprInput = document.getElementById('expression');
const highlightDiv = document.getElementById('input-highlight');

function syncHighlight() {
  const val = exprInput.value;
  const pos = exprInput.selectionStart;
  const pair = findEnclosingBrackets(val, pos);
  const openPos = pair ? pair.open : -1;
  const closePos = pair ? pair.close : -1;
  highlightDiv.innerHTML = highlightInput(val, openPos, closePos) + '\u00a0';
}

exprInput.addEventListener('input', syncHighlight);
exprInput.addEventListener('keyup', syncHighlight);
exprInput.addEventListener('click', syncHighlight);
exprInput.addEventListener('scroll', () => {
  highlightDiv.scrollLeft = exprInput.scrollLeft;
});

// Initial sync
syncHighlight();

// ===== AUTO-BRACKET & SMART DELETE =====
exprInput.addEventListener('keydown', (e) => {
  const pos = exprInput.selectionStart;
  const val = exprInput.value;

  // Auto-close bracket
  if (e.key === '(') {
    e.preventDefault();
    const before = val.slice(0, pos);
    const after = val.slice(pos);
    exprInput.value = before + '()' + after;
    exprInput.setSelectionRange(pos + 1, pos + 1);
    syncHighlight();
    return;
  }

  // Skip over closing bracket if already there
  if (e.key === ')' && val[pos] === ')') {
    e.preventDefault();
    exprInput.setSelectionRange(pos + 1, pos + 1);
    return;
  }

  // Smart delete: if cursor is between (), delete both
  if (e.key === 'Backspace' && pos > 0 && val[pos - 1] === '(' && val[pos] === ')') {
    e.preventDefault();
    exprInput.value = val.slice(0, pos - 1) + val.slice(pos + 1);
    exprInput.setSelectionRange(pos - 1, pos - 1);
    syncHighlight();
    return;
  }

  // Auto-expand <> to <->: when typing > after <, insert - between them
  if (e.key === '>' && pos > 0 && val[pos - 1] === '<') {
    e.preventDefault();
    const before = val.slice(0, pos);
    const after = val.slice(pos);
    exprInput.value = before + '->' + after;
    exprInput.setSelectionRange(pos + 2, pos + 2);
    syncHighlight();
    return;
  }
});
