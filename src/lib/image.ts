export interface SizedImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** Fit image into a working grid whose longest side equals `maxSide`. */
export function scaleToWorkingSize(
  source: CanvasImageSource,
  maxSide: number,
  sw: number,
  sh: number,
): SizedImage {
  const scale = Math.min(1, maxSide / Math.max(sw, sh))
  const width = Math.max(1, Math.round(sw * scale))
  const height = Math.max(1, Math.round(sh * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(source, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  return { width, height, data: imageData.data }
}

export function imageDataToBlob(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  scale = 1,
): Promise<Blob> {
  const outW = width * scale
  const outH = height * scale
  const tiny = document.createElement('canvas')
  tiny.width = width
  tiny.height = height
  const tctx = tiny.getContext('2d')!
  tctx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0)

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tiny, 0, 0, outW, outH)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG export failed'))
    }, 'image/png')
  })
}

export interface LoadedImage {
  source: HTMLImageElement
  width: number
  height: number
}

/** Load any common image (including SVG) via HTMLImageElement. */
export function loadImage(file: File | Blob | string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    let objectUrl: string | null = null

    img.onload = () => {
      const width = img.naturalWidth || img.width
      const height = img.naturalHeight || img.height
      // Keep blob URL until after the caller draws; revoke on next tick.
      if (objectUrl) {
        const url = objectUrl
        queueMicrotask(() => URL.revokeObjectURL(url))
      }
      if (!width || !height) {
        reject(new Error('Image has no dimensions'))
        return
      }
      resolve({ source: img, width, height })
    }
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load image'))
    }

    if (typeof file === 'string') {
      img.src = file
    } else {
      objectUrl = URL.createObjectURL(file)
      img.src = objectUrl
    }
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadText(text: string, filename: string): void {
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename)
}

export function downloadHtml(html: string, filename: string): void {
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ASCII</title></head><body style="margin:0;background:#101114">${html}</body></html>`
  downloadBlob(new Blob([doc], { type: 'text/html;charset=utf-8' }), filename)
}
