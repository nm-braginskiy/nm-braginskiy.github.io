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
  
  // Добавляем обработчики для изменения placeholder
  const modeInputs = document.querySelectorAll('input[name="mode"]');
  modeInputs.forEach(input => {
    input.addEventListener('change', updatePlaceholder);
  });
  
  updatePlaceholder(); // Устанавливаем начальный placeholder
  syncHighlight();
}

function updatePlaceholder() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const placeholders = {
    'simplify': '-(a * (b + -b)) + (a * c)',
    'invert_simplify': 'a + b * c',
    'sdnf': 'a + b',
    'scnf': 'a * b'
  };
  
  exprInput.placeholder = placeholders[mode] || placeholders['simplify'];
}

function run() {
  const input = document.getElementById('expression').value.trim();
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const errorEl = document.getElementById('error-msg');
  const resultArea = document.getElementById('result-area');
  const stepsList = document.getElementById('steps-list');
  const truthTableArea = document.getElementById('truth-table-area');

  errorEl.hidden = true;
  resultArea.hidden = true;
  truthTableArea.hidden = true;
  stepsList.innerHTML = '';
  lastSteps = [];

  if (!input) { errorEl.textContent = 'Введите выражение'; errorEl.hidden = false; return; }

  try {
    const tokens = tokenize(input);
    let ast = parse(tokens);

    let steps;
    if (mode === 'invert_simplify') {
      // Wrap in NOT, then simplify
      ast = { type: 'not', operand: ast };
      steps = solveAST(ast);
      // Prepend the original expression as step 0
      steps[0].law = 'Инверсия функции';
      steps.unshift({ expr: astToStr(parse(tokenize(input))), law: null });
    } else if (mode === 'sdnf') {
      const { ast: nfAst, str } = buildSDNF(ast);
      const vars = collectVars(ast);
      const alignedStr = renderAlignedNF(str, vars);
      // шаги: исходное выражение → "Построение СДНФ" → результат
      steps = [
        { expr: astToStr(ast), law: null },
        { expr: alignedStr, law: 'Построение СДНФ', isHTML: true }
      ];
    } else if (mode === 'scnf') {
      const { ast: nfAst, str } = buildSCNF(ast);
      const vars = collectVars(ast);
      const alignedStr = renderAlignedNF(str, vars);
      // шаги: исходное выражение → "Построение СКНФ" → результат
      steps = [
        { expr: astToStr(ast), law: null },
        { expr: alignedStr, law: 'Построение СКНФ', isHTML: true }
      ];
    } else {
      // Default: simplify
      steps = solveAST(ast);
    }

    lastSteps = steps;
    for (let i = 0; i < steps.length; i++) {
      const li = document.createElement('li');
      if (i === 0) {
        li.innerHTML = `<span class="step-expr">${highlightExpr(steps[i].expr)}</span>`;
      } else {
        const exprContent = steps[i].isHTML ? steps[i].expr : highlightExpr(steps[i].expr);
        li.innerHTML = `<span class="step-law">${escHtml(steps[i].law)}</span><span class="step-arrow">→</span><span class="step-expr">${exprContent}</span>`;
      }
      stepsList.appendChild(li);
    }
    resultArea.hidden = false;
    
    // Всегда показываем таблицу истинности после решения
    const vars = collectVars(ast);
    const table = buildTruthTable(ast);
    renderTruthTable(vars, table, ast);
  } catch (e) {
    errorEl.textContent = 'Ошибка: ' + e.message;
    errorEl.hidden = false;
  }
}

// ===== COPY SOLUTION =====
function onCopy() {
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
}

// ===== RENDER TRUTH TABLE =====
function renderTruthTable(vars, table, ast) {
  const truthTableArea = document.getElementById('truth-table-area');
  const truthTableContainer = document.getElementById('truth-table-container');
  
  // Проверяем ограничение на количество переменных
  if (vars.length > 8) {
    truthTableContainer.innerHTML = '<p style="color: var(--error); font-weight: 600;">⚠️ Слишком много переменных (больше 8). Таблица истинности будет содержать более 256 строк.</p>';
    truthTableArea.hidden = false;
    return;
  }
  
  // Если нет переменных (константа)
  if (vars.length === 0) {
    const value = table[0].value;
    const cssClass = value === 1 ? 'tt-true' : 'tt-false';
    truthTableContainer.innerHTML = `
      <table class="truth-table">
        <thead>
          <tr>
            <th>${highlightExpr(astToStr(ast))}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="${cssClass}"><span class="hl-const">${value}</span></td>
          </tr>
        </tbody>
      </table>
    `;
    truthTableArea.hidden = false;
    return;
  }
  
  // Создаем HTML таблицы
  let tableHTML = '<table class="truth-table">';
  
  // Заголовки
  tableHTML += '<thead><tr>';
  for (const varName of vars) {
    tableHTML += `<th><span class="hl-var">${varName}</span></th>`;
  }
  tableHTML += `<th>${highlightExpr(astToStr(ast))}</th>`;
  tableHTML += '</tr></thead>';
  
  // Строки данных
  tableHTML += '<tbody>';
  const n = vars.length;
  for (let i = 0; i < (1 << n); i++) {
    tableHTML += '<tr>';
    
    // Значения переменных (читаем биты в обратном порядке для стандартного вида)
    for (let j = 0; j < n; j++) {
      const bitValue = (i >> (n - 1 - j)) & 1;
      tableHTML += `<td><span class="hl-const">${bitValue}</span></td>`;
    }
    
    // Значение функции
    const funcValue = table[i].value;
    const cssClass = funcValue === 1 ? 'tt-true' : 'tt-false';
    tableHTML += `<td class="${cssClass}"><span class="hl-const">${funcValue}</span></td>`;
    
    tableHTML += '</tr>';
  }
  tableHTML += '</tbody></table>';
  
  // Вставляем таблицу в контейнер
  truthTableContainer.innerHTML = tableHTML;
  truthTableArea.hidden = false;
}

