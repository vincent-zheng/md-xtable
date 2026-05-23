import { parseMarkdownTable, splitCells } from "../src/core/parser";
import { evaluateGrid } from "../src/core/evaluator";
import { renderTable } from "../src/core/renderer";

describe("MD-XTable Parser", () => {
  test("splitCells correctly handles standard and escaped pipes", () => {
    expect(splitCells("| A | B | C |")).toEqual(["A", "B", "C"]);
    expect(splitCells("A | B \\| C | D")).toEqual(["A", "B | C", "D"]);
  });

  test("Parses basic GFM table and extracts sizes/alignments", () => {
    const md = `
| Item | Price | Qty |
| :---[15%] | ---:| :---: |
| Apple | $1.20 | 5 |
| Banana | $0.80 | 10 |
    `.trim();

    const grid = parseMarkdownTable(md);
    expect(grid).not.toBeNull();
    if (!grid) return;

    expect(grid.colsMeta.length).toBe(3);
    expect(grid.colsMeta[0]).toEqual({ align: "left", width: "15%" });
    expect(grid.colsMeta[1]).toEqual({ align: "right", width: undefined });
    expect(grid.colsMeta[2]).toEqual({ align: "center", width: undefined });

    expect(grid.rows.length).toBe(3); // header + 2 body rows
    expect(grid.rows[1][0].value).toBe("Apple");
    expect(grid.rows[2][1].value).toBe("$0.80");
  });

  test("Resolves cell merges (rowspan and colspan)", () => {
    const md = `
| Project | Lead | Budget | Notes |
| --- | --- | --- | --- |
| Refactor | Alice | 5000 | Core |
| ^^ | Bob | < | Support |
    `.trim();

    const grid = parseMarkdownTable(md);
    expect(grid).not.toBeNull();
    if (!grid) return;

    // Header is row 0. Body rows are row 1 and row 2.
    // "Refactor" at (1,0) should span 2 rows.
    const refactorCell = grid.rows[1][0];
    expect(refactorCell.raw.trim()).toBe("Refactor");
    expect(refactorCell.rowspan).toBe(2);
    expect(refactorCell.colspan).toBe(1);
    expect(refactorCell.isMerged).toBe(false);

    // "^^" at (2,0) should be merged into (1,0)
    const mergeUpCell = grid.rows[2][0];
    expect(mergeUpCell.raw.trim()).toBe("^^");
    expect(mergeUpCell.isMerged).toBe(true);
    expect(mergeUpCell.mergedInto).toEqual({ row: 1, col: 0 });

    // "Bob" at (2,1) should have colspan = 2 (merges "<" to its right at (2,2))
    const bobCell = grid.rows[2][1];
    expect(bobCell.raw.trim()).toBe("Bob");
    expect(bobCell.colspan).toBe(2);
    expect(bobCell.rowspan).toBe(1);
    expect(bobCell.isMerged).toBe(false);

    // "<" at (2,2) should be merged into (2,1)
    const mergeLeftCell = grid.rows[2][2];
    expect(mergeLeftCell.raw.trim()).toBe("<");
    expect(mergeLeftCell.isMerged).toBe(true);
    expect(mergeLeftCell.mergedInto).toEqual({ row: 2, col: 1 });
  });

  test("Parses table metadata from trailing comment", () => {
    const md = `
| A | B |
| --- | --- |
| 1 | 2 |
<!-- {.md-xtable #finance-table .dark-mode width="80%" calc="manual" custom-attr="hello"} -->
    `.trim();

    const grid = parseMarkdownTable(md);
    expect(grid).not.toBeNull();
    if (!grid) return;

    expect(grid.tableMeta.id).toBe("finance-table");
    expect(grid.tableMeta.className).toBe("dark-mode");
    expect(grid.tableMeta.width).toBe("80%");
    expect(grid.tableMeta.calc).toBe("manual");
    expect(grid.tableMeta.attributes["custom-attr"]).toBe("hello");
  });
});

