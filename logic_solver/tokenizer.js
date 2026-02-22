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
  
  // Auto-insert implicit multiplication
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    result.push(tokens[i]);
    
    // Check if we need to insert implicit multiplication
    if (i < tokens.length - 1) {
      const curr = tokens[i];
      const next = tokens[i + 1];
      
      // Cases where implicit multiplication should be inserted:
      // VAR followed by VAR: ab -> a * b
      // VAR followed by LPAREN: a( -> a * (
      // CONST followed by VAR: 1a -> 1 * a
      // CONST followed by LPAREN: 1( -> 1 * (
      // RPAREN followed by VAR: )a -> ) * a
      // RPAREN followed by LPAREN: )( -> ) * (
      // RPAREN followed by CONST: )1 -> ) * 1
      
      const needsMultiplication = 
        (curr.type === 'VAR' && (next.type === 'VAR' || next.type === 'LPAREN')) ||
        (curr.type === 'CONST' && (next.type === 'VAR' || next.type === 'LPAREN')) ||
        (curr.type === 'RPAREN' && (next.type === 'VAR' || next.type === 'LPAREN' || next.type === 'CONST'));
      
      if (needsMultiplication) {
        result.push({ type: 'OP', value: 'and', implicit: true });
      }
    }
  }
  
  return result;
}
