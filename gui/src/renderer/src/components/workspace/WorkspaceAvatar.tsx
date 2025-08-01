import React, { useCallback, useRef, useState } from 'react'
import { Avatar, Tooltip, Box } from '@mui/material'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { WorkspaceAvatarProps } from './types'

/**
 * WorkspaceAvatar - Smart avatar component for workspace representation
 * Features: Auto-generated emoji/initial, active state indicator, consistent sizing, drag and drop support
 */
export const WorkspaceAvatar: React.FC<WorkspaceAvatarProps> = ({
  workspace,
  size = 'medium',
  isActive = false,
  onClick,
  onContextMenu,
  enableDragDrop = true,
  data,
  sx: additionalSx
}) => {
  const sizeMap = {
    small: { width: 40, height: 40, fontSize: '1rem' },
    medium: { width: 52, height: 52, fontSize: '1.5rem' },
    large: { width: 64, height: 64, fontSize: '2rem' }
  }

  const dimensions = sizeMap[size]

  // Drag and drop setup
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: workspace.id,
    data: {
      type: 'workspace',
      workspace,
      ...data
    },
    disabled: !enableDragDrop
  })

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1, // Only reduce opacity when actually dragging (not just drag started)
    zIndex: isDragging ? 1000 : 1
  }

  // Generate display content: emoji > first char > fallback
  const getDisplayContent = () => {
    if (workspace.emoji) return workspace.emoji
    if (workspace.name) return workspace.name.charAt(0).toUpperCase()
    return '粵' // Fallback to CantoCap character
  }

  // Generate background color from workspace ID for consistency
  const getBackgroundColor = () => {
    if (workspace.color) return workspace.color
    
    // Generate consistent color from workspace ID
    const hash = workspace.id.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc)
    }, 0)
    
    const colors = [
      '#F59E0B', // Primary amber
      '#57F287', // Success green  
      '#FEE75C', // Warning yellow
      '#7DD3FC', // Info blue
      '#A78BFA', // Purple
      '#FB7185', // Pink
      '#34D399', // Emerald
      '#FBBF24'  // Yellow
    ]
    
    return colors[Math.abs(hash) % colors.length]
  }

  // State for click vs drag detection
  const [isPointerDown, setIsPointerDown] = useState(false)
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const hasMovedRef = useRef(false)
  
  // Drag threshold - must move at least this many pixels to be considered drag
  const DRAG_THRESHOLD = 5
  const CLICK_TIME_THRESHOLD = 200 // ms

  // Enhanced pointer handlers that work with dnd-kit
  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (!enableDragDrop) {
      // If drag is disabled, still handle clicks
      if (onClick) {
        onClick()
      }
      return
    }

    // Capture starting position and time
    pointerStartRef.current = { 
      x: event.clientX, 
      y: event.clientY, 
      time: Date.now() 
    }
    setIsPointerDown(true)
    hasMovedRef.current = false
  }, [enableDragDrop, onClick])

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!enableDragDrop || !pointerStartRef.current || !isPointerDown) return

    const deltaX = Math.abs(event.clientX - pointerStartRef.current.x)
    const deltaY = Math.abs(event.clientY - pointerStartRef.current.y)
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // Mark as moved if beyond threshold
    if (distance > DRAG_THRESHOLD) {
      hasMovedRef.current = true
    }
  }, [enableDragDrop, isPointerDown, DRAG_THRESHOLD])

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    if (!pointerStartRef.current || !isPointerDown) return

    const deltaX = Math.abs(event.clientX - pointerStartRef.current.x)
    const deltaY = Math.abs(event.clientY - pointerStartRef.current.y)
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const timeDiff = Date.now() - pointerStartRef.current.time
    
    // Determine if this was a click (short time + minimal movement)
    const wasClick = !hasMovedRef.current && 
                     distance < DRAG_THRESHOLD && 
                     timeDiff < CLICK_TIME_THRESHOLD
    
    if (wasClick && onClick && !isDragging) {
      event.preventDefault()
      event.stopPropagation()
      onClick()
    }

    // Reset state
    setIsPointerDown(false)
    hasMovedRef.current = false
    pointerStartRef.current = null
  }, [isPointerDown, onClick, isDragging, DRAG_THRESHOLD, CLICK_TIME_THRESHOLD])

  // No cleanup needed since we removed timeout-based drag

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (onContextMenu) {
      onContextMenu(event)
    }
  }, [onContextMenu])

  // Determine cursor based on interaction state
  const getCursor = () => {
    if (isDragging) return 'grabbing'
    if (!enableDragDrop) return 'default'
    return 'pointer' // Always pointer for better UX when drag is enabled
  }

  return (
    <Tooltip title={workspace.name} placement="right" arrow>
      <Box 
        ref={setNodeRef} 
        style={dragStyle}
        sx={{ position: 'relative', ...additionalSx }}
        {...attributes}
      >
        <Avatar
          {...(enableDragDrop ? listeners : {})}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={handleContextMenu}
          sx={{
            ...dimensions,
            backgroundColor: getBackgroundColor(),
            borderRadius: 2,
            fontWeight: 'bold',
            cursor: getCursor(),
            transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            border: isActive ? 3 : 2,
            borderColor: isActive ? 'primary.main' : 'transparent',
            boxShadow: isActive 
              ? '0 0 0 2px rgba(245, 158, 11, 0.2)' 
              : 'none',
            opacity: isDragging ? 0.5 : 1, // Only show drag preview when actually dragging
            '&:hover': {
              transform: isDragging ? 'none' : 'scale(1.05)',
              borderColor: isActive ? 'primary.light' : 'rgba(245, 158, 11, 0.5)',
              boxShadow: isActive 
                ? '0 0 0 3px rgba(245, 158, 11, 0.3)' 
                : '0 0 0 2px rgba(245, 158, 11, 0.2)',
            },
            '&:active': {
              transform: isDragging ? 'none' : 'scale(0.98)',
            }
          }}
        >
          {getDisplayContent()}
        </Avatar>
        
        {/* Active Indicator Dot */}
        {isActive && (
          <Box
            sx={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 12,
              height: 12,
              backgroundColor: 'primary.main',
              borderRadius: '50%',
              border: '2px solid',
              borderColor: 'background.paper',
              boxShadow: '0 0 4px rgba(245, 158, 11, 0.4)'
            }}
          />
        )}
      </Box>
    </Tooltip>
  )
}