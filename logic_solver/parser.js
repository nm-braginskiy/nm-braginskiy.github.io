// ===== AST Node Types =====
// { type: 'var', name: 'a' }
// { type: 'not', operand: node }
// { type: 'and'|'or'|'xor'|'nand'|'nor'|'imp'|'eqv', left: node, right: node }

// ===== PARSER (Recursive Descent) =====
// Priority: () > NOT > AND > OR/XOR > IMP > EQV
function parse(tokens) {
  let pos = 0;
  function peek() { return tokens[pos] || null; }
  function consume(type) {
    const t = tokens[pos];
    if (!t || t.type !== type) throw new Error(`Ожидался ${type}, получен ${t ? t.type : 'конец'}`);
    pos++;
    return t;
  }

  function parseEqv() {
    let left = parseImp();
    while (peek() && peek().type === 'OP' && peek().value === 'eqv') {
      pos++;
      left = { type: 'eqv', left, right: parseImp() };
    }
    return left;
  }

  function parseImp() {
    let left = parseOrXor();
    while (peek() && peek().type === 'OP' && peek().value === 'imp') {
      pos++;
      left = { type: 'imp', left, right: parseOrXor() };
    }
    return left;
  }

  function parseOrXor() {
    let left = parseAnd();
    while (peek() && peek().type === 'OP' && (peek().value === 'or' || peek().value === 'xor' || peek().value === 'nor')) {
      const op = peek().value;
      pos++;
      left = { type: op, left, right: parseAnd() };
    }
    return left;
  }

  function parseAnd() {
    let left = parseNot();
    while (peek() && peek().type === 'OP' && (peek().value === 'and' || peek().value === 'nand')) {
      const tok = peek();
      const op = tok.value;
      const implicit = !!tok.implicit;
      pos++;
      const node = { type: op, left, right: parseNot() };
      if (implicit) node.implicit = true;
      left = node;
    }
    return left;
  }

  function parseNot() {
    if (peek() && peek().type === 'NOT') {
      pos++;
      return { type: 'not', operand: parseNot() };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('Неожиданный конец выражения');
    if (t.type === 'LPAREN') {
      pos++;
      const node = parseEqv();
      consume('RPAREN');
      return node;
    }
    if (t.type === 'VAR') { pos++; return { type: 'var', name: t.value }; }
    if (t.type === 'CONST') { pos++; return { type: 'const', value: t.value }; }
    throw new Error(`Неожиданный токен: ${t.type}`);
  }

  const result = parseEqv();
  if (pos < tokens.length) throw new Error('Лишние символы после выражения');
  return result;
}

// ===== AST to String =====
function astToStr(node) {
  if (!node) return '?';
  if (node.type === 'var') return node.name;
  if (node.type === 'const') return String(node.value);
  if (node.type === 'not') {
    const inner = astToStr(node.operand);
    if (node.operand.type === 'var' || node.operand.type === 'const' || node.operand.type === 'not')
      return '-' + inner;
    return '-(' + inner + ')';
  }
  const opSymbols = { and: ' * ', or: ' + ', xor: ' !+ ', nand: ' !* ', nor: ' !!+ ', imp: ' -> ', eqv: ' <-> ' };
  const priority = { eqv: 1, imp: 2, or: 3, xor: 3, nor: 3, and: 4, nand: 4 };
  const p = priority[node.type] || 0;

  function wrap(child) {
    const cp = priority[child.type] || 99;
    if (cp < p) return '(' + astToStr(child) + ')';
    return astToStr(child);
  }

  return wrap(node.left) + opSymbols[node.type] + wrap(node.right);
}

// ===== Deep Clone =====
function cloneAST(node) {
  if (!node) return null;
  if (node.type === 'var') return { type: 'var', name: node.name };
  if (node.type === 'const') return { type: 'const', value: node.value };
  if (node.type === 'not') return { type: 'not', operand: cloneAST(node.operand) };
  return { type: node.type, left: cloneAST(node.left), right: cloneAST(node.right) };
}

// ===== AST Equality =====
function astEqual(a, b) {
  if (!a || !b) return a === b;
  if (a.type !== b.type) return false;
  if (a.type === 'var') return a.name === b.name;
  if (a.type === 'const') return a.value === b.value;
  if (a.type === 'not') return astEqual(a.operand, b.operand);
  return astEqual(a.left, b.left) && astEqual(a.right, b.right);
}

// ===== Cost Function =====
function cost(node) {
  if (!node) return 0;
  if (node.type === 'const') return 0.5;
  if (node.type === 'var') return 1;
  if (node.type === 'not') return 1.1 + cost(node.operand);
  return 2 + cost(node.left) + cost(node.right);
}

// ===== Check if node is negation of other =====
function isNegOf(a, b) {
  if (a.type === 'not' && astEqual(a.operand, b)) return true;
  if (b.type === 'not' && astEqual(b.operand, a)) return true;
  return false;
}

// ===== FLATTEN / UNFLATTEN =====
function flatten(node, opType) {
  if (node.type === opType) {
    return [...flatten(node.left, opType), ...flatten(node.right, opType)];
  }
  return [node];
}

function unflatten(items, opType) {
  if (items.length === 0) return null;
  if (items.length === 1) return cloneAST(items[0]);
  let result = cloneAST(items[0]);
  for (let i = 1; i < items.length; i++) {
    result = { type: opType, left: result, right: cloneAST(items[i]) };
  }
  return result;
}

// ===== NORMALIZE KEY (for sorting operands) =====
function normalizeKey(node) {
  if (!node) return '';
  if (node.type === 'var') return node.name;
  if (node.type === 'const') return String(node.value);
  if (node.type === 'not') return '~' + normalizeKey(node.operand);
  if (node.type === 'and' || node.type === 'or') {
    const items = flatten(node, node.type).map(normalizeKey).sort();
    return '(' + items.join(node.type === 'and' ? '*' : '+') + ')';
  }
  return '(' + normalizeKey(node.left) + node.type + normalizeKey(node.right) + ')';
}

// ===== NORMALIZED AST EQUALITY =====
function normEqual(a, b) {
  return normalizeKey(a) === normalizeKey(b);
}

// ===== SUBSET CHECK =====
function isSubsetFactors(bigNode, smallNode, innerOp) {
  const bigItems = flatten(bigNode, innerOp);
  const smallItems = flatten(smallNode, innerOp);
  return smallItems.every(si => bigItems.some(bi => normEqual(si, bi)));
}
