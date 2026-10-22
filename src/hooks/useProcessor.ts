import { useCallback, useEffect, useRef, useState } from 'react'
import type { AsciiCell } from '../lib/ascii'
import type { ProcessRequest, ProcessResult, ProcessSettings } from '../lib/types'

export interface ProcessorOutput {
  width: number
  height: number
  dithered: ImageData
  ascii: string
  asciiRows: number
  asciiColumns: number
  asciiCells: AsciiCell[] | null
}

export function useProcessor() {
  const workerRef = useRef<Worker | null>(null)
  const requestId = useRef(0)
  const [output, setOutput] = useState<ProcessorOutput | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const worker = new Worker(new URL('../worker/process.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<ProcessResult>) => {
      const { id, width, height, dithered, ascii, asciiRows, asciiColumns, asciiCells } =
        event.data
      if (id !== requestId.current) return
      const pixels = new Uint8ClampedArray(dithered)
      setOutput({
        width,
        height,
        dithered: new ImageData(pixels, width, height),
        ascii,
        asciiRows,
        asciiColumns,
        asciiCells,
      })
      setBusy(false)
    }
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const process = useCallback((imageData: ImageData, settings: ProcessSettings) => {
    const worker = workerRef.current
    if (!worker) return
    const id = ++requestId.current
    setBusy(true)
    const copy = new Uint8ClampedArray(imageData.data)
    const buffer = copy.buffer
    const request: ProcessRequest = {
      id,
      width: imageData.width,
      height: imageData.height,
      buffer,
      settings,
    }
    worker.postMessage(request, [buffer])
  }, [])

  return { output, busy, process }
}
