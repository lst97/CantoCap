import React from 'react'
import { useAppStore } from '../../stores/app-store'
import { HardwareModal } from './HardwareModal'

export const ModalContainer = () => {
  const { ui, closeModal } = useAppStore()

  if (!ui.activeModal) return null

  const renderModal = () => {
    switch (ui.activeModal) {
      case 'hardware':
        return <HardwareModal />
      default:
        return null
    }
  }

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {renderModal()}
      </div>
    </div>
  )
}