// ===== TOKENIZER =====
// Converts input string into token array
// Token types: LPAREN, RPAREN, OP (with value), NOT, CONST (with value), VAR (with value)

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] === ' ') { i++; continue; }
    if (input[i] === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (input[i] === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
    if (input[i] === '-' && input[i + 1] === '>') { tokens.push({ type: 'OP', value: 'imp' }); i += 2; continue; }
    if (input[i] === '<' && input[i + 1] === '-' && input[i + 2] === '>') { tokens.push({ type: 'OP', value: 'eqv' }); i += 3; continue; }
    if (input[i] === '!' && input[i + 1] === '!' && input[i + 2] === '+') { tokens.push({ type: 'OP', value: 'nor' }); i += 3; continue; }
    if (input[i] === '!' && input[i + 1] === '+') { tokens.push({ type: 'OP', value: 'xor' }); i += 2; continue; }
    if (input[i] === '!' && input[i + 1] === '*') { tokens.push({ type: 'OP', value: 'nand' }); i += 2; continue; }
    if (input[i] === '*') { tokens.push({ type: 'OP', value: 'and' }); i++; continue; }
    if (input[i] === '+') { tokens.push({ type: 'OP', value: 'or' }); i++; continue; }
    if (input[i] === '-') { tokens.push({ type: 'NOT' }); i++; continue; }
    if (input[i] === '0') { tokens.push({ type: 'CONST', value: 0 }); i++; continue; }
    if (input[i] === '1') { tokens.push({ type: 'CONST', value: 1 }); i++; continue; }
    if (/[a-zA-Z]/.test(input[i])) {
      let name = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) { name += input[i]; i++; }
      tokens.push({ type: 'VAR', value: name });
      continue;
    }
    throw new Error(`Неизвестный символ: '${input[i]}' на позиции ${i}`);
  }
  return tokens;
}
