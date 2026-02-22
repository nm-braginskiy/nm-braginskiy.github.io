function test() {
  const testCases = [
    {
      name: "Глубокое поглощение",
      input: "a + a * b + a * c + a * d",
      expected: "a"
    },
    {
      name: "Закон Де Моргана + Двойное отрицание",
      input: "-( -a + -b )",
      expected: "a * b"
    },
    {
      name: "Идемпотентность XOR",
      input: "a !+ a !+ b",
      expected: "b"
    },
    {
      name: "Нейтральный элемент и Дополнение",
      input: "a + -a * 1",
      expected: "1"
    },
    {
      name: "Дистрибутивность (Твой затуп)",
      input: "(a + b) * (a + -b)",
      expected: "a"
    },
    {
      name: "Импликация и Закон исключенного третьего",
      input: "(a -> b) + a",
      expected: "1"
    },
    {
      name: "Расширенное поглощение",
      input: "a + -a * b",
      expected: "a + b"
    },
    {
      name: "Аннигиляция через противоречие",
      input: "a * b * -a",
      expected: "0"
    },
    {
      name: "Тавтология (Эквивалентность)",
      input: "a <-> a",
      expected: "1"
    },
    {
      name: "Глубокое склеивание",
      input: "a*b*c + a*b*-c",
      expected: "a * b"
    }
  ];

  console.log("%c === ЗАПУСК ТЕСТОВ АЛГОРИТМА === ", "background: #222; color: #bada55; font-size: 14px;");
  let passedCount = 0;

  testCases.forEach((t, index) => {
    console.log(`\nТЕСТ №${index + 1}: ${t.name}`);
    console.log(`Ввод: ${t.input}`);
    try {
      const steps = solve(t.input);
      const finalResult = steps[steps.length - 1].expr;

      const normalize = (s) => s.replace(/\s+/g, '');
      const isCorrect = normalize(finalResult) === normalize(t.expected);

      if (isCorrect) {
        console.log(`%c [OK] Результат: ${finalResult}`, "color: #4CAF50");
        passedCount++;
      } else {
        console.log(`%c [FAIL] Ожидалось: ${t.expected}, но получено: ${finalResult}`, "color: #F44336");
        console.log("Цепочка шагов:");
        steps.forEach((step, i) => {
          console.log(`  ${i}. ${step.expr}  %c(${step.law || 'исходное'})`, "color: #888");
        });
      }
    } catch (err) {
      console.log(`%c [ERROR] Ошибка парсинга/выполнения: ${err.message}`, "color: #FF9800");
    }
  });

  console.log("\n---");
  console.log(`ИТОГ: Пройдено ${passedCount} из ${testCases.length}`);
  if (passedCount === testCases.length) {
    console.log("%c ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Агент работает идеально. ", "background: #4CAF50; color: white; padding: 5px;");
  } else {
    console.log("%c ЕСТЬ ОШИБКИ. Проверь логику правил и функцию стоимости. ", "background: #F44336; color: white; padding: 5px;");
  }
}
