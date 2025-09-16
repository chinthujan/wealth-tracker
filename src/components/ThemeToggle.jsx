import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useStore } from '../state/store'

export default function ThemeToggle() {
  const { data, setData } = useStore()
  const current = data?.settings?.theme || 'system'

  // Resolve 'system' to actual
  const resolved =
    current === 'system'
      ? (typeof window !== 'undefined' &&
         window.matchMedia &&
         window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light')
      : current

  const isDark = resolved === 'dark'

  const toggle = () => {
    const next = isDark ? 'light' : 'dark'
    setData(prev => ({ ...prev, settings: { ...prev.settings, theme: next } }))
    // Ensure UI updates immediately
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark')
    }
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