describe("MD-XTable Evaluator", () => {
  test("Evaluates basic math and cell references", () => {
    const md = `
| Price | Qty | Total |
| --- | --- | --- |
| 1500 | 2 | :=A2*B2 |
| 800 | 1 | :=A3*B3 |
    `.trim();

    const grid = parseMarkdownTable(md);
    expect(grid).not.toBeNull();
    if (!grid) return;

    evaluateGrid(grid);

    expect(grid.rows[1][2].value).toBe("3000");
    expect(grid.rows[2][2].value).toBe("800");
  });

  test("Evaluates aggregate formulas (SUM, AVERAGE) and ranges", () => {
    const md = `
| Category | Amount |
| --- | --- |
| Rent | 1200 |
| Food | 300 |
| Utilities | 150 |
| Total | :=SUM(B2:B4) |
| Avg | :=AVERAGE(B2:B4) |
    `.trim();

    const grid = parseMarkdownTable(md);
    expect(grid).not.toBeNull();
    if (!grid) return;

    evaluateGrid(grid);

    expect(grid.rows[4][1].value).toBe("1650");
    expect(grid.rows[5][1].value).toBe("550");
  });

  test("Evaluates relative ranges [UP] and [LEFT]", () => {
    const md = `
| Day | Item A | Item B | Subtotal |
| --- | --- | --- | --- |
| Mon | 100 | 200 | :=SUM([LEFT]) |
| Tue | 150 | 50 | :=SUM([LEFT]) |
| Total | :=SUM([UP]) | :=SUM([UP]) | :=SUM([UP]) |
    `.trim();

    const grid = parseMarkdownTable(md);
    expect(grid).not.toBeNull();
    if (!grid) return;

    evaluateGrid(grid);

    // Mon Subtotal = 100 + 200 = 300
    expect(grid.rows[1][3].value).toBe("300");
    // Tue Subtotal = 150 + 50 = 200
    expect(grid.rows[2][3].value).toBe("200");
    // Total Item A = Mon + Tue = 100 + 150 = 250
    expect(grid.rows[3][1].value).toBe("250");
    // Total Item B = Mon + Tue = 200 + 50 = 250
    expect(grid.rows[3][2].value).toBe("250");
    // Total Subtotal = MonSub + TueSub = 300 + 200 = 500
    expect(grid.rows[3][3].value).toBe("500");
  });

  test("Integrates external Frontmatter variables", () => {
    const md = `
| Item | Cost |
| --- | --- |
| Hardware | 500 |
| Tax | :=B2*tax_rate |
| Total | :=(B2+B3)-discount |
    `.trim();

    const grid = parseMarkdownTable(md);
    expect(grid).not.toBeNull();
    if (!grid) return;

    // tax_rate = 0.05, discount = 20
    evaluateGrid(grid, { tax_rate: 0.05, discount: 20 });

    expect(grid.rows[2][1].value).toBe("25"); // 500 * 0.05
    expect(grid.rows[3][1].value).toBe("505"); // (500 + 25) - 20
  });

  test("Detects circular dependencies and returns #REF!", () => {
    const md = `
| A | B |
| --- | --- |
| :=B2+1 | :=A2+2 |
    `.trim();

    const grid = parseMarkdownTable(md);
    expect(grid).not.toBeNull();
    if (!grid) return;

    evaluateGrid(grid);

    expect(grid.rows[1][0].value).toBe("#REF!");
    expect(grid.rows[1][1].value).toBe("#REF!");
  });
});

describe("MD-XTable Renderer", () => {
  test("Renders evaluated grid to correct HTML elements with spans and styling", () => {
    const md = `
| Name | Role | Pay |
| :---[20%] | --- | ---: |
| Alice | Admin | 3000 |
| ^^ | < | :=C2*1.1 |
<!-- {.md-xtable #test-table width="100%"} -->
    `.trim();

    const grid = parseMarkdownTable(md);
    expect(grid).not.toBeNull();
    if (!grid) return;

    evaluateGrid(grid);

    const table = renderTable(grid);

    expect(table.tagName).toBe("TABLE");
    expect(table.id).toBe("test-table");
    expect(table.style.width).toBe("100%");

    const ths = table.querySelectorAll("thead th");
    expect(ths.length).toBe(3);
    expect((ths[0] as HTMLElement).style.width).toBe("20%");
    expect((ths[0] as HTMLElement).style.textAlign).toBe("left");
    expect((ths[2] as HTMLElement).style.textAlign).toBe("right");

    const trs = table.querySelectorAll("tbody tr");
    expect(trs.length).toBe(2);

    // Row 1 (body index 0): "Alice", "Admin", "3000".
    // Wait, the second body row is fully merged!
    // Let's check cell spans.
    // "Alice" at r=1, c=0 spans 2 rows and 2 columns because:
    // - Row 2 Col 0 is ^^ (merges into Alice)
    // - Row 2 Col 1 is < (merges left into Row 2 Col 0 which merges into Alice)
    // Wait, did Alice get colspan = 2?
    // Let's check the code:
    // Row 1 (index 2): Row 2 Col 0 is ^^. Row 2 Col 1 is <.
    // Let's check spans of rows[1][0] ("Alice") in grid.
    const aliceCell = grid.rows[1][0];
    expect(aliceCell.rowspan).toBe(2);
    // Wait, does Alice have colspan=2?
    // Let's trace: Row 1 Col 1 is "Admin". It is a normal cell (not merged).
    // So Alice has colspan=1.
    // What about Row 2 Col 1 ("<")? It merges left into Row 2 Col 0 ("^^"), which merges up into Alice.
    // So Row 2 Col 1 merges into Alice!
    // Since Row 2 Col 1 merges into Alice, Alice's colsCovered gets 1.
    // So Alice.colspan should be 2!
    // Wait! Let's check if the HTML renderer respects this.
    // Since Alice has rowspan=2 and colspan=2, in the HTML output,
    // the td for Alice should have rowSpan = 2 and colSpan = 2.
    // Let's verify:
    const tdAlice = trs[0].querySelector("td");
    expect(tdAlice).not.toBeNull();
    if (!tdAlice) return;
    expect(tdAlice.textContent).toBe("Alice");
    expect(tdAlice.rowSpan).toBe(2);
    expect(tdAlice.colSpan).toBe(2);

    // The formula cell is at Row 2, Col 2 (body row 1, col 2)
    // Since Row 2 Col 0 and 1 are merged, the only visible cell in the second body row is Col 2.
    const tdFormula = trs[1].querySelector("td");
    expect(tdFormula).not.toBeNull();
    if (!tdFormula) return;
    expect(tdFormula.textContent).toBe("3300.00"); // 3000 * 1.1
    expect(tdFormula.classList.contains("md-xtable-formula")).toBe(true);
    expect(tdFormula.getAttribute("data-formula")).toBe("C2*1.1");
  });
});
