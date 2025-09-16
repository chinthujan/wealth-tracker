import React, { useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useStore } from '../state/store'

function applyThemeClass(mode) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }
}

export default function ThemeToggle() {
  const { data, setData } = useStore()

  // On mount, ensure DOM matches saved theme (or system)
  useEffect(() => {
    const saved = data?.settings?.theme || 'system'
    const resolved =
      saved === 'system'
        ? (typeof window !== 'undefined' &&
           window.matchMedia &&
           window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light')
        : saved
    applyThemeClass(resolved)
  }, []) // run once

  // Read current from DOM so the icon matches reality immediately
  const isDark = typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : (data?.settings?.theme === 'dark')

  const toggle = () => {
    const next = isDark ? 'light' : 'dark'
    // 1) Flip DOM first (instant)
    applyThemeClass(next)
    // 2) Persist to store
    setData(prev => ({ ...prev, settings: { ...prev.settings, theme: next } }))
  }

  return (
    <button
      className="btn"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  )
}
