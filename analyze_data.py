import pandas as pd

path = "Data.xlsx"
xl = pd.ExcelFile(path)
lines = []
lines.append("SHEETS: " + str(xl.sheet_names))

for name in xl.sheet_names:
    df_raw = pd.read_excel(path, sheet_name=name, header=None)
    lines.append(f"\n=== SHEET: {name} ===")
    lines.append(f"Shape: {df_raw.shape[0]} rows x {df_raw.shape[1]} cols")
    lines.append("RAW first 25 rows:")
    lines.append(df_raw.head(25).to_string())

    df = pd.read_excel(path, sheet_name=name)
    lines.append("\nCOLUMNS: " + str(list(df.columns)))
    lines.append(f"ROWS: {len(df)}")
    lines.append("DTYPES:\n" + df.dtypes.to_string())
    lines.append("NULLS:\n" + df.isnull().sum().to_string())
    lines.append("UNIQUE per column:")
    for col in df.columns:
        nunique = df[col].nunique(dropna=True)
        lines.append(f"  {col}: {nunique} unique")
    lines.append("\nFULL RAW:")
    lines.append(df_raw.to_string())

    # parse as marker table if row0 is section header
    if str(df_raw.iloc[0, 0]) == "formular_marker":
        markers = df_raw.iloc[2:].copy()
        markers.columns = df_raw.iloc[1].tolist()
        markers = markers[markers["title"].notna()]
        lines.append("\nPARSED formular_marker rows: " + str(len(markers)))
        lines.append("is_flag counts:\n" + markers["is_flag"].value_counts().to_string())
        lines.append("order unique: " + str(sorted(markers["order"].dropna().unique().tolist())))
        lines.append("scale unique: " + str(sorted(markers["scale"].dropna().unique().tolist())))

    # detect second table blocks
    for i, row in df_raw.iterrows():
        val = row.iloc[0]
        if pd.notna(val) and i > 0 and str(val) not in ("title", "formular_marker") and row.iloc[1:4].isna().all():
            lines.append(f"\nPossible section header at row {i}: {val}")

with open("_data_xlsx_report.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print("written")