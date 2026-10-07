from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np


WIDTH = 1920
HEIGHT = 1080
FPS_NUM = 60
FPS_DEN = 1
MAX_ALPHA_12 = 4095

VARIANTS = {
    "short": {
        "expected_name": "Stinger-V2-court-compressed.mov",
        "expected_sha256": "148513D14E94751BEC2077281CA584A9B3824A17A812D6A3658F90264998CC54",
        "expected_frames": 120,
        "cut_frame": 78,
        "proposed_cover_start": 64,
        "proposed_cover_end": 99,
    },
    "long": {
        "expected_name": "Stinger-V2-Long-compressed.mov",
        "expected_sha256": "F5EA1ACF0140C4FF9DDAB069997A4390C4E2781785F2A8583D49E367F3185732",
        "expected_frames": 300,
        "cut_frame": 78,
        "proposed_cover_start": 64,
        "proposed_cover_end": 281,
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest().upper()


def probe(ffprobe: str, source: Path) -> dict[str, Any]:
    completed = subprocess.run(
        [ffprobe, "-v", "error", "-show_streams", "-show_format", "-of", "json", str(source)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout)


def read_exact(stream: Any, size: int) -> bytes:
    chunks: list[bytes] = []
    remaining = size
    while remaining:
        chunk = stream.read(remaining)
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def scan_alpha(ffmpeg: str, source: Path, expected_frames: int) -> list[dict[str, Any]]:
    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-map",
        "0:v:0",
        "-vf",
        "alphaextract,format=gray12le",
        "-fps_mode",
        "passthrough",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "gray12le",
        "pipe:1",
    ]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.stdout is None or process.stderr is None:
        raise RuntimeError("Impossible d’ouvrir les flux FFmpeg.")

    frame_bytes = WIDTH * HEIGHT * 2
    frames: list[dict[str, Any]] = []
    for frame_index in range(expected_frames):
        raw = read_exact(process.stdout, frame_bytes)
        if len(raw) != frame_bytes:
            process.kill()
            stderr = process.stderr.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"Décodage alpha incomplet à l’image {frame_index}: "
                f"{len(raw)}/{frame_bytes} octets. {stderr}"
            )
        values = np.frombuffer(raw, dtype="<u2").reshape((HEIGHT, WIDTH))
        zero_pixels = int(np.count_nonzero(values == 0))
        full_pixels = int(np.count_nonzero(values == MAX_ALPHA_12))
        nonzero_pixels = int(values.size - zero_pixels)
        partial_pixels = int(values.size - zero_pixels - full_pixels)
        frames.append(
            {
                "frame_index_zero_based": frame_index,
                "time": {"numerator": frame_index, "denominator": FPS_NUM},
                "time_ms": frame_index * 1000 / FPS_NUM,
                "alpha_min_12bit": int(values.min()),
                "alpha_max_12bit": int(values.max()),
                "zero_pixels": zero_pixels,
                "nonzero_pixels": nonzero_pixels,
                "partial_pixels": partial_pixels,
                "full_pixels": full_pixels,
                "under_max_pixels": int(values.size - full_pixels),
                "left_column_under_max_pixels": int(np.count_nonzero(values[:, 0] < MAX_ALPHA_12)),
            }
        )

    trailing = process.stdout.read(1)
    stderr = process.stderr.read().decode("utf-8", errors="replace")
    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(f"FFmpeg a quitté avec le code {return_code}: {stderr}")
    if trailing:
        raise RuntimeError("FFmpeg a produit plus d’images que prévu.")
    return frames


def first_index(frames: list[dict[str, Any]], predicate: Any) -> int | None:
    for frame in frames:
        if predicate(frame):
            return int(frame["frame_index_zero_based"])
    return None


def last_index(frames: list[dict[str, Any]], predicate: Any) -> int | None:
    for frame in reversed(frames):
        if predicate(frame):
            return int(frame["frame_index_zero_based"])
    return None


def summarize_window(frames: list[dict[str, Any]], start: int, end: int) -> dict[str, Any]:
    selected = frames[start : end + 1]
    partially_opaque = [
        int(frame["frame_index_zero_based"])
        for frame in selected
        if int(frame["partial_pixels"]) > 0
    ]
    return {
        "first_frame_index_zero_based": start,
        "last_frame_index_zero_based": end,
        "frame_count": len(selected),
        "every_frame_every_pixel_covered": all(int(frame["zero_pixels"]) == 0 for frame in selected),
        "every_frame_every_pixel_alpha_4095": all(int(frame["alpha_min_12bit"]) == MAX_ALPHA_12 for frame in selected),
        "frames_with_partial_alpha_count": len(partially_opaque),
        "frames_with_partial_alpha": partially_opaque,
        "minimum_alpha_seen": min(int(frame["alpha_min_12bit"]) for frame in selected),
        "maximum_under_max_pixels_on_one_frame": max(int(frame["under_max_pixels"]) for frame in selected),
        "left_column_pattern_on_every_frame": all(
            int(frame["left_column_under_max_pixels"]) == 1027 for frame in selected
        ),
    }


def inspect_variant(key: str, source: Path, ffmpeg: str, ffprobe: str) -> dict[str, Any]:
    expected = VARIANTS[key]
    metadata = probe(ffprobe, source)
    streams = metadata.get("streams", [])
    video = next(stream for stream in streams if stream.get("codec_type") == "video")
    alpha_frames = scan_alpha(ffmpeg, source, int(expected["expected_frames"]))
    cut_frame = int(expected["cut_frame"])
    start = int(expected["proposed_cover_start"])
    end = int(expected["proposed_cover_end"])
    source_hash = sha256(source)
    stat = source.stat()
    read_only = bool(getattr(stat, "st_file_attributes", 0) & 1)

    return {
        "key": key,
        "source": {
            "path": str(source.resolve()),
            "name": source.name,
            "bytes": stat.st_size,
            "last_write_time_utc": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "read_only_attribute": read_only,
            "sha256": source_hash,
            "expected_sha256": expected["expected_sha256"],
            "sha256_matches": source_hash == expected["expected_sha256"],
        },
        "technical": {
            "container": metadata.get("format", {}).get("format_name"),
            "duration_seconds": metadata.get("format", {}).get("duration"),
            "codec": video.get("codec_name"),
            "profile": video.get("profile"),
            "pixel_format": video.get("pix_fmt"),
            "bits_per_raw_sample": video.get("bits_per_raw_sample"),
            "width": video.get("width"),
            "height": video.get("height"),
            "sample_aspect_ratio": video.get("sample_aspect_ratio"),
            "field_order": video.get("field_order"),
            "fps": video.get("r_frame_rate"),
            "average_fps": video.get("avg_frame_rate"),
            "frame_count": int(video.get("nb_frames", 0)),
            "color_range": video.get("color_range"),
            "color_space": video.get("color_space"),
            "color_transfer": video.get("color_transfer"),
            "color_primaries": video.get("color_primaries"),
            "timecode": video.get("tags", {}).get("timecode"),
            "audio_stream_count": sum(1 for stream in streams if stream.get("codec_type") == "audio"),
            "data_stream_count": sum(1 for stream in streams if stream.get("codec_type") == "data"),
        },
        "alpha_summary": {
            "scan_method": "Every decoded frame; every native 1920x1080 alpha sample; FFmpeg alphaextract to gray12le; NumPy exact counts.",
            "scanned_frame_count": len(alpha_frames),
            "scanned_pixels": len(alpha_frames) * WIDTH * HEIGHT,
            "first_nonzero_frame": first_index(alpha_frames, lambda frame: frame["nonzero_pixels"] > 0),
            "last_nonzero_frame": last_index(alpha_frames, lambda frame: frame["nonzero_pixels"] > 0),
            "first_full_coverage_frame": first_index(alpha_frames, lambda frame: frame["zero_pixels"] == 0),
            "last_full_coverage_frame": last_index(alpha_frames, lambda frame: frame["zero_pixels"] == 0),
            "first_fully_opaque_frame": first_index(alpha_frames, lambda frame: frame["alpha_min_12bit"] == MAX_ALPHA_12),
            "last_fully_opaque_frame": last_index(alpha_frames, lambda frame: frame["alpha_min_12bit"] == MAX_ALPHA_12),
            "proposed_cut_window": summarize_window(alpha_frames, start, end),
            "cut_frame": alpha_frames[cut_frame],
            "first_frame": alpha_frames[0],
            "last_frame": alpha_frames[-1],
        },
        "alpha_frames": alpha_frames,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Qualification alpha non destructive des deux stingers LES.")
    parser.add_argument("--short", type=Path, required=True)
    parser.add_argument("--long", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise SystemExit("ffmpeg et ffprobe doivent être présents dans PATH.")
    for source in (args.short, args.long):
        if not source.is_file():
            raise SystemExit(f"Fichier absent : {source}")

    report = {
        "schema_version": "1.0.0",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "destructive_operations": False,
        "sources_modified": False,
        "fps": {"numerator": FPS_NUM, "denominator": FPS_DEN},
        "variants": {
            "short": inspect_variant("short", args.short, ffmpeg, ffprobe),
            "long": inspect_variant("long", args.long, ffmpeg, ffprobe),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(args.output.resolve()),
        "short_sha256_matches": report["variants"]["short"]["source"]["sha256_matches"],
        "long_sha256_matches": report["variants"]["long"]["source"]["sha256_matches"],
        "short_scanned_frames": report["variants"]["short"]["alpha_summary"]["scanned_frame_count"],
        "long_scanned_frames": report["variants"]["long"]["alpha_summary"]["scanned_frame_count"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
