import { Prec } from "@codemirror/state";
import { Plugin, MarkdownPostProcessorContext } from "obsidian";
import { parseMarkdownTable } from "./core/parser";
import { evaluateGrid } from "./core/evaluator";
import { renderTable } from "./core/renderer";
import { tableLivePreviewField } from "./live-preview";

export default class MDXTablePlugin extends Plugin {
  async onload() {
    console.log("Loading MD-XTable Plugin...");
    
    // Register the Reading Mode post-processor
    this.registerMarkdownPostProcessor((el, ctx) => {
      this.processTable(el, ctx);
    });

    // Register the Live Preview Editor Extension with highest precedence to override native table widgets
    this.registerEditorExtension(Prec.highest(tableLivePreviewField(this)));
  }



  onunload() {
    console.log("Unloading MD-XTable Plugin...");
  }

  processTable(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const nativeTable = el.querySelector("table");
    if (!nativeTable) {
      return;
    }
    const sectionInfo = ctx.getSectionInfo(el);
    if (!sectionInfo)
      return;
    const lines = sectionInfo.text.split("\n");
    const tableLines = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1);
    const tableMarkdown = tableLines.join("\n");
    const grid = parseMarkdownTable(tableMarkdown);
    if (!grid)
      return;
    const contextVars = this.getVariablesContext();
    evaluateGrid(grid, contextVars);
    const newTable = renderTable(grid);

    let replacementNode: HTMLElement = newTable;
    const hasHeight = !!grid.tableMeta.attributes.height;
    const hasAlignment = grid.tableMeta.className &&
      (grid.tableMeta.className.includes("align-center") || grid.tableMeta.className.includes("align-right"));

    if (hasHeight || hasAlignment) {
      const wrapper = document.createElement("div");
      wrapper.className = "md-xtable-scroll-wrapper";
      if (grid.tableMeta.className) {
        wrapper.className += " " + grid.tableMeta.className;
      }
      if (hasHeight) {
        wrapper.style.maxHeight = grid.tableMeta.attributes.height;
        wrapper.style.overflowY = "auto";
      }
      wrapper.appendChild(newTable);
      replacementNode = wrapper;
    }

    nativeTable.replaceWith(replacementNode);
  }


  /**
   * Resolves numeric frontmatter variables and Dataview inline fields for the active file.
   */
  getVariablesContext(): Record<string, number> {
    const contextVars: Record<string, number> = {};
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile)
      return contextVars;
    let frontmatter: Record<string, any> = {};
    const cache = this.app.metadataCache.getFileCache(activeFile);
    if (cache && cache.frontmatter) {
      frontmatter = { ...cache.frontmatter };
    }
    
    // Support dataview variables integration
    const dv = (this.app as any).plugins?.plugins?.dataview?.api;
    if (dv) {
      try {
        const page = dv.page(activeFile.path);
        if (page) {
          frontmatter = { ...frontmatter, ...page };
        }
      } catch (e) {
        // Ignore Dataview errors
      }
    }
    for (const [key, val] of Object.entries(frontmatter)) {
      if (typeof val === "number") {
        contextVars[key] = val;
      } else if (typeof val === "string") {
        const cleaned = val.replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
        const num = parseFloat(cleaned);
        if (!isNaN(num)) {
          contextVars[key] = num;
        }
      }
    }
    return contextVars;
  }
}
