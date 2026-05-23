import { TableGrid, ColMeta } from "./types";

export function renderTable(grid: TableGrid, doc: Document = document): HTMLTableElement {
  const table = doc.createElement("table");
  if (grid.tableMeta.id) {
    table.id = grid.tableMeta.id;
  }
  table.className = "md-xtable";
  if (grid.tableMeta.className) {
    table.className += " " + grid.tableMeta.className;
  }
  if (grid.tableMeta.width) {
    table.style.width = grid.tableMeta.width;
  }
  for (const [key, val] of Object.entries(grid.tableMeta.attributes)) {
    table.setAttribute(key, val);
  }
  const rows = grid.rows;
  if (rows.length === 0)
    return table;
  const thead = doc.createElement("thead");
  const headRow = doc.createElement("tr");
  const headCells = rows[0];
  for (let c = 0; c < headCells.length; c++) {
    const cell = headCells[c];
    if (cell.isMerged)
      continue;
    const th = doc.createElement("th");
    th.textContent = cell.value;
    if (cell.colspan > 1)
      th.colSpan = cell.colspan;
    if (cell.rowspan > 1)
      th.rowSpan = cell.rowspan;
    applyColumnStyles(th, c, grid.colsMeta);
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);
  if (rows.length > 1) {
    const tbody = doc.createElement("tbody");
    for (let r = 1; r < rows.length; r++) {
      const tr = doc.createElement("tr");
      const bodyCells = rows[r];
      for (let c = 0; c < bodyCells.length; c++) {
        const cell = bodyCells[c];
        if (cell.isMerged)
          continue;
        const td = doc.createElement("td");
        if (cell.isFormula) {
          td.classList.add("md-xtable-formula");
          td.setAttribute("data-formula", cell.formula || "");
        }
        td.textContent = cell.value;
        if (cell.colspan > 1)
          td.colSpan = cell.colspan;
        if (cell.rowspan > 1)
          td.rowSpan = cell.rowspan;
        applyColumnStyles(td, c, grid.colsMeta);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
  }
  return table;
}

export function applyColumnStyles(el: HTMLElement, colIndex: number, colsMeta: ColMeta[]): void {
  const meta = colsMeta[colIndex];
  if (!meta)
    return;
  if (meta.align === "left") {
    el.style.textAlign = "left";
  } else if (meta.align === "center") {
    el.style.textAlign = "center";
  } else if (meta.align === "right") {
    el.style.textAlign = "right";
  }
  if (meta.width) {
    el.style.width = meta.width;
  }
}
