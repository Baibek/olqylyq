"""Builds index.html: inlines the diagnostic engine (src/engine.js) into the page (src/page.html)."""
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"

def core() -> str:
    return (SRC / "engine.js").read_text(encoding="utf-8")

def page() -> str:
    return (SRC / "page.html").read_text(encoding="utf-8").replace("/*__CORE__*/", core())

if __name__ == "__main__":
    html = ('<!doctype html>\n<html lang="kk">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="description" content="Олқылық: оқушының білім олқылығының түбірін табатын адаптивті диагностика.">\n'
            + page() + "\n</html>\n")
    (ROOT / "index.html").write_text(html, encoding="utf-8")
    print("index.html:", len(html), "bytes")
