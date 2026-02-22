// ===== TOKENIZER =====
// Converts input string into token array
// Token types: LPAREN, RPAREN, OP (with value), NOT, CONST (with value), VAR (with value)

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (char === ' ') { i++; continue; }
    if (char === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (char === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }

    // Операторы (сначала длинные)
    if (input.startsWith('<->', i)) { tokens.push({ type: 'OP', value: 'eqv' }); i += 3; continue; }
    if (input.startsWith('->', i))  { tokens.push({ type: 'OP', value: 'imp' }); i += 2; continue; }
    if (input.startsWith('!!+', i)) { tokens.push({ type: 'OP', value: 'nor' }); i += 3; continue; }
    if (input.startsWith('!+', i))  { tokens.push({ type: 'OP', value: 'xor' }); i += 2; continue; }
    if (input.startsWith('!*', i))  { tokens.push({ type: 'OP', value: 'nand' }); i += 2; continue; }
    if (char === '*') { tokens.push({ type: 'OP', value: 'and' }); i++; continue; }
    if (char === '+') { tokens.push({ type: 'OP', value: 'or' }); i++; continue; }
    if (char === '-') { tokens.push({ type: 'NOT' }); i++; continue; }
    if (char === '0') { tokens.push({ type: 'CONST', value: 0 }); i++; continue; }
    if (char === '1') { tokens.push({ type: 'CONST', value: 1 }); i++; continue; }

    // Переменные: считываем только ОДНУ букву
    if (/[a-zA-Z]/.test(char)) {
      tokens.push({ type: 'VAR', value: char });
      i++;
      continue;
    }

    throw new Error(`Неизвестный символ: '${char}'`);
  }

  // --- Вставка неявного умножения ---
  const result = [];
  for (let j = 0; j < tokens.length; j++) {
    result.push(tokens[j]);

    if (j < tokens.length - 1) {
      const curr = tokens[j];
      const next = tokens[j + 1];

      // VAR VAR, VAR LPAREN, CONST VAR, CONST LPAREN,
      // RPAREN VAR, RPAREN LPAREN, RPAREN CONST
      const needsMult =
        ((curr.type === 'VAR' || curr.type === 'CONST') &&
         (next.type === 'VAR' || next.type === 'LPAREN')) ||
        (curr.type === 'RPAREN' &&
         (next.type === 'VAR' || next.type === 'LPAREN' || next.type === 'CONST'));

      if (needsMult) {
        result.push({ type: 'OP', value: 'and', implicit: true });
      }
    }
  }

  return result;
}
