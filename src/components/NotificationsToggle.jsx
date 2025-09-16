import React, { useState } from 'react'
import { Bell } from 'lucide-react'
import { ensurePermission } from '../lib/notifications'

export default function NotificationsToggle() {
  const [granted, setGranted] = useState(
    typeof Notification !== 'undefined' && Notification?.permission === 'granted'
  )

  const enable = async () => {
    try {
      const ok = await ensurePermission()
      setGranted(ok)
    } catch {/* ignore */}
  }

  return (
    <button
      className={`btn ${granted ? 'btn-primary' : ''}`}
      onClick={enable}
      aria-label={granted ? 'Notifications enabled' : 'Enable notifications'}
      title={granted ? 'Notifications enabled' : 'Enable notifications'}
    >
      <Bell className="w-4 h-4" />
    </button>
  )
}
