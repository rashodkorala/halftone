import { nearestColor, type RGB } from './palettes'

export type DitherAlgorithm =
  | 'floyd-steinberg'
  | 'atkinson'
  | 'jjn'
  | 'stucki'
  | 'sierra'
  | 'bayer-4'
  | 'bayer-8'
  | 'threshold'

export const ALGORITHM_LABELS: Record<DitherAlgorithm, string> = {
  'floyd-steinberg': 'Floyd–Steinberg',
  atkinson: 'Atkinson',
  jjn: 'Jarvis–Judice–Ninke',
  stucki: 'Stucki',
  sierra: 'Sierra',
  'bayer-4': 'Bayer 4×4',
  'bayer-8': 'Bayer 8×8',
  threshold: 'Threshold',
}

type KernelEntry = { dx: number; dy: number; weight: number }

const KERNELS: Partial<Record<DitherAlgorithm, { divisor: number; entries: KernelEntry[] }>> = {
  'floyd-steinberg': {
    divisor: 16,
    entries: [
      { dx: 1, dy: 0, weight: 7 },
      { dx: -1, dy: 1, weight: 3 },
      { dx: 0, dy: 1, weight: 5 },
      { dx: 1, dy: 1, weight: 1 },
    ],
  },
  atkinson: {
    divisor: 8,
    entries: [
      { dx: 1, dy: 0, weight: 1 },
      { dx: 2, dy: 0, weight: 1 },
      { dx: -1, dy: 1, weight: 1 },
      { dx: 0, dy: 1, weight: 1 },
      { dx: 1, dy: 1, weight: 1 },
      { dx: 0, dy: 2, weight: 1 },
    ],
  },
  jjn: {
    divisor: 48,
    entries: [
      { dx: 1, dy: 0, weight: 7 },
      { dx: 2, dy: 0, weight: 5 },
      { dx: -2, dy: 1, weight: 3 },
      { dx: -1, dy: 1, weight: 5 },
      { dx: 0, dy: 1, weight: 7 },
      { dx: 1, dy: 1, weight: 5 },
      { dx: 2, dy: 1, weight: 3 },
      { dx: -2, dy: 2, weight: 1 },
      { dx: -1, dy: 2, weight: 3 },
      { dx: 0, dy: 2, weight: 5 },
      { dx: 1, dy: 2, weight: 3 },
      { dx: 2, dy: 2, weight: 1 },
    ],
  },
  stucki: {
    divisor: 42,
    entries: [
      { dx: 1, dy: 0, weight: 8 },
      { dx: 2, dy: 0, weight: 4 },
      { dx: -2, dy: 1, weight: 2 },
      { dx: -1, dy: 1, weight: 4 },
      { dx: 0, dy: 1, weight: 8 },
      { dx: 1, dy: 1, weight: 4 },
      { dx: 2, dy: 1, weight: 2 },
      { dx: -2, dy: 2, weight: 1 },
      { dx: -1, dy: 2, weight: 2 },
      { dx: 0, dy: 2, weight: 4 },
      { dx: 1, dy: 2, weight: 2 },
      { dx: 2, dy: 2, weight: 1 },
    ],
  },
  sierra: {
    divisor: 32,
    entries: [
      { dx: 1, dy: 0, weight: 5 },
      { dx: 2, dy: 0, weight: 3 },
      { dx: -2, dy: 1, weight: 2 },
      { dx: -1, dy: 1, weight: 4 },
      { dx: 0, dy: 1, weight: 5 },
      { dx: 1, dy: 1, weight: 4 },
      { dx: 2, dy: 1, weight: 2 },
      { dx: -1, dy: 2, weight: 2 },
      { dx: 0, dy: 2, weight: 3 },
      { dx: 1, dy: 2, weight: 2 },
    ],
  },
}

const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

const BAYER_8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function applyTone(
  data: Uint8ClampedArray,
  brightness: number,
  contrast: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data)
  const b = brightness
  const c = contrast
  const factor = (259 * (c + 255)) / (255 * (259 - c))
  for (let i = 0; i < out.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      let v = out[i + ch] + b
      v = factor * (v - 128) + 128
      out[i + ch] = clamp(v)
    }
  }
  return out
}

function diffuseError(
  buf: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  err: [number, number, number],
  kernel: { divisor: number; entries: KernelEntry[] },
  direction: 1 | -1,
): void {
  for (const { dx, dy, weight } of kernel.entries) {
    const nx = x + dx * direction
    const ny = y + dy
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
    const idx = (ny * width + nx) * 4
    const scale = weight / kernel.divisor
    buf[idx] += err[0] * scale
    buf[idx + 1] += err[1] * scale
    buf[idx + 2] += err[2] * scale
  }
}

function errorDiffusion(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  colors: RGB[],
  algorithm: DitherAlgorithm,
  serpentine: boolean,
): Uint8ClampedArray {
  const kernel = KERNELS[algorithm]
  if (!kernel) return thresholdDither(data, width, height, colors)

  const buf = new Float32Array(data.length)
  for (let i = 0; i < data.length; i++) buf[i] = data[i]

  const out = new Uint8ClampedArray(data.length)

  for (let y = 0; y < height; y++) {
    const leftToRight = !serpentine || y % 2 === 0
    const start = leftToRight ? 0 : width - 1
    const end = leftToRight ? width : -1
    const step = leftToRight ? 1 : -1
    const direction: 1 | -1 = leftToRight ? 1 : -1

    for (let x = start; x !== end; x += step) {
      const i = (y * width + x) * 4
      const r = clamp(buf[i])
      const g = clamp(buf[i + 1])
      const b = clamp(buf[i + 2])
      const [nr, ng, nb] = nearestColor(r, g, b, colors)
      out[i] = nr
      out[i + 1] = ng
      out[i + 2] = nb
      out[i + 3] = data[i + 3]
      const err: [number, number, number] = [r - nr, g - ng, b - nb]
      diffuseError(buf, width, height, x, y, err, kernel, direction)
    }
  }

  return out
}

function orderedDither(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  colors: RGB[],
  matrix: number[][],
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length)
  const n = matrix.length
  const levels = n * n

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const threshold = (matrix[y % n][x % n] + 0.5) / levels
      // Bias each channel toward light/dark relative to Bayer threshold
      const bias = (threshold - 0.5) * 255
      const r = clamp(data[i] + bias)
      const g = clamp(data[i + 1] + bias)
      const b = clamp(data[i + 2] + bias)
      const [nr, ng, nb] = nearestColor(r, g, b, colors)
      out[i] = nr
      out[i + 1] = ng
      out[i + 2] = nb
      out[i + 3] = data[i + 3]
    }
  }

  return out
}

function thresholdDither(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  colors: RGB[],
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const [nr, ng, nb] = nearestColor(data[i], data[i + 1], data[i + 2], colors)
      out[i] = nr
      out[i + 1] = ng
      out[i + 2] = nb
      out[i + 3] = data[i + 3]
    }
  }
  return out
}

export function ditherImage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  colors: RGB[],
  algorithm: DitherAlgorithm,
  serpentine = true,
): Uint8ClampedArray {
  switch (algorithm) {
    case 'bayer-4':
      return orderedDither(data, width, height, colors, BAYER_4)
    case 'bayer-8':
      return orderedDither(data, width, height, colors, BAYER_8)
    case 'threshold':
      return thresholdDither(data, width, height, colors)
    default:
      return errorDiffusion(data, width, height, colors, algorithm, serpentine)
  }
}

export { luminance }
