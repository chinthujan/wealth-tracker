import React, { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { ensurePermission } from '../lib/notifications'

export default function NotificationsToggle() {
  const [granted, setGranted] = useState(Notification?.permission === 'granted')
  const enable = async () => {
    try {
      const ok = await ensurePermission()
      setGranted(ok)
      if (ok) alert('Notifications enabled. Keep this tab open to receive due reminders.')
    } catch (e) { alert(e.message) }
  }
  return (
    <button className={`btn ${granted ? 'btn-primary' : ''}`} onClick={enable} title="Enable browser notifications">
      <Bell className="w-4 h-4"/> {granted ? 'Notifications On' : 'Enable Notifications'}
    </button>
  )
}
