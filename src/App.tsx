import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { asciiToHtml, CHARSET_PRESETS, type CharsetId } from './lib/ascii'
import { ALGORITHM_LABELS, type DitherAlgorithm } from './lib/dither'
import {
  downloadBlob,
  downloadHtml,
  downloadText,
  imageDataToBlob,
  loadImage,
  scaleToWorkingSize,
} from './lib/image'
import { hexToRgb, PALETTES, rgbToHex, type PaletteId } from './lib/palettes'
import type { PreviewMode, ProcessSettings } from './lib/types'
import { useProcessor } from './hooks/useProcessor'
import './styles.css'

const ALGORITHMS = Object.keys(ALGORITHM_LABELS) as DitherAlgorithm[]

const FIXED_PALETTE_IDS = Object.keys(PALETTES) as Exclude<PaletteId, 'custom' | 'levels'>[]

const DEFAULT_SETTINGS: ProcessSettings = {
  maxSide: 160,
  brightness: 0,
  contrast: 0,
  algorithm: 'floyd-steinberg',
  serpentine: true,
  paletteId: 'levels',
  ink: [16, 17, 20],
  paper: [244, 246, 248],
  colorLevels: 4,
  asciiColumns: 100,
  asciiChars: CHARSET_PRESETS.standard.chars,
  asciiInvert: false,
  asciiColor: true,
}

