# Adjacent product rows in Print Quote

Quote printing now groups equivalent product names for ordering purposes, normalizing dash / slash separators, spacing and case. Original rows, size cells, heat colours, factory SKU labels, quantities and totals remain separate and unchanged. Each product's rows share a print row group to avoid splitting the product across pages when it fits. Screen matrices and receiving print behavior are unchanged.

The screenshot fixture now prints Black (100, 220), Black&Pink (50, 260), Grey (570), then Teal (150, 150), retaining seven rows and total quantity 1,500. Two regression tests verify adjacency, distinct colours, stable split rows and unchanged input objects. Typecheck, targeted lint and production build pass.
