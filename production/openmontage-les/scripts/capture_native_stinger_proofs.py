from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path


WIDTH = 1920
HEIGHT = 1080
TILE_WIDTH = 480
TILE_HEIGHT = 270


def run_ffmpeg(ffmpeg: str, source: Path, output: Path, filter_graph: str) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-filter_complex",
            filter_graph,
            "-map",
            "[out]",
            "-frames:v",
            "1",
            "-fps_mode",
            "passthrough",
            str(output),
        ],
        check=True,
    )


def select_expression(indexes: list[int]) -> str:
    return "+".join(f"eq(n\\,{index})" for index in indexes)


def background_filter(kind: str, width: int, height: int, duration: float) -> str:
    if kind == "checker":
        square = 40 if width == WIDTH else 20
        return (
            f"nullsrc=s={width}x{height}:r=60:d={duration},format=yuv444p,"
            f"geq=lum='if(mod(floor(X/{square})+floor(Y/{square})\\,2)\\,180\\,230)':cb=128:cr=128"
        )
    color = "#F5F2ED" if kind == "light" else "#010A14"
    return f"color=c={color}:s={width}x{height}:r=60:d={duration}"


def contact_sheet(ffmpeg: str, source: Path, output: Path, indexes: list[int], background: str | None) -> None:
    select = select_expression(indexes)
    foreground = (
        f"[0:v]select='{select}',scale={TILE_WIDTH}:{TILE_HEIGHT}:flags=lanczos,"
        "setpts=N/(60*TB)[fg]"
    )
    if background is None:
        graph = f"{foreground};[fg]tile=4x3,format=rgba[out]"
    else:
        duration = len(indexes) / 60 + 0.05
        bg = background_filter(background, TILE_WIDTH, TILE_HEIGHT, duration)
        graph = f"{foreground};{bg}[bg];[bg][fg]overlay=shortest=1,tile=4x3[out]"
    run_ffmpeg(ffmpeg, source, output, graph)


def full_frame(ffmpeg: str, source: Path, output: Path, frame_index: int, background: str) -> None:
    bg = background_filter(background, WIDTH, HEIGHT, 0.05)
    graph = (
        f"[0:v]select='eq(n\\,{frame_index})',setpts=0[fg];"
        f"{bg}[bg];[bg][fg]overlay=shortest=1[out]"
    )
    run_ffmpeg(ffmpeg, source, output, graph)


def main() -> int:
    parser = argparse.ArgumentParser(description="Captures natives des stingers, sans correction alpha.")
    parser.add_argument("--short", type=Path, required=True)
    parser.add_argument("--long", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg doit être présent dans PATH.")

    variants = {
        "short": (args.short, [0, 10, 19, 32, 63, 64, 78, 99, 100, 110, 118, 119]),
        "long": (args.long, [0, 10, 19, 32, 64, 78, 129, 180, 258, 281, 282, 299]),
    }
    for key, (source, indexes) in variants.items():
        if not source.is_file():
            raise SystemExit(f"Fichier absent : {source}")
        for background in (None, "checker", "light", "dark"):
            suffix = "transparent" if background is None else background
            contact_sheet(
                ffmpeg,
                source,
                args.output_dir / f"{key}-native-{suffix}.png",
                indexes,
                background,
            )

    full_frame(ffmpeg, args.long, args.output_dir / "long-frame-0299-native-checker.png", 299, "checker")
    print(f"Captures natives écrites dans {args.output_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
