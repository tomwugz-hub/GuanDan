import argparse
import json
import platform
import subprocess
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(
        description="Transcribe one cached Douyin video with faster-whisper.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--probe", action="store_true", help="report runtime availability")
    parser.add_argument("--input", help="path to the cached MP4")
    parser.add_argument("--output", help="path for the transcript JSON")
    parser.add_argument("--model", default="small", help="Whisper model name")
    parser.add_argument("--device", default="cpu", help="inference device")
    parser.add_argument("--compute-type", default="int8", help="inference compute type")
    return parser.parse_args()


def main():
    a = parse_args()
    if a.probe:
        print(json.dumps({"schemaVersion": 1, "python": platform.python_version()}))
        return

    if not a.input or not a.output:
        raise SystemExit("--input and --output are required")

    source = Path(a.input)
    target = Path(a.output)
    if not source.is_file():
        raise SystemExit(f"input video does not exist: {source}")

    import imageio_ffmpeg
    from faster_whisper import WhisperModel

    target.parent.mkdir(parents=True, exist_ok=True)
    audio = source.parent / "audio.wav"
    subprocess.run(
        [
            imageio_ffmpeg.get_ffmpeg_exe(),
            "-y",
            "-i",
            str(source),
            "-ac",
            "1",
            "-ar",
            "16000",
            str(audio),
        ],
        check=True,
    )

    model = WhisperModel(a.model, device=a.device, compute_type=a.compute_type)
    stream, info = model.transcribe(str(audio), language="zh", vad_filter=True)
    segments = []
    for segment in stream:
        text = segment.text.strip()
        if not text:
            continue
        segments.append(
            {
                "start": round(float(segment.start), 3),
                "end": round(float(segment.end), 3),
                "text": text,
                "avgLogProb": float(segment.avg_logprob),
            }
        )
    segments.sort(key=lambda segment: (segment["start"], segment["end"]))

    payload = {
        "schemaVersion": 1,
        "model": {
            "name": a.model,
            "device": a.device,
            "computeType": a.compute_type,
        },
        "language": info.language,
        "durationSeconds": round(float(info.duration), 3),
        "segments": segments,
    }
    target.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
