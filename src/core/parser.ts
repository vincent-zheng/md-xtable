import { Cell, ColMeta, TableMeta, TableGrid } from "./types";

export function splitCells(rowText: string): string[] {
  let txt = rowText.trim();
  if (txt.startsWith("|"))
    txt = txt.slice(1);
  if (txt.endsWith("|"))
    txt = txt.slice(0, -1);
  const cells: string[] = [];
  let currentCell = "";
  for (let i = 0; i < txt.length; i++) {
    const char = txt[i];
    if (char === "\\" && i + 1 < txt.length && txt[i + 1] === "|") {
      currentCell += "|";
      i++;
    } else if (char === "|") {
      cells.push(currentCell.trim());
      currentCell = "";
    } else {
      currentCell += char;
    }
  }
  cells.push(currentCell.trim());
  return cells;
}

export function parseSeparatorRow(rowText: string): ColMeta[] | null {
  const cells = splitCells(rowText);
  const colsMeta: ColMeta[] = [];
  const sepRegex = /^\s*(:?)-+(\[[^\]]+\])?(:?)\s*$/;
  for (const cell of cells) {
    const match = cell.match(sepRegex);
    if (!match) {
      return null;
    }
    const hasLeftColon = !!match[1];
    const widthRaw = match[2];
    const hasRightColon = !!match[3];
    let align: "default" | "left" | "center" | "right" = "default";
    if (hasLeftColon && hasRightColon) {
      align = "center";
    } else if (hasRightColon) {
      align = "right";
    } else if (hasLeftColon) {
      align = "left";
    }
    let width: string | undefined;
    if (widthRaw) {
      width = widthRaw.slice(1, -1).trim();
    }
    colsMeta.push({ align, width });
  }
  return colsMeta;
}

export function parseTableMeta(commentText: string): TableMeta | null {
  const match = commentText.match(/<!--\s*\{\.md-xtable\s+([^}]+)\}\s*-->/);
  if (!match)
    return null;
  const attrStr = match[1];
  const attributes: Record<string, string> = {};
  const classes: string[] = [];
  let id: string | undefined;
  let width: string | undefined;
  let calc: "auto" | "manual" | undefined;
  const classRegex = /\.([^\s#=]+)/g;
  const idRegex = /#([^\s#=]+)/g;
  const kvRegex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
  let m;
  while ((m = classRegex.exec(attrStr)) !== null) {
    classes.push(m[1]);
  }
  classRegex.lastIndex = 0;
  while ((m = idRegex.exec(attrStr)) !== null) {
    id = m[1];
  }
  idRegex.lastIndex = 0;
  while ((m = kvRegex.exec(attrStr)) !== null) {
    const key = m[1];
    const val = m[2] || m[3] || m[4];
    if (key === "id") {
      id = val;
    } else if (key === "class") {
      classes.push(val);
    } else if (key === "width") {
      width = val;
    } else if (key === "calc") {
      if (val === "auto" || val === "manual") {
        calc = val;
      }
    } else {
      attributes[key] = val;
    }
  }
  kvRegex.lastIndex = 0;
  return {
    id,
    className: classes.length > 0 ? classes.join(" ") : undefined,
    width,
    calc,
    attributes
  };
}

export function parseMarkdownTable(markdown: string): TableGrid | null {
  const lines = markdown.split(/\r?\n/).map((l) => l.trim());
  if (lines.length < 2)
    return null;
  let separatorRowIndex = -1;
  let colsMeta: ColMeta[] | null = null;
  for (let i = 1; i < Math.min(lines.length, 5); i++) {
    const meta = parseSeparatorRow(lines[i]);
    if (meta) {
      colsMeta = meta;
      separatorRowIndex = i;
      break;
    }
  }
  if (!colsMeta || separatorRowIndex === -1) {
    return null;
  }
  const headerLine = lines[separatorRowIndex - 1];
  const headerCells = splitCells(headerLine);
  const rawRows = [headerCells];
  let tableEndIndex = separatorRowIndex + 1;
  for (; tableEndIndex < lines.length; tableEndIndex++) {
    const line = lines[tableEndIndex];
    if (line === "" || !line.includes("|")) {
      break;
    }
    rawRows.push(splitCells(line));
  }
  let tableMeta: TableMeta = { attributes: {} };
  for (let i = tableEndIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line === "")
      continue;
    const meta = parseTableMeta(line);
    if (meta) {
      tableMeta = meta;
      break;
    }
    if (!line.startsWith("<!--"))
      break;
  }
  const R = rawRows.length;
  const C = colsMeta.length;
  const rows: Cell[][] = [];
  for (let r = 0; r < R; r++) {
    const rowCells: Cell[] = [];
    const rawCells = rawRows[r];
    for (let c = 0; c < C; c++) {
      const rawText = rawCells[c] || "";
      const isFormula = rawText.trim().startsWith(":=");
      const formula = isFormula ? rawText.trim().slice(2).trim() : undefined;
      rowCells.push({
        row: r,
        col: c,
        raw: rawText,
        value: isFormula ? "" : rawText,
        isFormula,
        formula,
        rowspan: 1,
        colspan: 1,
        isMerged: false
      });
    }
    rows.push(rowCells);
  }
  resolveCellMerges(rows, R, C);
  return {
    rows,
    colsMeta,
    tableMeta
  };
}

export function resolveCellMerges(rows: Cell[][], R: number, C: number): void {
  const rowsCovered: Record<string, Set<number>> = {};
  const colsCovered: Record<string, Set<number>> = {};
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const key = `${r},${c}`;
      rowsCovered[key] = new Set([r]);
      colsCovered[key] = new Set([c]);
    }
  }
  function getMaster(r: number, c: number): { row: number; col: number } {
    const cell = rows[r][c];
    if (cell.isMerged && cell.mergedInto) {
      return getMaster(cell.mergedInto.row, cell.mergedInto.col);
    }
    return { row: r, col: c };
  }
  for (let r = 0; r < R; r++) {
    for (let c = 1; c < C; c++) {
      const cell = rows[r][c];
      if (cell.raw.trim() === "<") {
        const masterCoord = getMaster(r, c - 1);
        cell.isMerged = true;
        cell.mergedInto = masterCoord;
        const mKey = `${masterCoord.row},${masterCoord.col}`;
        const currKey = `${r},${c}`;
        rowsCovered[currKey].forEach((row) => rowsCovered[mKey].add(row));
        colsCovered[currKey].forEach((col) => colsCovered[mKey].add(col));
      }
    }
  }
  for (let c = 0; c < C; c++) {
    for (let r = 1; r < R; r++) {
      const cell = rows[r][c];
      if (cell.raw.trim() === "^^") {
        const masterCoord = getMaster(r - 1, c);
        cell.isMerged = true;
        cell.mergedInto = masterCoord;
        const mKey = `${masterCoord.row},${masterCoord.col}`;
        const currKey = `${r},${c}`;
        rowsCovered[currKey].forEach((row) => rowsCovered[mKey].add(row));
        colsCovered[currKey].forEach((col) => colsCovered[mKey].add(col));
      }
    }
  }
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell = rows[r][c];
      if (!cell.isMerged) {
        const key = `${r},${c}`;
        cell.rowspan = rowsCovered[key].size;
        cell.colspan = colsCovered[key].size;
      }
    }
  }
}
