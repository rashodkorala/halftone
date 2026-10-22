import { luminance } from './dither'

export type CharsetId = 'standard' | 'blocks' | 'dense' | 'custom'

export const CHARSET_PRESETS: Record<Exclude<CharsetId, 'custom'>, { label: string; chars: string }> =
  {
    standard: {
      label: 'Standard',
      chars: ' .:-=+*#%@',
    },
    blocks: {
      label: 'Blocks',
      chars: ' ░▒▓█',
    },
    dense: {
      label: 'Dense',
      chars: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
    },
  }

export interface AsciiOptions {
  columns: number
  chars: string
  invert: boolean
  color: boolean
}

export interface AsciiCell {
  char: string
  r: number
  g: number
  b: number
}

export interface AsciiResult {
  text: string
  rows: number
  columns: number
  /** Present when color mode is on; row-major, length = rows * columns. */
  cells: AsciiCell[] | null
}

/**
 * Map adjusted image data to ASCII.
 * Cell aspect assumes monospace cells ~0.55 width/height so rows match the image.
 * When color is on, each cell keeps its average RGB for tinted preview/export.
 */
export function imageToAscii(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: AsciiOptions,
): AsciiResult {
  const chars = options.chars.length > 0 ? options.chars : ' .'
  const columns = Math.max(1, Math.min(options.columns, width))
  const cellW = width / columns
  const cellH = cellW / 0.55
  const rows = Math.max(1, Math.floor(height / cellH))

  const lines: string[] = []
  const cells: AsciiCell[] | null = options.color ? [] : null
  const rampLen = chars.length - 1

  for (let row = 0; row < rows; row++) {
    let line = ''
    const y0 = Math.floor(row * cellH)
    const y1 = Math.min(height, Math.floor((row + 1) * cellH))

    for (let col = 0; col < columns; col++) {
      const x0 = Math.floor(col * cellW)
      const x1 = Math.min(width, Math.floor((col + 1) * cellW))

      let sumL = 0
      let sumR = 0
      let sumG = 0
      let sumB = 0
      let count = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          sumL += luminance(r, g, b)
          sumR += r
          sumG += g
          sumB += b
          count++
        }
      }

      let t = count > 0 ? sumL / count / 255 : 0
      if (options.invert) t = 1 - t
      const idx = Math.round((1 - t) * rampLen)
      const char = chars[Math.max(0, Math.min(rampLen, idx))]
      line += char

      if (cells) {
        const n = Math.max(1, count)
        cells.push({
          char,
          r: Math.round(sumR / n),
          g: Math.round(sumG / n),
          b: Math.round(sumB / n),
        })
      }
    }
    lines.push(line)
  }

  return {
    text: lines.join('\n'),
    rows,
    columns,
    cells,
  }
}

export function asciiToHtml(result: AsciiResult, background = '#101114'): string {
  if (!result.cells) {
    return `<pre style="margin:0;font-family:ui-monospace,monospace;background:${background};color:#f4f6f8;line-height:1.05">${escapeHtml(result.text)}</pre>`
  }

  const parts: string[] = [
    `<pre style="margin:0;font-family:ui-monospace,monospace;background:${background};line-height:1.05">`,
  ]
  for (let row = 0; row < result.rows; row++) {
    for (let col = 0; col < result.columns; col++) {
      const cell = result.cells[row * result.columns + col]
      const color = `rgb(${cell.r},${cell.g},${cell.b})`
      parts.push(`<span style="color:${color}">${escapeHtml(cell.char)}</span>`)
    }
    if (row < result.rows - 1) parts.push('\n')
  }
  parts.push('</pre>')
  return parts.join('')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
