"""Standalone InfoLake coordinate converter (WGS 84 DD ↔ DMS)."""

from __future__ import annotations

import sys
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from coords import (
    SAMPLE_LAT_DD,
    SAMPLE_LAT_DMS,
    SAMPLE_LAT_DMS_RU,
    SAMPLE_LNG_DD,
    SAMPLE_LNG_DMS,
    SAMPLE_LNG_DMS_RU,
    CoordError,
    format_dd,
    format_dms,
    parse_dd,
    parse_dms,
)
from xlsx_io import convert_files, save_template

APP_TITLE = "Конвертер координат InfoLake"
APP_SIZE = "780x620"


class ConverterApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(APP_TITLE)
        self.geometry(APP_SIZE)
        self.minsize(720, 560)
        self.files: list[Path] = []
        self.output_dir = tk.StringVar(value="")
        self.single_mode = tk.StringVar(value="to_dms")
        self.batch_mode = tk.StringVar(value="to_dms")
        self._build()

    def _build(self) -> None:
        pad = {"padx": 12, "pady": 8}
        header = ttk.Frame(self)
        header.pack(fill="x", **pad)
        ttk.Label(
            header,
            text="WGS 84 / EPSG:4326  ·  как в InfoLake (десятичные градусы, 6 знаков)",
        ).pack(anchor="w")

        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=12, pady=(0, 12))

        single = ttk.Frame(notebook, padding=12)
        batch = ttk.Frame(notebook, padding=12)
        notebook.add(single, text="Одна точка")
        notebook.add(batch, text="Пакет xlsx")
        self._build_single(single)
        self._build_batch(batch)

    def _build_single(self, parent: ttk.Frame) -> None:
        mode = ttk.LabelFrame(parent, text="Направление", padding=8)
        mode.pack(fill="x")
        ttk.Radiobutton(
            mode,
            text="Десятичные градусы → градусы, минуты, секунды",
            variable=self.single_mode,
            value="to_dms",
            command=self._sync_single_labels,
        ).pack(anchor="w")
        ttk.Radiobutton(
            mode,
            text="Градусы, минуты, секунды → десятичные градусы",
            variable=self.single_mode,
            value="to_dd",
            command=self._sync_single_labels,
        ).pack(anchor="w")

        form = ttk.Frame(parent)
        form.pack(fill="x", pady=12)
        form.columnconfigure(1, weight=1)

        self.lat_label = ttk.Label(form, text="Широта")
        self.lng_label = ttk.Label(form, text="Долгота")
        self.lat_entry = ttk.Entry(form)
        self.lng_entry = ttk.Entry(form)
        self.lat_label.grid(row=0, column=0, sticky="w", padx=(0, 8), pady=4)
        self.lat_entry.grid(row=0, column=1, sticky="ew", pady=4)
        self.lng_label.grid(row=1, column=0, sticky="w", padx=(0, 8), pady=4)
        self.lng_entry.grid(row=1, column=1, sticky="ew", pady=4)
        self.lat_entry.insert(0, "55.751244")
        self.lng_entry.insert(0, "37.618423")

        ttk.Button(parent, text="Конвертировать", command=self._convert_single).pack(anchor="w")

        sample = ttk.LabelFrame(parent, text="Образец: как писать градусы, минуты, секунды", padding=8)
        sample.pack(fill="x", pady=(12, 0))
        ttk.Label(sample, text='Шаблон:   Г°ММ\'СС.ссс" полушарие').pack(anchor="w")
        ttk.Label(sample, text=f"Широта:   {SAMPLE_LAT_DMS}     или     {SAMPLE_LAT_DMS_RU}").pack(anchor="w")
        ttk.Label(sample, text=f"Долгота:  {SAMPLE_LNG_DMS}     или     {SAMPLE_LNG_DMS_RU}").pack(anchor="w")
        ttk.Label(
            sample,
            text="N / с.ш. = север,  S / ю.ш. = юг,  E / в.д. = восток,  W / з.д. = запад.  Минуты и секунды — 0…59.",
        ).pack(anchor="w", pady=(4, 0))

        out = ttk.LabelFrame(parent, text="Результат", padding=8)
        out.pack(fill="both", expand=True, pady=(12, 0))
        self.lat_out = tk.StringVar()
        self.lng_out = tk.StringVar()
        ttk.Label(out, text="Широта").grid(row=0, column=0, sticky="w", padx=(0, 8), pady=4)
        ttk.Entry(out, textvariable=self.lat_out, state="readonly").grid(row=0, column=1, sticky="ew", pady=4)
        ttk.Label(out, text="Долгота").grid(row=1, column=0, sticky="w", padx=(0, 8), pady=4)
        ttk.Entry(out, textvariable=self.lng_out, state="readonly").grid(row=1, column=1, sticky="ew", pady=4)
        out.columnconfigure(1, weight=1)
        btns = ttk.Frame(out)
        btns.grid(row=2, column=0, columnspan=2, sticky="w", pady=(8, 0))
        ttk.Button(btns, text="Копировать широту", command=lambda: self._copy(self.lat_out.get())).pack(side="left", padx=(0, 8))
        ttk.Button(btns, text="Копировать долготу", command=lambda: self._copy(self.lng_out.get())).pack(side="left")
        self._sync_single_labels()

    def _build_batch(self, parent: ttk.Frame) -> None:
        mode = ttk.LabelFrame(parent, text="Направление", padding=8)
        mode.pack(fill="x")
        ttk.Radiobutton(
            mode,
            text="Десятичные градусы → DMS (колонки lat / lng или широта / долгота)",
            variable=self.batch_mode,
            value="to_dms",
        ).pack(anchor="w")
        ttk.Radiobutton(
            mode,
            text="DMS → десятичные градусы (колонки lat_dms / lng_dms или lat / lng с DMS)",
            variable=self.batch_mode,
            value="to_dd",
        ).pack(anchor="w")

        sample = ttk.LabelFrame(parent, text="Образец: как писать градусы, минуты, секунды в xlsx", padding=8)
        sample.pack(fill="x", pady=(8, 0))
        ttk.Label(sample, text='В ячейке lat_dms / lng_dms пишите:   Г°ММ\'СС.ссс" N   и   Г°ММ\'СС.ссс" E').pack(anchor="w")
        ttk.Label(sample, text=f"Пример широты:   {SAMPLE_LAT_DMS}").pack(anchor="w")
        ttk.Label(sample, text=f"Пример долготы:  {SAMPLE_LNG_DMS}").pack(anchor="w")
        ttk.Label(sample, text=f"Можно без значков:  {SAMPLE_LAT_DMS_RU}    {SAMPLE_LNG_DMS_RU}").pack(anchor="w")

        files_box = ttk.LabelFrame(parent, text="Файлы .xlsx", padding=8)
        files_box.pack(fill="both", expand=True, pady=8)
        self.file_list = tk.Listbox(files_box, height=5, selectmode="extended")
        scroll = ttk.Scrollbar(files_box, orient="vertical", command=self.file_list.yview)
        self.file_list.configure(yscrollcommand=scroll.set)
        self.file_list.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")

        file_btns = ttk.Frame(parent)
        file_btns.pack(fill="x")
        ttk.Button(file_btns, text="Добавить файлы…", command=self._add_files).pack(side="left", padx=(0, 8))
        ttk.Button(file_btns, text="Удалить выбранные", command=self._remove_selected).pack(side="left", padx=(0, 8))
        ttk.Button(file_btns, text="Очистить список", command=self._clear_files).pack(side="left")

        out_row = ttk.Frame(parent)
        out_row.pack(fill="x", pady=8)
        ttk.Label(out_row, text="Папка результата").pack(side="left")
        ttk.Entry(out_row, textvariable=self.output_dir).pack(side="left", fill="x", expand=True, padx=8)
        ttk.Button(out_row, text="Обзор…", command=self._choose_output_dir).pack(side="left")

        actions = ttk.Frame(parent)
        actions.pack(fill="x")
        ttk.Button(actions, text="Сохранить шаблон xlsx…", command=self._save_template).pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="Конвертировать файлы", command=self._convert_batch).pack(side="left")

        self.log = tk.Text(parent, height=8, wrap="word", state="disabled")
        self.log.pack(fill="both", expand=True, pady=(8, 0))

    def _sync_single_labels(self) -> None:
        lat = self.lat_entry.get().strip()
        lng = self.lng_entry.get().strip()
        dd_defaults = {format_dd(SAMPLE_LAT_DD), str(SAMPLE_LAT_DD)}
        lng_dd_defaults = {format_dd(SAMPLE_LNG_DD), str(SAMPLE_LNG_DD)}
        dms_defaults = {SAMPLE_LAT_DMS, SAMPLE_LAT_DMS_RU}
        lng_dms_defaults = {SAMPLE_LNG_DMS, SAMPLE_LNG_DMS_RU}
        if self.single_mode.get() == "to_dms":
            self.lat_label.configure(text="Широта (десятичные)")
            self.lng_label.configure(text="Долгота (десятичные)")
            if not lat or lat in dms_defaults:
                self._set_entry(self.lat_entry, format_dd(SAMPLE_LAT_DD))
            if not lng or lng in lng_dms_defaults:
                self._set_entry(self.lng_entry, format_dd(SAMPLE_LNG_DD))
        else:
            self.lat_label.configure(text="Широта (DMS)")
            self.lng_label.configure(text="Долгота (DMS)")
            if not lat or lat in dd_defaults:
                self._set_entry(self.lat_entry, SAMPLE_LAT_DMS)
            if not lng or lng in lng_dd_defaults:
                self._set_entry(self.lng_entry, SAMPLE_LNG_DMS)

    def _set_entry(self, entry: ttk.Entry, value: str) -> None:
        entry.delete(0, "end")
        entry.insert(0, value)

    def _copy(self, text: str) -> None:
        if not text:
            return
        self.clipboard_clear()
        self.clipboard_append(text)
        self.update()

    def _convert_single(self) -> None:
        try:
            to_dms = self.single_mode.get() == "to_dms"
            lat = self.lat_entry.get()
            lng = self.lng_entry.get()
            if to_dms:
                lat_dd = parse_dd(lat, "lat")
                lng_dd = parse_dd(lng, "lng")
                self.lat_out.set(format_dms(lat_dd, "lat"))
                self.lng_out.set(format_dms(lng_dd, "lng"))
            else:
                lat_dd = parse_dms(lat, "lat")
                lng_dd = parse_dms(lng, "lng")
                self.lat_out.set(format_dd(lat_dd))
                self.lng_out.set(format_dd(lng_dd))
        except CoordError as exc:
            messagebox.showerror(APP_TITLE, str(exc))

    def _add_files(self) -> None:
        chosen = filedialog.askopenfilenames(
            title="Выберите xlsx",
            filetypes=[("Excel", "*.xlsx"), ("Все файлы", "*.*")],
        )
        for item in chosen:
            path = Path(item)
            if path not in self.files:
                self.files.append(path)
                self.file_list.insert("end", str(path))

    def _remove_selected(self) -> None:
        selected = list(self.file_list.curselection())
        selected.reverse()
        for index in selected:
            self.file_list.delete(index)
            del self.files[index]

    def _clear_files(self) -> None:
        self.files.clear()
        self.file_list.delete(0, "end")

    def _choose_output_dir(self) -> None:
        chosen = filedialog.askdirectory(title="Папка для *_converted.xlsx")
        if chosen:
            self.output_dir.set(chosen)

    def _save_template(self) -> None:
        path = filedialog.asksaveasfilename(
            title="Сохранить шаблон",
            defaultextension=".xlsx",
            initialfile="infolake_coords_template.xlsx",
            filetypes=[("Excel", "*.xlsx")],
        )
        if not path:
            return
        dest = save_template(Path(path), to_dms=self.batch_mode.get() == "to_dms")
        self._append_log(f"Шаблон сохранён: {dest}")
        messagebox.showinfo(APP_TITLE, f"Шаблон сохранён:\n{dest}")

    def _convert_batch(self) -> None:
        if not self.files:
            messagebox.showwarning(APP_TITLE, "Добавьте хотя бы один файл xlsx")
            return
        output_dir = Path(self.output_dir.get()) if self.output_dir.get().strip() else None
        try:
            results = convert_files(self.files, to_dms=self.batch_mode.get() == "to_dms", output_dir=output_dir)
        except Exception as exc:
            messagebox.showerror(APP_TITLE, str(exc))
            return
        lines = []
        for item in results:
            line = (
                f"{Path(item['source']).name} → {item['output']}  "
                f"(строк: {item['converted']}, ошибок: {item['errors']})"
            )
            lines.append(line)
            for sheet_error in item.get("sheet_errors") or []:
                lines.append(f"  {sheet_error}")
        self._append_log("\n".join(lines))
        messagebox.showinfo(APP_TITLE, "\n".join(lines))

    def _append_log(self, text: str) -> None:
        self.log.configure(state="normal")
        if self.log.get("1.0", "end").strip():
            self.log.insert("end", "\n")
        self.log.insert("end", text)
        self.log.see("end")
        self.log.configure(state="disabled")


def main() -> None:
    if sys.platform == "win32":
        try:
            from ctypes import windll

            windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            pass
    app = ConverterApp()
    app.mainloop()


if __name__ == "__main__":
    main()
