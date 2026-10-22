import type { AsciiCell } from './ascii'
import type { DitherAlgorithm } from './dither'
import type { PaletteId, RGB } from './palettes'

export type PreviewMode = 'dither' | 'ascii' | 'original'

export interface ProcessSettings {
  maxSide: number
  brightness: number
  contrast: number
  algorithm: DitherAlgorithm
  serpentine: boolean
  paletteId: PaletteId
  ink: RGB
  paper: RGB
  /** Steps per RGB channel when palette is `levels` (2–6). */
  colorLevels: number
  asciiColumns: number
  asciiChars: string
  asciiInvert: boolean
  asciiColor: boolean
}

export interface ProcessRequest {
  id: number
  width: number
  height: number
  /** Transferable pixel buffer (RGBA) at working size, after decode/scale on main thread. */
  buffer: ArrayBuffer
  settings: ProcessSettings
}

export interface ProcessResult {
  id: number
  width: number
  height: number
  dithered: ArrayBuffer
  ascii: string
  asciiRows: number
  asciiColumns: number
  asciiCells: AsciiCell[] | null
}
