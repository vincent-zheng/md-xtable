import { Cell, TableGrid } from "./types";

interface Token {
  type: "LPAREN" | "RPAREN" | "COMMA" | "OPERATOR" | "NUMBER" | "CELL" | "RANGE" | "IDENTIFIER" | "EOF";
  value: string;
}

export function colLetterToNum(letter: string): number {
  let num = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    num = num * 26 + (upper.charCodeAt(i) - 64);
  }
  return num - 1;
}

export function numToColLetter(num: number): string {
  let temp = num;
  let letter = "";
  while (temp >= 0) {
    letter = String.fromCharCode(temp % 26 + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function parseCoordinate(coord: string): { row: number; col: number } {
  const match = coord.match(/^([A-Z]+)([0-9]+)$/i);
  if (!match) {
    throw new Error(`Invalid coordinate: ${coord}`);
  }
  const colLetter = match[1];
  const rowNum = parseInt(match[2], 10);
  return {
    col: colLetterToNum(colLetter),
    row: rowNum - 1
  };
}

export function preprocessRelativeReferences(formula: string, r: number, c: number): string {
  const colLetter = numToColLetter(c);
  let upReplacement = "0";
  if (r >= 2) {
    upReplacement = `${colLetter}2:${colLetter}${r}`;
  } else if (r === 1) {
    upReplacement = "0";
  }
  let leftReplacement = "0";
  if (c >= 1) {
    const prevColLetter = numToColLetter(c - 1);
    const formulaRow = r + 1;
    leftReplacement = `A${formulaRow}:${prevColLetter}${formulaRow}`;
  }
  let processed = formula.replace(/\[UP\]/gi, upReplacement);
  processed = processed.replace(/\[LEFT\]/gi, leftReplacement);
  return processed;
}

export function tokenize(expr: string): Token[] {
  const cleanExpr = expr.replace(/\s+/g, "");
  const tokens: Token[] = [];
  let i = 0;
  while (i < cleanExpr.length) {
    const char = cleanExpr[i];
    if (char === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "COMMA", value: "," });
      i++;
      continue;
    }
    if (["+", "-", "*", "/"].includes(char)) {
      tokens.push({ type: "OPERATOR", value: char });
      i++;
      continue;
    }
    if (/[0-9]/.test(char) || (char === "." && i + 1 < cleanExpr.length && /[0-9]/.test(cleanExpr[i + 1]))) {
      let numStr = "";
      while (i < cleanExpr.length && /[0-9.]/.test(cleanExpr[i])) {
        numStr += cleanExpr[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value: numStr });
      continue;
    }
    if (/[a-zA-Z_]/.test(char)) {
      let idStr = "";
      while (i < cleanExpr.length && /[a-zA-Z0-9_:]/.test(cleanExpr[i])) {
        idStr += cleanExpr[i];
        i++;
      }
      if (/^[a-zA-Z]+[0-9]+:[a-zA-Z]+[0-9]+$/.test(idStr)) {
        tokens.push({ type: "RANGE", value: idStr.toUpperCase() });
      } else if (/^[a-zA-Z]+[0-9]+$/.test(idStr)) {
        tokens.push({ type: "CELL", value: idStr.toUpperCase() });
      } else {
        tokens.push({ type: "IDENTIFIER", value: idStr });
      }
      continue;
    }
    throw new Error(`Unexpected character at position ${i}: ${char}`);
  }
  tokens.push({ type: "EOF", value: "" });
  return tokens;
}

export function safeParseFloat(val: string): number {
  if (!val)
    return 0;
  const clean = val.replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export function evaluateGrid(grid: TableGrid, context: Record<string, number> = {}): void {
  const rows = grid.rows;
  const R = rows.length;
  const C = R > 0 ? rows[0].length : 0;
  const formulaTokens: Record<string, Token[]> = {};
  const dependencies: Record<string, string[]> = {};
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell = rows[r][c];
      if (cell.isFormula && cell.formula) {
        const key = `${r},${c}`;
        const preprocessed = preprocessRelativeReferences(cell.formula, r, c);
        try {
          const tokens = tokenize(preprocessed);
          formulaTokens[key] = tokens;
          const deps: string[] = [];
          for (const token of tokens) {
            if (token.type === "CELL") {
              const coord = parseCoordinate(token.value);
              deps.push(`${coord.row},${coord.col}`);
            } else if (token.type === "RANGE") {
              const parts = token.value.split(":");
              const start = parseCoordinate(parts[0]);
              const end = parseCoordinate(parts[1]);
              const rStart = Math.min(start.row, end.row);
              const rEnd = Math.max(start.row, end.row);
              const cStart = Math.min(start.col, end.col);
              const cEnd = Math.max(start.col, end.col);
              for (let dr = rStart; dr <= rEnd; dr++) {
                for (let dc = cStart; dc <= cEnd; dc++) {
                  deps.push(`${dr},${dc}`);
                }
              }
            }
          }
          dependencies[key] = deps;
        } catch (e) {
          cell.value = `#ERROR!`;
        }
      }
    }
  }
  const visited: Record<string, "visiting" | "visited"> = {};
  const evalOrder: string[] = [];
  const cycles = new Set<string>();
  const stack: string[] = [];
  
  function dfs(key: string): void {
    if (visited[key] === "visiting") {
      const index = stack.indexOf(key);
      if (index !== -1) {
        for (let i = index; i < stack.length; i++) {
          cycles.add(stack[i]);
        }
      }
      cycles.add(key);
      return;
    }
    if (visited[key] === "visited")
      return;
    visited[key] = "visiting";
    stack.push(key);
    const deps = dependencies[key] || [];
    for (const dep of deps) {
      if (dependencies[dep]) {
        dfs(dep);
      }
    }
    stack.pop();
    visited[key] = "visited";
    evalOrder.push(key);
  }
  for (const key of Object.keys(dependencies)) {
    if (!visited[key]) {
      dfs(key);
    }
  }
  for (const key of cycles) {
    const [r, c] = key.split(",").map(Number);
    rows[r][c].value = "#REF!";
  }
  for (const key of evalOrder) {
    if (cycles.has(key))
      continue;
    const [r, c] = key.split(",").map(Number);
    const cell = rows[r][c];
    const tokens = formulaTokens[key];
    if (!tokens)
      continue;
    try {
      let tokenIndex = 0;
      const peek = () => tokens[tokenIndex];
      const consume = (expectedType?: string) => {
        const t = tokens[tokenIndex];
        if (expectedType && t.type !== expectedType) {
          throw new Error(`Expected ${expectedType}, got ${t.type}`);
        }
        tokenIndex++;
        return t;
      };
      const parseExpression = (): number => {
        let val = parseTerm();
        while (peek().type === "OPERATOR" && (peek().value === "+" || peek().value === "-")) {
          const op = consume().value;
          const right = parseTerm();
          if (op === "+")
            val += right;
          else
            val -= right;
        }
        return val;
      };
      const parseTerm = (): number => {
        let val = parseFactor();
        while (peek().type === "OPERATOR" && (peek().value === "*" || peek().value === "/")) {
          const op = consume().value;
          const right = parseFactor();
          if (op === "*")
            val *= right;
          else {
            if (right === 0)
              throw new Error("Division by zero");
            val /= right;
          }
        }
        return val;
      };
      const parseFactor = (): number => {
        const t = peek();
        if (t.type === "NUMBER") {
          consume();
          return parseFloat(t.value);
        }
        if (t.type === "OPERATOR" && (t.value === "+" || t.value === "-")) {
          const op = consume().value;
          const val = parseFactor();
          return op === "-" ? -val : val;
        }
        if (t.type === "LPAREN") {
          consume();
          const val = parseExpression();
          consume("RPAREN");
          return val;
        }
        if (t.type === "CELL") {
          consume();
          const coord = parseCoordinate(t.value);
          if (coord.row < 0 || coord.row >= R || coord.col < 0 || coord.col >= C) {
            return 0;
          }
          return safeParseFloat(rows[coord.row][coord.col].value);
        }
        if (t.type === "IDENTIFIER") {
          const name = consume().value;
          if (peek().type === "LPAREN") {
            consume("LPAREN");
            const args: (number | number[])[] = [];
            if (peek().type !== "RPAREN") {
              args.push(parseArgument());
              while (peek().type === "COMMA") {
                consume("COMMA");
                args.push(parseArgument());
              }
            }
            consume("RPAREN");
            return evalFunction(name, args);
          } else {
            const keyLower = name.toLowerCase();
            const ctxKey = Object.keys(context).find(
              (k) => k.toLowerCase() === keyLower
            );
            if (ctxKey !== undefined) {
              return context[ctxKey];
            }
            throw new Error(`Undefined variable: ${name}`);
          }
        }
        throw new Error(`Unexpected token: ${t.type} (${t.value})`);
      };
      const parseArgument = (): number | number[] => {
        if (peek().type === "RANGE") {
          const rToken = consume();
          const parts = rToken.value.split(":");
          const start = parseCoordinate(parts[0]);
          const end = parseCoordinate(parts[1]);
          const rStart = Math.min(start.row, end.row);
          const rEnd = Math.max(start.row, end.row);
          const cStart = Math.min(start.col, end.col);
          const cEnd = Math.max(start.col, end.col);
          const values: number[] = [];
          for (let dr = rStart; dr <= rEnd; dr++) {
            for (let dc = cStart; dc <= cEnd; dc++) {
              if (dr >= 0 && dr < R && dc >= 0 && dc < C) {
                values.push(safeParseFloat(rows[dr][dc].value));
              }
            }
          }
          return values;
        }
        return parseExpression();
      };
      const evalFunction = (name: string, args: (number | number[])[]): number => {
        const flat: number[] = [];
        for (const arg of args) {
          if (Array.isArray(arg)) {
            flat.push(...arg);
          } else {
            flat.push(arg);
          }
        }
        const upperName = name.toUpperCase();
        if (upperName === "SUM") {
          return flat.reduce((s, v) => s + v, 0);
        }
        if (upperName === "AVERAGE") {
          if (flat.length === 0)
            return 0;
          return flat.reduce((s, v) => s + v, 0) / flat.length;
        }
        if (upperName === "COUNT") {
          return flat.length;
        }
        if (upperName === "PRODUCT") {
          if (flat.length === 0)
            return 0;
          return flat.reduce((p, v) => p * v, 1);
        }
        throw new Error(`Unknown function: ${name}`);
      };
      const result = parseExpression();
      consume("EOF");
      cell.value = Number.isInteger(result) ? result.toString() : result.toFixed(2);
    } catch (e) {
      cell.value = `#VALUE!`;
    }
  }
}
