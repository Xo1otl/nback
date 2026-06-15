"""Generate the audio-modality letter clips for the n-back game.

Renders one ``<letter>.mp3`` per letter into ``src/audio/`` using gTTS, so the
auditory stimulus is a fixed, pre-rendered asset (byte-identical on every
platform) rather than a live OS speech-synthesis voice.

Run from ``apps/nback``::

    uv run --with gtts scripts/soundgen.py

Keep ``LETTERS`` in sync with ``CANONICAL_AUDIO`` in ``src/game/_types.ts``.
"""

from pathlib import Path

from gtts import gTTS

# Mirror CANONICAL_AUDIO in src/game/_types.ts — a set of auditorily distinct
# letters (no rhyming confusions like B/C/D/E or M/N).
LETTERS = ["A", "B", "C", "H", "K", "L", "M", "O"]

OUT_DIR = Path(__file__).resolve().parent.parent / "src" / "audio"


def generate(letter: str, out_dir: Path) -> Path:
    """Render a single letter to ``out_dir/<letter>.mp3`` and return its path."""
    path = out_dir / f"{letter}.mp3"
    gTTS(text=letter, lang="en", slow=False).save(str(path))
    return path


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for letter in LETTERS:
        path = generate(letter, OUT_DIR)
        print(f"saved {path.name}")
    print(f"{len(LETTERS)} clips written to {OUT_DIR}")


if __name__ == "__main__":
    main()
