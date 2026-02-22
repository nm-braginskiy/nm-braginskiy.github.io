// ===== SIMPLIFICATION RULES =====
function makeRules() {
  return [
    // --- Elimination of complex ops ---
    {
      name: 'Раскрытие импликации: a -> b = -a + b',
      apply(n) {
        if (n.type === 'imp')
          return { type: 'or', left: { type: 'not', operand: cloneAST(n.left) }, right: cloneAST(n.right) };
        return null;
      }
    },
    {
      name: 'Раскрытие эквивалентности: a <-> b = (a * b) + (-a * -b)',
      apply(n) {
        if (n.type === 'eqv')
          return { type: 'or',
            left: { type: 'and', left: cloneAST(n.left), right: cloneAST(n.right) },
            right: { type: 'and', left: { type: 'not', operand: cloneAST(n.left) }, right: { type: 'not', operand: cloneAST(n.right) } }
          };
        return null;
      }
    },
    {
      name: 'Раскрытие XOR: a !+ b = (a + b) * (-a + -b)',
      apply(n) {
        if (n.type === 'xor')
          return { type: 'and',
            left: { type: 'or', left: cloneAST(n.left), right: cloneAST(n.right) },
            right: { type: 'or', left: { type: 'not', operand: cloneAST(n.left) }, right: { type: 'not', operand: cloneAST(n.right) } }
          };
        return null;
      }
    },
    {
      name: 'Раскрытие NAND: a !* b = -(a * b)',
      apply(n) {
        if (n.type === 'nand')
          return { type: 'not', operand: { type: 'and', left: cloneAST(n.left), right: cloneAST(n.right) } };
        return null;
      }
    },
    {
      name: 'Раскрытие NOR: a !!+ b = -(a + b)',
      apply(n) {
        if (n.type === 'nor')
          return { type: 'not', operand: { type: 'or', left: cloneAST(n.left), right: cloneAST(n.right) } };
        return null;
      }
    },
    // --- Double negation ---
    {
      name: 'Двойное отрицание: --a = a',
      apply(n) {
        if (n.type === 'not' && n.operand.type === 'not') return cloneAST(n.operand.operand);
        return null;
      }
    },
    // --- De Morgan ---
    {
      name: 'Закон де Моргана: -(a * b) = -a + -b',
      apply(n) {
        if (n.type === 'not' && n.operand.type === 'and')
          return { type: 'or',
            left: { type: 'not', operand: cloneAST(n.operand.left) },
            right: { type: 'not', operand: cloneAST(n.operand.right) }
          };
        return null;
      }
    },
    {
      name: 'Закон де Моргана: -(a + b) = -a * -b',
      apply(n) {
        if (n.type === 'not' && n.operand.type === 'or')
          return { type: 'and',
            left: { type: 'not', operand: cloneAST(n.operand.left) },
            right: { type: 'not', operand: cloneAST(n.operand.right) }
          };
        return null;
      }
    },
    // --- Negation of constants ---
    {
      name: 'Отрицание константы: -0 = 1',
      apply(n) {
        if (n.type === 'not' && n.operand.type === 'const' && n.operand.value === 0) return { type: 'const', value: 1 };
        return null;
      }
    },
    {
      name: 'Отрицание константы: -1 = 0',
      apply(n) {
        if (n.type === 'not' && n.operand.type === 'const' && n.operand.value === 1) return { type: 'const', value: 0 };
        return null;
      }
    },
    // --- Identity / Annihilation ---
    {
      name: 'Нейтральный элемент: a * 1 = a',
      apply(n) {
        if (n.type === 'and' && n.right.type === 'const' && n.right.value === 1) return cloneAST(n.left);
        if (n.type === 'and' && n.left.type === 'const' && n.left.value === 1) return cloneAST(n.right);
        return null;
      }
    },
    {
      name: 'Нейтральный элемент: a + 0 = a',
      apply(n) {
        if (n.type === 'or' && n.right.type === 'const' && n.right.value === 0) return cloneAST(n.left);
        if (n.type === 'or' && n.left.type === 'const' && n.left.value === 0) return cloneAST(n.right);
        return null;
      }
    },
    {
      name: 'Аннигиляция: a * 0 = 0',
      apply(n) {
        if (n.type === 'and' && (n.left.type === 'const' && n.left.value === 0 || n.right.type === 'const' && n.right.value === 0))
          return { type: 'const', value: 0 };
        return null;
      }
    },
    {
      name: 'Аннигиляция: a + 1 = 1',
      apply(n) {
        if (n.type === 'or' && (n.left.type === 'const' && n.left.value === 1 || n.right.type === 'const' && n.right.value === 1))
          return { type: 'const', value: 1 };
        return null;
      }
    },

    // ===== N-ARY DEEP RULES (flatten-based) =====

    // --- Deep Idempotence ---
    {
      name: 'Идемпотентность (глубокая): удаление дубликатов',
      apply(n) {
        if (n.type !== 'or' && n.type !== 'and') return null;
        const items = flatten(n, n.type);
        if (items.length < 2) return null;
        const unique = [];
        for (const item of items) {
          if (!unique.some(u => normEqual(u, item))) unique.push(item);
        }
        if (unique.length === items.length) return null;
        return unflatten(unique, n.type);
      }
    },

    // --- Deep Complement ---
    {
      name: 'Закон дополнения (глубокий): a + ... + -a = 1',
      apply(n) {
        if (n.type !== 'or') return null;
        const items = flatten(n, 'or');
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            if (isNegOf(items[i], items[j])) return { type: 'const', value: 1 };
          }
        }
        return null;
      }
    },
    {
      name: 'Закон дополнения (глубокий): a * ... * -a = 0',
      apply(n) {
        if (n.type !== 'and') return null;
        const items = flatten(n, 'and');
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            if (isNegOf(items[i], items[j])) return { type: 'const', value: 0 };
          }
        }
        return null;
      }
    },

    // --- Deep Absorption ---
    {
      name: 'Поглощение (глубокое): a + a*b... = a',
      apply(n) {
        if (n.type !== 'or') return null;
        const items = flatten(n, 'or');
        if (items.length < 2) return null;
        const absorbed = new Array(items.length).fill(false);
        let changed = false;
        for (let i = 0; i < items.length; i++) {
          for (let j = 0; j < items.length; j++) {
            if (i === j || absorbed[i] || absorbed[j]) continue;
            if (isSubsetFactors(items[j], items[i], 'and') && !normEqual(items[i], items[j])) {
              absorbed[j] = true;
              changed = true;
            }
          }
        }
        if (!changed) return null;
        const remaining = items.filter((_, idx) => !absorbed[idx]);
        return unflatten(remaining, 'or');
      }
    },
    {
      name: 'Поглощение (глубокое): a * (a+b)... = a',
      apply(n) {
        if (n.type !== 'and') return null;
        const items = flatten(n, 'and');
        if (items.length < 2) return null;
        const absorbed = new Array(items.length).fill(false);
        for (let i = 0; i < items.length; i++) {
          if (absorbed[i]) continue;
          for (let j = 0; j < items.length; j++) {
            if (i === j || absorbed[j]) continue;
            if (isSubsetFactors(items[j], items[i], 'or')) {
              absorbed[j] = true;
            }
          }
        }
        if (!absorbed.some(Boolean)) return null;
        const remaining = items.filter((_, idx) => !absorbed[idx]);
        return unflatten(remaining, 'and');
      }
    },

    // --- Deep Gluing ---
    {
      name: 'Склеивание (глубокое): a*b + a*-b = a',
      apply(n) {
        if (n.type !== 'or') return null;
        const items = flatten(n, 'or');
        if (items.length < 2) return null;
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const fi = flatten(items[i], 'and');
            const fj = flatten(items[j], 'and');
            if (fi.length !== fj.length || fi.length < 2) continue;
            const glued = tryGlue(fi, fj);
            if (glued) {
              const newItems = items.filter((_, idx) => idx !== i && idx !== j);
              newItems.push(glued);
              return unflatten(newItems, 'or');
            }
          }
        }
        return null;
      }
    },

    // --- Deep Factoring ---
    {
      name: 'Вынесение за скобки (глубокое): a*b + a*c = a*(b+c)',
      apply(n) {
        if (n.type !== 'or') return null;
        const items = flatten(n, 'or');
        if (items.length < 2) return null;
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const fi = flatten(items[i], 'and');
            const fj = flatten(items[j], 'and');
            for (const factorI of fi) {
              const matchIdx = fj.findIndex(fji => normEqual(fji, factorI));
              if (matchIdx !== -1) {
                const restI = fi.filter(x => x !== factorI);
                const restJ = fj.filter((_, idx) => idx !== matchIdx);
                const leftPart = restI.length > 0 ? unflatten(restI, 'and') : { type: 'const', value: 1 };
                const rightPart = restJ.length > 0 ? unflatten(restJ, 'and') : { type: 'const', value: 1 };
                const factored = { type: 'and', left: cloneAST(factorI), right: { type: 'or', left: leftPart, right: rightPart } };
                const newItems = items.filter((_, idx) => idx !== i && idx !== j);
                newItems.push(factored);
                return unflatten(newItems, 'or');
              }
            }
          }
        }
        return null;
      }
    },

    // --- Extended absorption ---
    {
      name: 'Расширенное поглощение: -a + (a * b) = -a + b',
      apply(n) {
        if (n.type !== 'or') return null;
        const items = flatten(n, 'or');
        if (items.length < 2) return null;
        for (let i = 0; i < items.length; i++) {
          for (let j = 0; j < items.length; j++) {
            if (i === j) continue;
            const factorsJ = flatten(items[j], 'and');
            if (factorsJ.length < 1) continue;
            const negIdx = factorsJ.findIndex(f => isNegOf(items[i], f));
            if (negIdx !== -1) {
              const reducedFactors = factorsJ.filter((_, idx) => idx !== negIdx);
              const newItems = [...items];
              newItems[j] = reducedFactors.length > 0 ? unflatten(reducedFactors, 'and') : { type: 'const', value: 1 };
              return unflatten(newItems, 'or');
            }
          }
        }
        return null;
      }
    },

    // --- Distributivity: (a+b)*(a+c) = a+(b*c) ---
    {
      name: 'Вынесение за скобки (дистрибутивность): (a+b)*(a+c) = a+(b*c)',
      apply(n) {
        if (n.type !== 'and') return null;
        const items = flatten(n, 'and');
        if (items.length < 2) return null;
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const sumI = flatten(items[i], 'or');
            const sumJ = flatten(items[j], 'or');
            for (const termI of sumI) {
              const matchIdx = sumJ.findIndex(termJ => normEqual(termJ, termI));
              if (matchIdx !== -1) {
                const restI = sumI.filter(x => x !== termI);
                const restJ = sumJ.filter((_, idx) => idx !== matchIdx);
                const leftPart = restI.length > 0 ? unflatten(restI, 'or') : { type: 'const', value: 0 };
                const rightPart = restJ.length > 0 ? unflatten(restJ, 'or') : { type: 'const', value: 0 };
                const combined = { type: 'or', left: cloneAST(termI), right: { type: 'and', left: leftPart, right: rightPart } };
                const newItems = items.filter((_, idx) => idx !== i && idx !== j);
                newItems.push(combined);
                return unflatten(newItems, 'and');
              }
            }
          }
        }
        return null;
      }
    },

    // --- FOIL: (a+b)*c = a*c + b*c ---
    {
      name: 'Распределение (раскрытие скобок): (a+b)*c = a*c + b*c',
      apply(n) {
        if (n.type !== 'and') return null;
        if (n.left.type === 'or') {
          return {
            type: 'or',
            left: { type: 'and', left: cloneAST(n.left.left), right: cloneAST(n.right) },
            right: { type: 'and', left: cloneAST(n.left.right), right: cloneAST(n.right) }
          };
        }
        if (n.right.type === 'or') {
          return {
            type: 'or',
            left: { type: 'and', left: cloneAST(n.left), right: cloneAST(n.right.left) },
            right: { type: 'and', left: cloneAST(n.left), right: cloneAST(n.right.right) }
          };
        }
        return null;
      }
    },
  ];
}

