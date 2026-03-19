// ===== НОРМАЛЬНЫЕ ФОРМЫ =====

// 2.1 Сбор переменных из AST
function collectVars(node) {
  const vars = new Set();
  
  function traverse(n) {
    if (!n) return;
    if (n.type === 'var') {
      vars.add(n.name);
    } else if (n.type === 'not') {
      traverse(n.operand);
    } else if (n.left && n.right) {
      traverse(n.left);
      traverse(n.right);
    }
  }
  
  traverse(node);
  return Array.from(vars).sort();
}

// 2.2 Вычисление значения AST при заданном присваивании
function evalAST(node, assignment) {
  if (!node) return 0;
  
  switch (node.type) {
    case 'var':
      return assignment[node.name] || 0;
    case 'const':
      return node.value;
    case 'not':
      return 1 - evalAST(node.operand, assignment);
    case 'and':
      return evalAST(node.left, assignment) & evalAST(node.right, assignment);
    case 'or':
      return evalAST(node.left, assignment) | evalAST(node.right, assignment);
    case 'xor':
      return evalAST(node.left, assignment) ^ evalAST(node.right, assignment);
    case 'nand':
      return 1 - (evalAST(node.left, assignment) & evalAST(node.right, assignment));
    case 'nor':
      return 1 - (evalAST(node.left, assignment) | evalAST(node.right, assignment));
    case 'imp':
      return 1 - evalAST(node.left, assignment) + evalAST(node.left, assignment) * evalAST(node.right, assignment);
    case 'eqv':
      return 1 - (evalAST(node.left, assignment) ^ evalAST(node.right, assignment));
    default:
      return 0;
  }
}

// 2.3 Построение таблицы истинности
function buildTruthTable(ast) {
  const vars = collectVars(ast);
  const table = [];
  const n = vars.length;
  
  // Перебираем все 2^n комбинаций
  for (let i = 0; i < (1 << n); i++) {
    const assignment = {};
    for (let j = 0; j < n; j++) {
      assignment[vars[j]] = (i >> j) & 1;
    }
    const value = evalAST(ast, assignment);
    table.push({ assignment, value });
  }
  
  return table;
}

// 2.4 Построение СДНФ
function buildSDNF(ast) {
  const table = buildTruthTable(ast);
  const vars = collectVars(ast);
  
  // Находим строки где значение функции равно 1
  const trueRows = table.filter(row => row.value === 1);
  
  // Если функция тождественно 0
  if (trueRows.length === 0) {
    return { ast: { type: 'const', value: 0 }, str: '0' };
  }
  
  // Если функция тождественно 1
  if (trueRows.length === table.length) {
    return { ast: { type: 'const', value: 1 }, str: '1' };
  }
  
  // Строим минтермы
  const minterms = trueRows.map(row => {
    const literals = vars.map(varName => {
      const value = row.assignment[varName];
      if (value === 1) {
        return { type: 'var', name: varName };
      } else {
        return { type: 'not', operand: { type: 'var', name: varName } };
      }
    });
    
    // Создаем конъюнкцию всех литералов
    if (literals.length === 1) {
      return literals[0];
    }
    
    let result = literals[0];
    for (let i = 1; i < literals.length; i++) {
      result = { type: 'and', left: result, right: literals[i] };
    }
    return result;
  });
  
  // Создаем дизъюнкцию всех минтермов
  let resultAST;
  if (minterms.length === 1) {
    resultAST = minterms[0];
  } else {
    resultAST = minterms[0];
    for (let i = 1; i < minterms.length; i++) {
      resultAST = { type: 'or', left: resultAST, right: minterms[i] };
    }
  }
  
  return { ast: resultAST, str: astToStr(resultAST) };
}

// 2.5 Построение СКНФ
function buildSCNF(ast) {
  const table = buildTruthTable(ast);
  const vars = collectVars(ast);
  
  // Находим строки где значение функции равно 0
  const falseRows = table.filter(row => row.value === 0);
  
  // Если функция тождественно 1
  if (falseRows.length === 0) {
    return { ast: { type: 'const', value: 1 }, str: '1' };
  }
  
  // Если функция тождественно 0
  if (falseRows.length === table.length) {
    return { ast: { type: 'const', value: 0 }, str: '0' };
  }
  
  // Строим макстермы
  const maxterms = falseRows.map(row => {
    const literals = vars.map(varName => {
      const value = row.assignment[varName];
      if (value === 0) {
        return { type: 'var', name: varName };
      } else {
        return { type: 'not', operand: { type: 'var', name: varName } };
      }
    });
    
    // Создаем дизъюнкцию всех литералов
    if (literals.length === 1) {
      return literals[0];
    }
    
    let result = literals[0];
    for (let i = 1; i < literals.length; i++) {
      result = { type: 'or', left: result, right: literals[i] };
    }
    return result;
  });
  
  // Создаем конъюнкцию всех макстермов
  let resultAST;
  if (maxterms.length === 1) {
    resultAST = maxterms[0];
  } else {
    resultAST = maxterms[0];
    for (let i = 1; i < maxterms.length; i++) {
      resultAST = { type: 'and', left: resultAST, right: maxterms[i] };
    }
  }
  
  return { ast: resultAST, str: astToStr(resultAST) };
}