// ===== RENDER ALIGNED NORMAL FORMS =====
function renderAlignedNF(expression, vars) {
  // Парсим выражение на термы
  let terms = [];
  let joinOp = '';
  
  if (expression === '0' || expression === '1') {
    return `<div class="nf-constant"><span class="hl-const">${expression}</span></div>`;
  }
  
  // Определяем тип нормальной формы и разбиваем на термы
  if (expression.includes(') * (') || (expression.startsWith('(') && expression.includes(' * '))) {
    // СКНФ - разбиваем по * между скобками
    joinOp = '*';
    terms = expression.split(' * ').map(term => term.replace(/[()]/g, '').split(' + '));
  } else if (expression.includes(' + ')) {
    // СДНФ - разбиваем по +
    joinOp = '+';
    terms = expression.split(' + ').map(term => term.split(' * '));
  } else {
    // Одиночный терм
    terms = [expression.split(' * ')];
    joinOp = '';
  }
  
  // Вычисляем ширину ячейки на основе максимальной длины переменной
  const maxVarLength = vars.reduce((max, varName) => Math.max(max, varName.length), 1);
  const cellWidth = Math.max(28, maxVarLength * 9 + 14);
  
  let html = '<div class="nf-container">';
  
  terms.forEach((term, termIndex) => {
    html += '<div class="nf-row">';
    
    // Добавляем символ соединения (+ или *) для всех строк кроме первой
    if (termIndex > 0) {
      html += `<span class="nf-join"><span class="hl-op">${joinOp}</span></span>`;
    } else {
      html += '<span class="nf-join"></span>'; // пустое место для выравнивания
    }
    
    // Добавляем литералы терма
    term.forEach((literal, litIndex) => {
      const cleanLiteral = literal.trim();
      const isNegated = cleanLiteral.startsWith('-');
      const varName = isNegated ? cleanLiteral.substring(1) : cleanLiteral;
      
      // Ячейка с литералом используя стандартную подсветку
      if (isNegated) {
        html += `<span class="nf-cell" style="min-width: ${cellWidth}px;"><span class="hl-not">-</span><span class="hl-var">${varName}</span></span>`;
      } else {
        html += `<span class="nf-cell" style="min-width: ${cellWidth}px;"><span class="hl-var">${cleanLiteral}</span></span>`;
      }
      
      // Операторы между литералами в терме
      if (litIndex < term.length - 1) {
        const opSymbol = joinOp === '+' ? '*' : '+'; // внутри СДНФ используем *, внутри СКНФ используем +
        html += `<span class="nf-opsym"><span class="hl-op">${opSymbol}</span></span>`;
      }
    });
    
    html += '</div>';
  });
  
  html += '</div>';
  return html;
}

// ===== FORMAT NORMAL FORMS =====
function formatNormalForm(expression) {
  // Разбиваем по + (дизъюнкция) или * между скобками (конъюнкция скобок)
  let formatted = expression;
  
  // Для СДНФ: разбиваем по + между термами
  if (expression.includes(' + ') && !expression.includes('(')) {
    // Простая СДНФ без скобок - разбиваем по +
    formatted = expression.replace(/ \+ /g, ' +\n');
  }
  // Для СКНФ: разбиваем по * между скобками
  else if (expression.includes(') * (')) {
    // СКНФ со скобками - разбиваем по * между скобками
    formatted = expression.replace(/\) \* \(/g, ') *\n(');
  }
  // Смешанные случаи: если есть и скобки и + вне скобок
  else if (expression.includes(' + ') && expression.includes('(')) {
    // Разбиваем по + только если он не внутри скобок
    let result = '';
    let depth = 0;
    let i = 0;
    
    while (i < expression.length) {
      const char = expression[i];
      
      if (char === '(') {
        depth++;
        result += char;
      } else if (char === ')') {
        depth--;
        result += char;
      } else if (char === '+' && depth === 0 && expression[i-1] === ' ' && expression[i+1] === ' ') {
        result += ' +\n';
        i += 2; // пропускаем пробел после +
      } else {
        result += char;
      }
      i++;
    }
    formatted = result;
  }
  
  return formatted;
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
if (document.getElementById('expression')) {
  initUI();
  
  // Автозапуск тестов при инициализации
  // setTimeout(() => {
  //   console.log('%c🧪 АВТОЗАПУСК ТЕСТОВ ПРИ ИНИЦИАЛИЗАЦИИ', 'background: #2196F3; color: white; font-size: 16px; padding: 8px; font-weight: bold;');
  //   console.log('Проверка алгоритмов СДНФ и СКНФ...\n');
    
  //   // Запускаем основные тесты
  //   console.log('🔧 Основные тесты режимов:');
  //   test();
    
  //   console.log('\n' + '='.repeat(60) + '\n');
    
  //   // Запускаем автотесты нормальных форм
  //   console.log('⚡ Автотесты СДНФ и СКНФ:');
  //   testNormalForms();
    
  //   console.log('\n%c✅ Автотесты завершены. Приложение готово к работе!', 'background: #4CAF50; color: white; padding: 5px; font-weight: bold;');
  // }, 500);
}