// ===== GLUE HELPER =====
function tryGlue(fi, fj) {
  const si = fi.map((x, idx) => ({ node: x, key: normalizeKey(x), idx })).sort((a, b) => a.key.localeCompare(b.key));
  const sj = fj.map((x, idx) => ({ node: x, key: normalizeKey(x), idx })).sort((a, b) => a.key.localeCompare(b.key));

  let diffCount = 0;
  let common = [];
  let usedJ = new Set();

  for (let i = 0; i < si.length; i++) {
    let found = false;
    for (let j = 0; j < sj.length; j++) {
      if (usedJ.has(j)) continue;
      if (normEqual(si[i].node, sj[j].node)) {
        common.push(si[i].node);
        usedJ.add(j);
        found = true;
        break;
      }
    }
    if (!found) {
      diffCount++;
      if (diffCount > 1) return null;
    }
  }

  if (diffCount !== 1) return null;

  const unmatchedI = si.filter(s => !common.some(c => normEqual(c, s.node)))[0];
  const unmatchedJ = sj.filter((s, idx) => !usedJ.has(idx))[0];

  if (!unmatchedI || !unmatchedJ) return null;
  if (!isNegOf(unmatchedI.node, unmatchedJ.node)) return null;

  if (common.length === 0) return { type: 'const', value: 1 };
  return unflatten(common, 'and');
}

