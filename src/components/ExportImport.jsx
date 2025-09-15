import React, { useRef } from 'react'
import { Download, Upload } from 'lucide-react'
import { exportAsBlob, importFromText } from '../lib/storage'
import { useStore } from '../state/store'

export default function ExportImport() {
  const fileRef = useRef(null)
  const { replaceAll } = useStore()

  const doExport = () => {
    const blob = exportAsBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wealth-tracker-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const res = importFromText(text)
    if (!res.ok) {
      alert('Import failed: ' + res.error)
    } else {
      try { replaceAll(JSON.parse(text)) } catch {}
      alert('Import successful.')
      window.location.reload()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button className="btn btn-primary" onClick={doExport}><Download className="w-4 h-4"/> Export</button>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onFile}/>
      <button className="btn" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4"/> Import</button>
    </div>
  )
}
