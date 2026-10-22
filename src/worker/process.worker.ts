import { imageToAscii } from '../lib/ascii'
import { applyTone, ditherImage } from '../lib/dither'
import { resolvePalette } from '../lib/palettes'
import type { ProcessRequest, ProcessResult } from '../lib/types'

self.onmessage = (event: MessageEvent<ProcessRequest>) => {
  const { id, width, height, buffer, settings } = event.data
  const source = new Uint8ClampedArray(buffer)
  const toned = applyTone(source, settings.brightness, settings.contrast)
  const palette = resolvePalette(
    settings.paletteId,
    settings.ink,
    settings.paper,
    settings.colorLevels,
  )
  const dithered = ditherImage(
    toned,
    width,
    height,
    palette.colors,
    settings.algorithm,
    settings.serpentine,
  )
  const ascii = imageToAscii(toned, width, height, {
    columns: settings.asciiColumns,
    chars: settings.asciiChars,
    invert: settings.asciiInvert,
    color: settings.asciiColor,
  })

  const outBuffer = dithered.buffer.slice(
    dithered.byteOffset,
    dithered.byteOffset + dithered.byteLength,
  ) as ArrayBuffer

  const result: ProcessResult = {
    id,
    width,
    height,
    dithered: outBuffer,
    ascii: ascii.text,
    asciiRows: ascii.rows,
    asciiColumns: ascii.columns,
    asciiCells: ascii.cells,
  }

  postMessage(result, [outBuffer])
}
