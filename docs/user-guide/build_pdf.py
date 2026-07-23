"""Сборка PDF руководства пользователя (WeasyPrint).

Запуск из контейнера backend:
  python /app/../docs/...  — удобнее с хоста:

  docker compose exec -T backend python -c "..."
или:
  docker compose run --rm -v ${PWD}/docs:/docs --entrypoint python backend /docs/user-guide/build_pdf.py
"""

from __future__ import annotations

from pathlib import Path

from weasyprint import CSS, HTML

HERE = Path(__file__).resolve().parent
HTML_PATH = HERE / "user_guide.html"
CSS_PATH = HERE / "user_guide.css"
OUT_PATH = HERE / "InfoLake_User_Guide.pdf"
OUT_PATH_RU = HERE / "InfoLake_Руководство_пользователя.pdf"


def main() -> None:
    if not HTML_PATH.exists():
        raise SystemExit(f"Не найден {HTML_PATH}")
    html = HTML(filename=str(HTML_PATH), base_url=str(HERE))
    styles = [CSS(filename=str(CSS_PATH))] if CSS_PATH.exists() else []
    OUT_PATH.write_bytes(html.write_pdf(stylesheets=styles))
    print(f"OK: {OUT_PATH} ({OUT_PATH.stat().st_size} bytes)")
    try:
        OUT_PATH_RU.write_bytes(OUT_PATH.read_bytes())
        print(f"OK: {OUT_PATH_RU}")
    except OSError as exc:
        print(f"Skip RU copy (file locked?): {exc}")


if __name__ == "__main__":
    main()
