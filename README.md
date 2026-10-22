# Halftone

Local dither and ASCII image studio. Drop a still image, dither it, and read the same frame as ASCII. Everything runs in your browser — no upload, no account.

## Run

```bash
pnpm install
pnpm dev
```

## Features

- Error diffusion: Floyd–Steinberg, Atkinson, Jarvis–Judice–Ninke, Stucki, Sierra
- Ordered: Bayer 4×4, Bayer 8×8, threshold
- Palettes: black and white, Game Boy, Macintosh, CGA, custom ink and paper
- ASCII with editable character sets
- Export dithered PNG and ASCII text
