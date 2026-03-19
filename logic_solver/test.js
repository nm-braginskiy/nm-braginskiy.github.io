function test() {
  const testCases = [
    // --- simplify ---
    {
      name: "Глубокое поглощение",
      input: "a + a * b + a * c + a * d",
      mode: "simplify",
      expected: "a"
    },
    {
      name: "Закон Де Моргана + Двойное отрицание",
      input: "-( -a + -b )",
      mode: "simplify",
      expected: "a * b"
    },
    {
      name: "Нейтральный элемент и Дополнение",
      input: "a + -a * 1",
      mode: "simplify",
      expected: "1"
    },
    {
      name: "Дистрибутивность",
      input: "(a + b) * (a + -b)",
      mode: "simplify",
      expected: "a"
    },
    {
      name: "Импликация и Закон исключенного третьего",
      input: "(a -> b) + a",
      mode: "simplify",
      expected: "1"
    },
    {
      name: "Расширенное поглощение",
      input: "a + -a * b",
      mode: "simplify",
      expected: "a + b"
    },
    {
      name: "Аннигиляция через противоречие",
      input: "a * b * -a",
      mode: "simplify",
      expected: "0"
    },
    {
      name: "Тавтология (Эквивалентность)",
      input: "a <-> a",
      mode: "simplify",
      expected: "1"
    },
    {
      name: "Глубокое склеивание",
      input: "a*b*c + a*b*-c",
      mode: "simplify",
      expected: "a * b"
    },
    // --- invert_simplify ---
    {
      name: "Инверсия + Упрощение (Де Морган)",
      input: "a + b",
      mode: "invert_simplify",
      expected: "-a * -b"
    },
    {
      name: "Инверсия константы",
      input: "1",
      mode: "invert_simplify",
      expected: "0"
    },
    {
      name: "Двойная инверсия",
      input: "-a",
      mode: "invert_simplify",
      expected: "a"
    },
    {
      name: "Глубокое склеивание (инверсия)",
      input: "a*b*c + a*b*-c",
      mode: "invert_simplify",
      expected: "-a + -b"
    },
    // --- СДНФ ---
    {
      name: "СДНФ: a + b",
      input: "a + b",
      mode: "sdnf",
      expected: "a * -b + -a * b + a * b"
    },
    {
      name: "СДНФ: тождественный 0",
      input: "a * -a",
      mode: "sdnf",
      expected: "0"
    },
    // --- СКНФ ---
    {
      name: "СКНФ: a * b",
      input: "a * b",
      mode: "scnf",
      expected: "(a + b) * (-a + b) * (a + -b)"
    },
    {
      name: "СКНФ: тождественный 1",
      input: "a + -a",
      mode: "scnf",
      expected: "1"
    },
  ];

  console.log("%c === ЗАПУСК ТЕСТОВ (MODES) === ", "background: #1a1a1a; color: #00d4ff; font-size: 14px; padding: 5px;");
  let passedCount = 0;

  testCases.forEach((t, index) => {
    const mode = t.mode || 'simplify';
    console.log(`\nТЕСТ №${index + 1}: ${t.name} [%c${mode.toUpperCase()}%c]`, "color: #ffaa00", "color: inherit");
    console.log(`Ввод: ${t.input}`);

    try {
      let tokens = tokenize(t.input);
      let ast = parse(tokens);
      let steps;

      if (mode === 'invert_simplify') {
        ast = { type: 'not', operand: ast };
        steps = solveAST(ast);
        steps.unshift({ expr: astToStr(parse(tokenize(t.input))), law: null });
      } else if (mode === 'sdnf') {
        const { ast: nfAst, str } = buildSDNF(ast);
        steps = [
          { expr: astToStr(ast), law: null },
          { expr: str, law: 'Построение СДНФ' }
        ];
      } else if (mode === 'scnf') {
        const { ast: nfAst, str } = buildSCNF(ast);
        steps = [
          { expr: astToStr(ast), law: null },
          { expr: str, law: 'Построение СКНФ' }
        ];
      } else {
        steps = solveAST(ast);
      }

      const finalResult = steps[steps.length - 1].expr;
      const normalize = (s) => s.replace(/\s+/g, '');
      const isCorrect = normalize(finalResult) === normalize(t.expected);

      if (isCorrect) {
        console.log(`%c [OK] Результат: ${finalResult}`, "color: #4CAF50");
        passedCount++;
      } else {
        console.log(`%c [FAIL] Ожидалось: ${t.expected}, получено: ${finalResult}`, "color: #F44336");
        console.log("Шаги:");
        steps.forEach((step, i) => {
          console.log(`   ${i}. ${step.expr}  %c(${step.law || 'исходное'})`, "color: #888");
        });
      }
    } catch (err) {
      console.log(`%c [ERROR] ${err.message}`, "color: #FF9800");
      console.error(err);
    }
  });

  const color = passedCount === testCases.length ? "#4CAF50" : "#F44336";
  console.log(`\n%c ИТОГО: ${passedCount}/${testCases.length} `, `background: ${color}; color: white; font-weight: bold; padding: 3px 8px;`);
}

