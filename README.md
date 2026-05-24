# MD-XTable (Markdown Extended Table)

A revolutionary, human-readable extension for Markdown tables. Bring the power of Excel (cell merging, formulas, and width control) into pure text, while maintaining 100% Graceful Degradation with standard Markdown parsers.

---

## ✨ Features

- **Visual Intuition**: Use directional arrows (`<`, `^^`) for cell merging.
- **Smart Calculation**: Relative semantic macros (`[UP]`, `[LEFT]`) instead of fragile A1 coordinates.
- **Layout Control**: Native column width definitions right on the separator line.
- **Obsidian Ready**: Designed to seamlessly integrate with Obsidian's Live Preview and Reading Mode.

---

## ⚙️ Installation

### Method 1: Community Plugins (Recommended)
Once the plugin is published on the Obsidian Community Plugins directory:
1. Open **Obsidian Settings**.
2. Navigate to **Community plugins** and click **Browse**.
3. Search for **MD-XTable**.
4. Click **Install**, then click **Enable**.

### Method 2: Manual Installation
For manual installation or testing pre-releases:
1. Navigate to the [Releases](https://github.com/vincent-zheng/obsidian-md-xtable/releases) page.
2. Download `main.js`, `manifest.json`, and `styles.css`.
3. Create a folder named `md-xtable` in your vault's plugins directory:
   `<vault>/.obsidian/plugins/md-xtable/`
4. Copy the downloaded files into that folder.
5. Reload Obsidian plugins and toggle **MD-XTable** to **Enabled**.

### Method 3: Build from Source
To compile and install the plugin yourself:
1. Clone this repository to your local machine.
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugins folder:
   `<vault>/.obsidian/plugins/md-xtable/`
5. Enable the plugin in your Obsidian settings.

---

## 📖 Usage & Syntax Guide

### 1. Column Width (`---[width]`)
Define column widths directly inside the separator line of the table using percentages (`%`), pixels (`px`), or fractions (`fr`).

```markdown
| Product | Qty | Price | Total |
| :---[40%] | ---[20%]: | ---[20%]: | ---[20%]: |
| Apple | 10 | 5.00 | 50.00 |
```

---

### 2. Cell Merging
Merge cells horizontally and vertically with natural GFM text notation:
- Use `<` to merge a cell with the cell to its left (Colspan).
- Use `^^` to merge a cell with the cell directly above it (Rowspan).

```markdown
| Project | Lead | Budget | Notes |
| --- | --- | --- | --- |
| Refactor | Alice | 5000 | Core |
| ^^ | Bob | < | Support |
```
*In the example above, the "Refactor" cell spans 2 rows downward, and the "Bob" cell spans 2 columns to the right.*

---

### 3. Formula Calculations (`:=`)
Calculate cell values automatically using spreadsheet-like formulas starting with `:=`.

#### Basic Formulas & Cell References
Use standard cell references (e.g. `A2`, `B3`) and basic math operators (`+`, `-`, `*`, `/`):
```markdown
| Price | Qty | Total |
| --- | --- | --- |
| 1500 | 2 | :=A2*B2 |
| 800 | 1 | :=A3*B3 |
```

#### Aggregate Functions
We support `SUM` and `AVERAGE` functions over cell ranges:
```markdown
| Category | Amount |
| --- | --- |
| Rent | 1200 |
| Food | 300 |
| Utilities | 150 |
| Total | :=SUM(B2:B4) |
| Average | :=AVERAGE(B2:B4) |
```

#### Relative Ranges (`[UP]` and `[LEFT]`)
To keep your tables robust and maintainable when inserting/deleting rows, use relative coordinate macros:
- `[LEFT]`: Sum/average all numeric cells to the left of the formula cell.
- `[UP]`: Sum/average all numeric cells above the formula cell.

```markdown
| Day | Item A | Item B | Subtotal |
| --- | --- | --- | --- |
| Mon | 100 | 200 | :=SUM([LEFT]) |
| Tue | 150 | 50 | :=SUM([LEFT]) |
| Total | :=SUM([UP]) | :=SUM([UP]) | :=SUM([UP]) |
```

#### Frontmatter / Dataview Variables Integration
You can use variables defined in the note's frontmatter or Dataview inline fields:
```markdown
| Item | Cost |
| --- | --- |
| Hardware | 500 |
| Tax | :=B2*tax_rate |
| Total | :=(B2+B3)-discount |
```
*(If your page frontmatter contains `tax_rate: 0.05` and `discount: 20`, the formula will evaluate using those values).*

---

### 4. Table Metadata Attributes
Configure custom styling, classes, IDs, alignments, or custom attributes by adding an HTML comment directly below the table:

```markdown
| A | B |
| --- | --- |
| 1 | 2 |
<!-- {.md-xtable #my-custom-id .striped .nowrap width="80%" align="center"} -->
```

Supported attributes:
- `#my-id`: Custom HTML element ID.
- `.class-name`: Additional CSS classes (e.g. `.striped` for zebra-striping, `.nowrap` to prevent cell wrapping).
- `width`: Table-level custom width (e.g. `80%`, `600px`).
- `align`: Table alignment (`center`, `right`).
- Any custom HTML key-value attribute (e.g. `custom-attr="hello"`).