// ===== SIMPLIFICATION ENGINE =====
function simplifyStep(node, rules) {
  // Try children first (bottom-up)
  if (node.type === 'not') {
    const childResult = simplifyStep(node.operand, rules);
    if (childResult) return { node: { type: 'not', operand: childResult.node }, law: childResult.law };
  }
  if (node.left && node.right) {
    const leftResult = simplifyStep(node.left, rules);
    if (leftResult) return { node: { type: node.type, left: leftResult.node, right: cloneAST(node.right) }, law: leftResult.law };
    const rightResult = simplifyStep(node.right, rules);
    if (rightResult) return { node: { type: node.type, left: cloneAST(node.left), right: rightResult.node }, law: rightResult.law };
  }
  // Apply rules at this node with cost check
  const currentCost = cost(node);
  for (const rule of rules) {
    const result = rule.apply(node);
    if (result && !astEqual(result, node)) {
      const newCost = cost(result);
      const isDeMorgan = node.type === 'not' && (node.operand.type === 'and' || node.operand.type === 'or');
      const isExpansionOp = ['imp', 'eqv', 'xor', 'nand', 'nor'].includes(node.type);
      if (newCost <= currentCost || isDeMorgan || isExpansionOp) {
        return { node: result, law: rule.name };
      }
    }
  }
  return null;
}

function solve(input) {
  const tokens = tokenize(input);
  let ast = parse(tokens);
  const rules = makeRules();
  const steps = [{ expr: astToStr(ast), law: null }];
  const seen = new Set();
  seen.add(astToStr(ast));

  const MAX_STEPS = 80;
  for (let i = 0; i < MAX_STEPS; i++) {
    const result = simplifyStep(ast, rules);
    if (!result) break;
    ast = result.node;
    const str = astToStr(ast);
    if (seen.has(str)) break;
    seen.add(str);
    steps.push({ expr: str, law: result.law });
  }
  return steps;
}
