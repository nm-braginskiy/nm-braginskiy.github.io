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
    // --- invert ---
    {
      name: "Инверсия: ƒ → -ƒ (без упрощения)",
      input: "a + b",
      mode: "invert",
      expected: "-(a + b)"
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

      if (mode === 'invert') {
        ast = { type: 'not', operand: ast };
        steps = [
          { expr: astToStr(parse(tokenize(t.input))), law: null },
          { expr: astToStr(ast), law: 'Инверсия функции' }
        ];
      } else if (mode === 'invert_simplify') {
        ast = { type: 'not', operand: ast };
        steps = solveAST(ast);
        steps.unshift({ expr: astToStr(parse(tokenize(t.input))), law: null });
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
