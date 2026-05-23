# MD-XTable (Markdown Extended Table)

A revolutionary, human-readable extension for Markdown tables. Bring the power of Excel (cell merging, formulas, and width control) into pure text, while maintaining 100% Graceful Degradation with standard Markdown parsers.

## ✨ Features

- **Visual Intuition**: Use directional arrows (`<`, `^^`) for cell merging.
- **Smart Calculation**: Relative semantic macros (`[UP]`, `[LEFT]`) instead of fragile A1 coordinates.
- **Layout Control**: Native column width definitions right on the separator line.
- **Obsidian Ready**: Designed to seamlessly integrate with Obsidian's Live Preview and ecosystem.

---

## 📖 Syntax Guide

### 1. Column Width (`---[width]`)

Define column widths directly on the separator line using percentages (`%`), pixels (`px`), or fractions (`fr`). Set table-level attributes below the table.

```markdown
| Product | Qty | Price | Total |
| :---[40%] | ---[20%]: | ---[20%]: | ---[20%]: |
| Apple | 10 | 5.00 | 50.00 |

<!-- {.md-xtable width="80%" align="center"} -->
```
