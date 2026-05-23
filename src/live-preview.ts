import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { StateField, Range, EditorSelection } from "@codemirror/state";
import { parseMarkdownTable } from "./core/parser";
import { evaluateGrid } from "./core/evaluator";
import { renderTable } from "./core/renderer";
import MDXTablePlugin from "./main";

class TableWidget extends WidgetType {
  // 不再需要 startPos
  constructor(public markdown: string, public plugin: MDXTablePlugin) {
    super();
  }

  eq(other: TableWidget) {
    return this.markdown === other.markdown;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "md-xtable-preview-wrapper";

    const grid = parseMarkdownTable(this.markdown);
    if (!grid) {
      const errorEl = document.createElement("div");
      errorEl.className = "md-xtable-error";
      errorEl.textContent = "Error parsing table";
      return errorEl;
    }

    const contextVars = this.plugin.getVariablesContext();
    evaluateGrid(grid, contextVars);
    const tableEl = renderTable(grid);

    if (grid.tableMeta.attributes.height) {
      wrapper.style.maxHeight = grid.tableMeta.attributes.height;
      wrapper.style.overflowY = "auto";
    }

    if (grid.tableMeta.className) {
      wrapper.className += " " + grid.tableMeta.className;
    }

    wrapper.appendChild(tableEl);
    return wrapper;
  }
}

export function tableLivePreviewField(plugin: MDXTablePlugin) {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildTableDecorations(state, plugin);
    },
    update(decorations, tr) {
      // 现在的逻辑极简：只要用户修改了文档文字，才重新计算表格
      if (tr.docChanged) {
        return buildTableDecorations(tr.state, plugin);
      }
      return decorations.map(tr.changes);
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}

function buildTableDecorations(state: any, plugin: MDXTablePlugin): DecorationSet {
  const builder: Range<Decoration>[] = [];
  const doc = state.doc;

  const blocks = findTableBlocks(doc);

  for (const block of blocks) {
    // 核心改变：使用纯 widget 而不是 replace。
    // 这会在文档流中插入一块新的 DOM，而不隐藏原本的 Markdown。
    const widgetDeco = Decoration.widget({
      widget: new TableWidget(block.text, plugin),
      block: true, // 声明这是一个占据一整行的块级元素
      side: 1      // side: 1 表示放在挂载点的下方
    });

    // 挂载在表格源码块的最后一个字符的位置 (block.end)
    builder.push(widgetDeco.range(block.end));
  }

  // CodeMirror 严格要求必须按位置排序
  builder.sort((a, b) => a.from - b.from);

  try {
    return Decoration.set(builder);
  } catch (error) {
    console.error("MD-XTable Debug -> DecorationSet 构建失败:", error);
    return Decoration.none;
  }
}


function findTableBlocks(doc: any): { start: number, end: number, text: string }[] {
  const blocks: { start: number, end: number, text: string }[] = [];
  const linesCount = doc.lines;
  let inTable = false;
  let tableLines: string[] = [];
  let tableStartPos = -1;
  let tableEndPos = -1;

  for (let i = 1; i <= linesCount; i++) {
    const line = doc.line(i);
    const text = line.text;
    const isTableLine = text.trim().startsWith("|") || text.includes("|");

    if (isTableLine) {
      if (!inTable) {
        inTable = true;
        tableLines = [text];
        tableStartPos = line.from;
      } else {
        tableLines.push(text);
      }
      tableEndPos = line.to;
    } else {
      if (inTable) {
        if (text.trim().startsWith("<!--") && text.includes(".md-xtable")) {
          tableLines.push(text);
          tableEndPos = line.to;
          const tableText = tableLines.join("\n");
          if (isValidTable(tableText)) {
            blocks.push({ start: tableStartPos, end: tableEndPos, text: tableText });
          }
          inTable = false;
          tableLines = [];
        } else {
          const tableText = tableLines.join("\n");
          if (isValidTable(tableText)) {
            blocks.push({ start: tableStartPos, end: tableEndPos, text: tableText });
          }
          inTable = false;
          tableLines = [];
        }
      }
    }
  }

  if (inTable && tableLines.length > 0) {
    const tableText = tableLines.join("\n");
    if (isValidTable(tableText)) {
      blocks.push({ start: tableStartPos, end: tableEndPos, text: tableText });
    }
  }

  return blocks;
}

function isMDXTable(tableText: string): boolean {
  if (tableText.includes(".md-xtable")) {
    return true;
  }
  // Check for formulas
  if (tableText.includes(":=")) {
    return true;
  }
  // Check for cell merges
  const lines = tableText.split("\n");
  for (const line of lines) {
    const cells = line.split("|").map(c => c.trim());
    if (cells.some(c => c === "<" || c === "^^")) {
      return true;
    }
  }
  return false;
}

function isValidTable(tableText: string): boolean {
  try {
    if (!isMDXTable(tableText)) {
      return false;
    }
    return parseMarkdownTable(tableText) !== null;
  } catch (e) {
    return false;
  }
}

function shouldRenderTable(start: number, end: number, selectionRanges: readonly any[]): boolean {
  for (const range of selectionRanges) {
    if (range.to >= start && range.from <= end) {
      return false;
    }
  }
  return true;
}