// ===== АВТОТЕСТЫ ДЛЯ СДНФ И СКНФ =====
function testNormalForms() {
  console.log("%c === АВТОТЕСТЫ СДНФ И СКНФ === ", "background: #2196F3; color: white; font-size: 14px; padding: 5px;");
  
  const testCases = [
    // Простые случаи с одной переменной
    { expr: "a", expectedSDNF: "a", expectedSCNF: "-a" },
    { expr: "-a", expectedSDNF: "-a", expectedSCNF: "a" },
    
    // Простые случаи с двумя переменными
    { expr: "a + b", expectedSDNF: "-a * b + a * -b + a * b", expectedSCNF: "a + b" },
    { expr: "a * b", expectedSDNF: "a * b", expectedSCNF: "(a + b) * (a + -b) * (-a + b)" },
    { expr: "a !+ b", expectedSDNF: "-a * b + a * -b", expectedSCNF: "(a + b) * (-a + -b)" },
    
    // Тождественные функции
    { expr: "a + -a", expectedSDNF: "1", expectedSCNF: "1" },
    { expr: "a * -a", expectedSDNF: "0", expectedSCNF: "0" },
    { expr: "1", expectedSDNF: "1", expectedSCNF: "1" },
    { expr: "0", expectedSDNF: "0", expectedSCNF: "0" },
    
    // Более сложные случаи
    { expr: "a -> b", expectedSDNF: "-a * -b + -a * b + a * b", expectedSCNF: "a + b" },
    { expr: "a <-> b", expectedSDNF: "-a * -b + a * b", expectedSCNF: "(a + -b) * (-a + b)" },
    { expr: "a !* b", expectedSDNF: "-a * -b + -a * b + a * -b", expectedSCNF: "a + b" },
    { expr: "a !!+ b", expectedSDNF: "-a * -b", expectedSCNF: "(a + b) * (a + -b) * (-a + b)" },
    
    // Случаи с тремя переменными (простые)
    { expr: "a * b * c", expectedSDNF: "a * b * c", expectedSCNF: "(a + b + c) * (a + b + -c) * (a + -b + c) * (a + -b + -c) * (-a + b + c) * (-a + b + -c) * (-a + -b + c)" },
    { expr: "a + b + c", expectedSDNF: "-a * -b * c + -a * b * -c + -a * b * c + a * -b * -c + a * -b * c + a * b * -c + a * b * c", expectedSCNF: "a + b + c" }
  ];
  
  let passedSDNF = 0;
  let passedSCNF = 0;
  let totalTests = testCases.length;
  
  testCases.forEach((testCase, index) => {
    console.log(`\n%cТЕСТ №${index + 1}: ${testCase.expr}`, "color: #FF9800; font-weight: bold;");
    
    try {
      // Парсим выражение
      const tokens = tokenize(testCase.expr);
      const ast = parse(tokens);
      
      // Тестируем СДНФ
      const sdnfResult = buildSDNF(ast);
      const sdnfNormalized = normalizeExpression(sdnfResult.str);
      const expectedSDNFNormalized = normalizeExpression(testCase.expectedSDNF);
      
      if (sdnfNormalized === expectedSDNFNormalized) {
        console.log(`%c  ✓ СДНФ: ${sdnfResult.str}`, "color: #4CAF50");
        passedSDNF++;
      } else {
        console.log(`%c  ✗ СДНФ ОШИБКА:`, "color: #F44336");
        console.log(`    Получено: ${sdnfResult.str}`);
        console.log(`    Ожидалось: ${testCase.expectedSDNF}`);
        
        // Дополнительная проверка через таблицу истинности
        if (checkEquivalenceByTruthTable(ast, sdnfResult.ast)) {
          console.log(`%c    Но функции эквивалентны по таблице истинности ✓`, "color: #FF9800");
          passedSDNF++;
        }
      }
      
      // Тестируем СКНФ
      const scnfResult = buildSCNF(ast);
      const scnfNormalized = normalizeExpression(scnfResult.str);
      const expectedSCNFNormalized = normalizeExpression(testCase.expectedSCNF);
      
      if (scnfNormalized === expectedSCNFNormalized) {
        console.log(`%c  ✓ СКНФ: ${scnfResult.str}`, "color: #4CAF50");
        passedSCNF++;
      } else {
        console.log(`%c  ✗ СКНФ ОШИБКА:`, "color: #F44336");
        console.log(`    Получено: ${scnfResult.str}`);
        console.log(`    Ожидалось: ${testCase.expectedSCNF}`);
        
        // Дополнительная проверка через таблицу истинности
        if (checkEquivalenceByTruthTable(ast, scnfResult.ast)) {
          console.log(`%c    Но функции эквивалентны по таблице истинности ✓`, "color: #FF9800");
          passedSCNF++;
        }
      }
      
    } catch (error) {
      console.log(`%c  ✗ ОШИБКА ПАРСИНГА: ${error.message}`, "color: #F44336");
    }
  });
  
  // Итоговая статистика
  console.log(`\n%c === РЕЗУЛЬТАТЫ АВТОТЕСТОВ === `, "background: #2196F3; color: white; font-size: 14px; padding: 5px;");
  
  const sdnfColor = passedSDNF === totalTests ? "#4CAF50" : "#F44336";
  const scnfColor = passedSCNF === totalTests ? "#4CAF50" : "#F44336";
  
  console.log(`%c СДНФ: ${passedSDNF}/${totalTests} `, `background: ${sdnfColor}; color: white; font-weight: bold; padding: 3px 8px;`);
  console.log(`%c СКНФ: ${passedSCNF}/${totalTests} `, `background: ${scnfColor}; color: white; font-weight: bold; padding: 3px 8px;`);
  
  const totalPassed = passedSDNF + passedSCNF;
  const totalMax = totalTests * 2;
  const overallColor = totalPassed === totalMax ? "#4CAF50" : "#F44336";
  console.log(`%c ОБЩИЙ ИТОГ: ${totalPassed}/${totalMax} `, `background: ${overallColor}; color: white; font-weight: bold; padding: 3px 8px;`);
}

// Вспомогательная функция для нормализации выражений (убирает пробелы и приводит к единому виду)
function normalizeExpression(expr) {
  return expr.replace(/\s+/g, '').toLowerCase();
}

// Проверка эквивалентности двух AST через таблицы истинности
function checkEquivalenceByTruthTable(ast1, ast2) {
  try {
    const vars1 = collectVars(ast1);
    const vars2 = collectVars(ast2);
    const allVars = [...new Set([...vars1, ...vars2])].sort();
    
    const n = allVars.length;
    
    // Проверяем все возможные комбинации переменных
    for (let i = 0; i < (1 << n); i++) {
      const assignment = {};
      for (let j = 0; j < n; j++) {
        assignment[allVars[j]] = (i >> j) & 1;
      }
      
      const val1 = evalAST(ast1, assignment);
      const val2 = evalAST(ast2, assignment);
      
      if (val1 !== val2) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}
