export type RGB = [number, number, number]

export type PaletteId =
  | 'bw'
  | 'gameboy'
  | 'macintosh'
  | 'cga'
  | 'rgb'
  | 'vga'
  | 'levels'
  | 'custom'

export interface Palette {
  id: PaletteId
  label: string
  colors: RGB[]
}

export const PALETTES: Record<Exclude<PaletteId, 'custom' | 'levels'>, Palette> = {
  bw: {
    id: 'bw',
    label: 'Black and white',
    colors: [
      [0, 0, 0],
      [255, 255, 255],
    ],
  },
  gameboy: {
    id: 'gameboy',
    label: 'Game Boy',
    colors: [
      [15, 56, 15],
      [48, 98, 48],
      [139, 172, 15],
      [155, 188, 15],
    ],
  },
  macintosh: {
    id: 'macintosh',
    label: 'Macintosh',
    colors: [
      [0, 0, 0],
      [85, 85, 85],
      [170, 170, 170],
      [255, 255, 255],
    ],
  },
  cga: {
    id: 'cga',
    label: 'CGA',
    colors: [
      [0, 0, 0],
      [0, 170, 170],
      [170, 0, 170],
      [255, 255, 255],
    ],
  },
  rgb: {
    id: 'rgb',
    label: 'RGB 8',
    colors: [
      [0, 0, 0],
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
      [0, 255, 255],
      [255, 0, 255],
      [255, 255, 255],
    ],
  },
  vga: {
    id: 'vga',
    label: 'VGA 16',
    colors: [
      [0, 0, 0],
      [0, 0, 170],
      [0, 170, 0],
      [0, 170, 170],
      [170, 0, 0],
      [170, 0, 170],
      [170, 85, 0],
      [170, 170, 170],
      [85, 85, 85],
      [85, 85, 255],
      [85, 255, 85],
      [85, 255, 255],
      [255, 85, 85],
      [255, 85, 255],
      [255, 255, 85],
      [255, 255, 255],
    ],
  },
}

/** Build an evenly spaced RGB cube with `levels` steps per channel (2→8 colors, 5→125). */
export function levelsPalette(levels: number): Palette {
  const n = Math.max(2, Math.min(6, Math.round(levels)))
  const colors: RGB[] = []
  for (let r = 0; r < n; r++) {
    for (let g = 0; g < n; g++) {
      for (let b = 0; b < n; b++) {
        colors.push([
          Math.round((r / (n - 1)) * 255),
          Math.round((g / (n - 1)) * 255),
          Math.round((b / (n - 1)) * 255),
        ])
      }
    }
  }
  return {
    id: 'levels',
    label: `Color ${n}³`,
    colors,
  }
}

export function customPalette(ink: RGB, paper: RGB): Palette {
  return {
    id: 'custom',
    label: 'Ink and paper',
    colors: [ink, paper],
  }
}

export function resolvePalette(
  id: PaletteId,
  ink: RGB = [16, 17, 20],
  paper: RGB = [244, 246, 248],
  colorLevels = 4,
): Palette {
  if (id === 'custom') return customPalette(ink, paper)
  if (id === 'levels') return levelsPalette(colorLevels)
  return PALETTES[id]
}

export function nearestColor(r: number, g: number, b: number, colors: RGB[]): RGB {
  let best = colors[0]
  let bestDist = Infinity
  for (const c of colors) {
    const dr = r - c[0]
    const dg = g - c[1]
    const db = b - c[2]
    const dist = dr * dr + dg * dg + db * db
    if (dist < bestDist) {
      bestDist = dist
      best = c
    }
  }
  return best
}

export function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace('#', '')
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned
  const n = Number.parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]: RGB): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(v).toString(16).padStart(2, '0'))
      .join('')
  )
}
