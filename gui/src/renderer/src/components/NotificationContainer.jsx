import React from 'react'
import { useAppStore } from '../store/app-store'

export const NotificationContainer = () => {
  const { ui, removeNotification } = useAppStore()

  if (ui.notifications.length === 0) return null

  return (
    <div className="notification-container">
      {ui.notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification ${notification.type}`}
          onClick={() => removeNotification(notification.id)}
        >
          <div className="notification-content">
            <span className="notification-icon">
              {notification.type === 'success' ? '✅' :
               notification.type === 'error' ? '❌' :
               notification.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <div className="notification-message">
              {notification.message.split('\n').map((line, index) => (
                <div key={index} className="notification-line">
                  {line}
                </div>
              ))}
            </div>
          </div>
          <button className="notification-close">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}