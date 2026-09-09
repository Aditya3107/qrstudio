# QR Studio

A browser-only QR code generator for posters, papers and repositories. No backend, no accounts, no tracking — everything is encoded and rendered locally, so it also works offline.

Live: https://qrstudio.adityaparikh.me

## Features

- **Content types**: link, plain text, Wi-Fi credentials, phone / SMS
- **Colour**: foreground, background, optional two-stop gradient, transparent background, and the Radboud University house-style palette as presets
- **Module patterns**: square, rounded, dots, sparkle, bars, fused
- **Corner eyes**: square, rounded, circle
- **Frames**: brackets, outline, banner, scan pill, circle — each with an editable caption baked into the export
- **Logo**: saved logo library, uploads join the row for the session; adding a logo raises error correction to level H automatically
- **Contrast readout** warns when a colour pair is too weak to scan
- **Export**: PNG at 1200 px, SVG for print, copy to clipboard

## Encoder

`qr-encode.js` is a self-contained ISO/IEC 18004 encoder written for this project — byte mode, versions 1–40, Reed–Solomon error correction at levels L/M/Q/H, all eight mask patterns with full penalty scoring. No dependencies.

## Hosting on GitHub Pages

1. Create a repository and push the contents of this folder to the default branch.
2. Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. The included `CNAME` points at `qrstudio.adityaparikh.me`. Add a DNS `CNAME` record for `qrstudio` pointing to `<your-username>.github.io`.
4. `.nojekyll` is included so Jekyll does not touch the files.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app, self-contained |
| `qr-encode.js` | QR encoder module |
| `logo.png` | Default logo in the picker |
| `CNAME` | Custom domain for GitHub Pages |

## Print advice

Print at 3 cm or wider on a poster and test the scan from about a metre away before the final board goes out. Dots and sparkle patterns need 4 cm or more.
