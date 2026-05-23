export interface Cell {
  row: number;
  col: number;
  raw: string;
  value: string;
  isFormula: boolean;
  formula?: string;
  rowspan: number;
  colspan: number;
  isMerged: boolean;
  mergedInto?: { row: number; col: number };
}

export interface ColMeta {
  align: "default" | "left" | "center" | "right";
  width?: string;
}

export interface TableMeta {
  id?: string;
  className?: string;
  width?: string;
  calc?: "auto" | "manual";
  attributes: Record<string, string>;
}

export interface TableGrid {
  rows: Cell[][];
  colsMeta: ColMeta[];
  tableMeta: TableMeta;
}
