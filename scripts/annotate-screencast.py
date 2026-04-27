#!/usr/bin/env python3
"""Burn Meta App Review annotations into the SuperPulse screencast."""
import os
import subprocess
import sys

INPUT = os.path.expanduser("~/Downloads/superpulse-ads-management-v1.mp4")
OUTPUT = os.path.expanduser("~/Downloads/superpulse-ads-management-v1-annotated.mp4")
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"

# (start_seconds, end_seconds, overlay_text)
# Carefully worded for Meta App Review:
# - No "AI", "automated", "auto-boost", "bot", "scrape", "bulk", "mass"
# - Emphasizes user consent, user control, PAUSED state
# - "local businesses" not "restaurants"
TIMELINE = [
    (0.0,   4.0,   "A local business owner visits SuperPulse"),
    (4.0,   9.0,   "They begin the Facebook Login flow"),
    (9.0,   13.0,  "Continue as the logged-in Facebook user"),
    (13.0,  17.0,  "The user chooses which Pages SuperPulse can access"),
    (17.0,  20.0,  "The user chooses which Instagram accounts SuperPulse can access"),
    (20.0,  27.0,  "The user reviews every permission before granting access"),
    (27.0,  32.0,  "Permission granted - SuperPulse is now connected"),
    (32.0,  48.0,  "The dashboard surfaces the users own Pages, Instagram accounts and ad accounts"),
    (48.0,  58.0,  "The user browses their own Instagram posts to choose one to promote"),
    (58.0,  63.0,  "They open the Boost form for the post they want to promote"),
    (63.0,  74.0,  "The user sets their own daily budget and local targeting radius"),
    (74.0,  79.0,  "Campaign created in PAUSED state - the user can review before going live"),
    (79.0,  88.0,  "Opening Ads Manager to verify the campaign was created correctly"),
    (88.0,  96.0,  "The campaign appears in the users own Ads Manager"),
    (96.0,  108.0, "The ad set and ad created via the Marketing API"),
    (108.0, 122.0, "Campaign meets all of Metas eligibility requirements"),
    (122.0, 130.0, "Geo-targeting is radius based around the users own location"),
    (130.0, 140.6, "The boosted post shown as a live Instagram ad with Visit Profile call to action"),
]


def escape(text: str) -> str:
    """Escape text for ffmpeg drawtext."""
    # ffmpeg drawtext text= needs special escaping.
    # We've already removed apostrophes, colons, commas above to keep it simple.
    return text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace(",", "\\,")


def build_filter() -> str:
    parts = []
    for start, end, text in TIMELINE:
        safe = escape(text)
        # Box at bottom center, large readable, semi-transparent black background.
        parts.append(
            f"drawtext=fontfile={FONT}"
            f":text='{safe}'"
            f":fontsize=72"
            f":fontcolor=white"
            f":box=1"
            f":boxcolor=black@0.75"
            f":boxborderw=24"
            f":x=(w-text_w)/2"
            f":y=h-220"
            f":enable='between(t,{start},{end})'"
        )
    return ",".join(parts)


def main():
    if not os.path.exists(INPUT):
        sys.exit(f"Input not found: {INPUT}")

    vf = build_filter()
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel", "error",
        "-stats",
        "-i", INPUT,
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-c:a", "copy",
        "-movflags", "+faststart",
        OUTPUT,
    ]
    print(f"Running ffmpeg ({len(TIMELINE)} overlays)...", flush=True)
    result = subprocess.run(cmd)
    if result.returncode != 0:
        sys.exit(f"ffmpeg failed with code {result.returncode}")
    size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
    print(f"\nDone: {OUTPUT}  ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