export default function App() {
  const [settings, setSettings] = useState<ProcessSettings>(DEFAULT_SETTINGS)
  const [charsetId, setCharsetId] = useState<CharsetId>('standard')
  const [mode, setMode] = useState<PreviewMode>('dither')
  const [working, setWorking] = useState<ImageData | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('sample')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { output, busy, process } = useProcessor()

  const patch = useCallback(<K extends keyof ProcessSettings>(key: K, value: ProcessSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }, [])

  const loadSource = useCallback(async (source: File | Blob | string, name: string) => {
    const loaded = await loadImage(source)
    const full = scaleToWorkingSize(loaded.source, 1024, loaded.width, loaded.height)
    setWorking(new ImageData(new Uint8ClampedArray(full.data), full.width, full.height))

    const preview = scaleToWorkingSize(loaded.source, 640, loaded.width, loaded.height)
    const previewCanvas = document.createElement('canvas')
    previewCanvas.width = preview.width
    previewCanvas.height = preview.height
    previewCanvas.getContext('2d')!.putImageData(
      new ImageData(new Uint8ClampedArray(preview.data), preview.width, preview.height),
      0,
      0,
    )
    const url = previewCanvas.toDataURL('image/png')
    setOriginalUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return url
    })
    setFileName(name.replace(/\.[^.]+$/, '') || 'image')
  }, [])

  useEffect(() => {
    void loadSource('/sample.svg', 'sample')
  }, [loadSource])

  const processInput = useMemo(() => {
    if (!working) return null
    const { maxSide } = settings
    const scale = Math.min(1, maxSide / Math.max(working.width, working.height))
    const w = Math.max(1, Math.round(working.width * scale))
    const h = Math.max(1, Math.round(working.height * scale))
    if (w === working.width && h === working.height) return working

    const canvas = document.createElement('canvas')
    canvas.width = working.width
    canvas.height = working.height
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(working, 0, 0)
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    const octx = out.getContext('2d')!
    octx.imageSmoothingEnabled = true
    octx.drawImage(canvas, 0, 0, w, h)
    return octx.getImageData(0, 0, w, h)
  }, [working, settings.maxSide])

  useEffect(() => {
    if (!processInput) return
    process(processInput, settings)
  }, [processInput, settings, process])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (mode === 'original' && originalUrl) {
      const img = new Image()
      img.onload = () => {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = true
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        canvas.style.width = ''
        canvas.style.height = ''
        canvas.style.maxWidth = 'min(100%, 72vw)'
      }
      img.src = originalUrl
      return
    }
    if (mode === 'dither' && output) {
      canvas.width = output.width
      canvas.height = output.height
      const ctx = canvas.getContext('2d')!
      ctx.putImageData(output.dithered, 0, 0)
      const displayScale = Math.max(2, Math.min(6, Math.floor(560 / output.width)))
      canvas.style.width = `${output.width * displayScale}px`
      canvas.style.height = `${output.height * displayScale}px`
    }
  }, [mode, output, originalUrl])

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file || !file.type.startsWith('image/')) return
      void loadSource(file, file.name)
    },
    [loadSource],
  )

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            void loadSource(file, 'paste')
          }
          break
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [loadSource])

  const savePng = async () => {
    if (!output) return
    const blob = await imageDataToBlob(output.dithered.data, output.width, output.height, 4)
    downloadBlob(blob, `${fileName}-dither.png`)
  }

  const copyAscii = async () => {
    if (!output?.ascii) return
    if (output.asciiCells) {
      const html = asciiToHtml({
        text: output.ascii,
        rows: output.asciiRows,
        columns: output.asciiColumns,
        cells: output.asciiCells,
      })
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([output.ascii], { type: 'text/plain' }),
          }),
        ])
        return
      } catch {
        // Fall through to plain text
      }
    }
    await navigator.clipboard.writeText(output.ascii)
  }

  const saveAscii = () => {
    if (!output?.ascii) return
    if (output.asciiCells) {
      downloadHtml(
        asciiToHtml({
          text: output.ascii,
          rows: output.asciiRows,
          columns: output.asciiColumns,
          cells: output.asciiCells,
        }),
        `${fileName}-ascii.html`,
      )
      return
    }
    downloadText(output.ascii, `${fileName}-ascii.txt`)
  }

  const showCustomColors = settings.paletteId === 'custom'
  const showColorLevels = settings.paletteId === 'levels'
  const isErrorDiffusion = !['bayer-4', 'bayer-8', 'threshold'].includes(settings.algorithm)

  const asciiPreview = useMemo(() => {
    if (!output) return null
    if (!output.asciiCells) {
      return <pre className="ascii-preview ascii-preview-mono">{output.ascii}</pre>
    }
    const lines: ReactNode[] = []
    for (let row = 0; row < output.asciiRows; row++) {
      const spans: ReactNode[] = []
      for (let col = 0; col < output.asciiColumns; col++) {
        const cell = output.asciiCells[row * output.asciiColumns + col]
        spans.push(
          <span
            key={`${row}-${col}`}
            style={{ color: `rgb(${cell.r},${cell.g},${cell.b})` }}
          >
            {cell.char}
          </span>,
        )
      }
      lines.push(
        <div key={row} className="ascii-line">
          {spans}
        </div>,
      )
    }
    return (
      <div className="ascii-preview ascii-preview-color" aria-label="ASCII preview">
        {lines}
      </div>
    )
  }, [output])

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">Halftone</h1>
        <div className="topbar-actions">
          <button type="button" className="btn btn-primary" onClick={() => void savePng()} disabled={!output}>
            Save PNG
          </button>
          <button type="button" className="btn" onClick={() => void copyAscii()} disabled={!output?.ascii}>
            Copy text
          </button>
          <button type="button" className="btn" onClick={saveAscii} disabled={!output?.ascii}>
            {output?.asciiCells ? 'Save HTML' : 'Save .txt'}
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="rail">
          <section className="rail-section">
            <h2>Image</h2>
            <button
              type="button"
              className={`drop-well${dragging ? ' dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                onFiles(e.dataTransfer.files)
              }}
            >
              <strong>Drop, paste, or pick</strong>
              <span>{fileName}</span>
            </button>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(e) => onFiles(e.target.files)}
            />
          </section>

          <section className="rail-section">
            <h2>Dither</h2>
            <div className="field">
              <label htmlFor="algorithm">Algorithm</label>
              <select
                id="algorithm"
                value={settings.algorithm}
                onChange={(e) => patch('algorithm', e.target.value as DitherAlgorithm)}
              >
                {ALGORITHMS.map((id) => (
                  <option key={id} value={id}>
                    {ALGORITHM_LABELS[id]}
                  </option>
                ))}
              </select>
            </div>

            {isErrorDiffusion && (
              <div className="field">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.serpentine}
                    onChange={(e) => patch('serpentine', e.target.checked)}
                  />
                  Serpentine scan
                </label>
              </div>
            )}

            <div className="field">
              <label htmlFor="palette">Palette</label>
              <select
                id="palette"
                value={settings.paletteId}
                onChange={(e) => patch('paletteId', e.target.value as PaletteId)}
              >
                <option value="levels">Full color</option>
                {FIXED_PALETTE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {PALETTES[id].label}
                  </option>
                ))}
                <option value="custom">Ink and paper</option>
              </select>
            </div>

            {showColorLevels && (
              <div className="field">
                <div className="field-row">
                  <label htmlFor="colorLevels">Color depth</label>
                  <span className="field-value">
                    {settings.colorLevels}³ ({settings.colorLevels ** 3})
                  </span>
                </div>
                <input
                  id="colorLevels"
                  type="range"
                  min={2}
                  max={5}
                  step={1}
                  value={settings.colorLevels}
                  onChange={(e) => patch('colorLevels', Number(e.target.value))}
                />
              </div>
            )}

            {showCustomColors && (
              <div className="field">
                <span>Ink and paper</span>
                <div className="color-pair">
                  <label>
                    <span className="sr-only">Ink</span>
                    <input
                      type="color"
                      value={rgbToHex(settings.ink)}
                      onChange={(e) => patch('ink', hexToRgb(e.target.value))}
                    />
                  </label>
                  <label>
                    <span className="sr-only">Paper</span>
                    <input
                      type="color"
                      value={rgbToHex(settings.paper)}
                      onChange={(e) => patch('paper', hexToRgb(e.target.value))}
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="field">
              <div className="field-row">
                <label htmlFor="maxSide">Pixel size</label>
                <span className="field-value">{settings.maxSide}px</span>
              </div>
              <input
                id="maxSide"
                type="range"
                min={40}
                max={400}
                step={4}
                value={settings.maxSide}
                onChange={(e) => patch('maxSide', Number(e.target.value))}
              />
            </div>

            <div className="field">
              <div className="field-row">
                <label htmlFor="brightness">Brightness</label>
                <span className="field-value">{settings.brightness}</span>
              </div>
              <input
                id="brightness"
                type="range"
                min={-100}
                max={100}
                value={settings.brightness}
                onChange={(e) => patch('brightness', Number(e.target.value))}
              />
            </div>

            <div className="field">
              <div className="field-row">
                <label htmlFor="contrast">Contrast</label>
                <span className="field-value">{settings.contrast}</span>
              </div>
              <input
                id="contrast"
                type="range"
                min={-100}
                max={100}
                value={settings.contrast}
                onChange={(e) => patch('contrast', Number(e.target.value))}
              />
            </div>
          </section>

          <section className="rail-section">
            <h2>ASCII</h2>
            <div className="field">
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.asciiColor}
                  onChange={(e) => patch('asciiColor', e.target.checked)}
                />
                Color
              </label>
            </div>

            <div className="field">
              <div className="field-row">
                <label htmlFor="columns">Columns</label>
                <span className="field-value">{settings.asciiColumns}</span>
              </div>
              <input
                id="columns"
                type="range"
                min={40}
                max={200}
                step={2}
                value={settings.asciiColumns}
                onChange={(e) => patch('asciiColumns', Number(e.target.value))}
              />
            </div>

            <div className="field">
              <label htmlFor="charset">Characters</label>
              <select
                id="charset"
                value={charsetId}
                onChange={(e) => {
                  const id = e.target.value as CharsetId
                  setCharsetId(id)
                  if (id !== 'custom') {
                    patch('asciiChars', CHARSET_PRESETS[id].chars)
                  }
                }}
              >
                {(Object.keys(CHARSET_PRESETS) as Exclude<CharsetId, 'custom'>[]).map((id) => (
                  <option key={id} value={id}>
                    {CHARSET_PRESETS[id].label}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="chars">Character set</label>
              <textarea
                id="chars"
                value={settings.asciiChars}
                onChange={(e) => {
                  setCharsetId('custom')
                  patch('asciiChars', e.target.value)
                }}
                spellCheck={false}
              />
            </div>

            <div className="field">
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.asciiInvert}
                  onChange={(e) => patch('asciiInvert', e.target.checked)}
                />
                Invert
              </label>
            </div>
          </section>
        </aside>

        <main className="preview-pane">
          <div className="mode-tabs" role="tablist" aria-label="Preview mode">
            {(
              [
                ['dither', 'Dither'],
                ['ascii', 'ASCII'],
                ['original', 'Original'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                className="mode-tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="preview-stage">
            <div className={`preview-plate${mode === 'ascii' && settings.asciiColor ? ' preview-plate-dark' : ''}`}>
              {mode === 'ascii' ? (
                asciiPreview
              ) : (
                <canvas ref={canvasRef} className="preview-canvas" aria-label={`${mode} preview`} />
              )}
            </div>
          </div>

          {busy && <div className="status">Processing…</div>}
        </main>
      </div>
    </div>
  )
}
