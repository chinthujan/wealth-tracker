import React, { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'system')

  useEffect(() => {
    const root = document.documentElement
    if (mode === 'dark') {
      root.classList.add('dark')
    } else if (mode === 'light') {
      root.classList.remove('dark')
    } else {
      // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark')
      else root.classList.remove('dark')
    }
    localStorage.setItem('theme', mode)
  }, [mode])

  return (
    <div className="flex items-center gap-1">
      <button className={`btn px-2 ${mode==='light'?'btn-primary':''}`} onClick={() => setMode('light')} title="Light mode"><Sun className="w-4 h-4"/></button>
      <button className={`btn px-2 ${mode==='system'?'btn-primary':''}`} onClick={() => setMode('system')} title="System"><span className="text-xs">A</span></button>
      <button className={`btn px-2 ${mode==='dark'?'btn-primary':''}`} onClick={() => setMode('dark')} title="Dark mode"><Moon className="w-4 h-4"/></button>
    </div>
  )
}
