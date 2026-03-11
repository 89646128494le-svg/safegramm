from pathlib import Path
import re


ROOT = Path(r"C:/Users/Lev/Desktop/Projects/SafeGram restart")
SOURCE = ROOT / "tmp/pdfs/legal_extract.txt"
TARGET_DIR = ROOT / "web/src/content/legal"


def normalize(raw: str) -> str:
    text = raw.replace("\r", "")
    text = text.replace("\n \n", " ")
    text = text.replace("\n\n", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = text.replace(" ● ", "\n● ")
    text = re.sub(r" (\d+\.\d+\. )", r"\n\1", text)
    text = re.sub(r" (\d+\. [А-ЯA-ZЁ])", r"\n\1", text)
    text = text.replace("ЧАСТЬ I.", "\n\nЧАСТЬ I.")
    text = text.replace("ЧАСТЬ II.", "\n\nЧАСТЬ II.")
    text = text.replace("ЧАСТЬ III.", "\n\nЧАСТЬ III.")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_parts(text: str) -> tuple[str, str]:
    privacy = re.search(r"ЧАСТЬ I\..*?(?=ЧАСТЬ II\.)", text, re.S)
    terms = re.search(r"ЧАСТЬ II\..*?(?=ЧАСТЬ III\.)", text, re.S)
    if not privacy or not terms:
        raise RuntimeError("Failed to split legal document into privacy and terms")
    return privacy.group(0).strip(), terms.group(0).strip()


def main() -> None:
    raw = SOURCE.read_text(encoding="utf-8")
    normalized = normalize(raw)
    privacy, terms = extract_parts(normalized)
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    (TARGET_DIR / "privacy.txt").write_text(privacy + "\n", encoding="utf-8")
    (TARGET_DIR / "terms.txt").write_text(terms + "\n", encoding="utf-8")
    print("ok")


if __name__ == "__main__":
    main()
