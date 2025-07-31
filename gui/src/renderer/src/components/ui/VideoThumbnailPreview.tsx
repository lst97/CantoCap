import React, { useEffect, useState, useRef } from 'react'
import { Box, Paper, CircularProgress } from '@mui/material'
// import { useAppStore } from '../../stores/app-store'

interface VideoThumbnailPreviewProps {
  isVisible: boolean
  position: { x: number; y: number }
  time: number
  duration: number
}

export const VideoThumbnailPreview: React.FC<VideoThumbnailPreviewProps> = ({
  isVisible,
  position,
  time,
  duration
}) => {
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Function to capture video frame at specific time
  const captureVideoFrame = async (targetTime: number): Promise<void> => {
    const videoElement = document.querySelector('video') as HTMLVideoElement
    if (!videoElement) return

    setIsLoading(true)
    setThumbnailDataUrl(null)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setIsLoading(false)
      return
    }

    // Set canvas size to match video aspect ratio for larger thumbnail
    const aspectRatio = videoElement.videoWidth / videoElement.videoHeight || 16/9
    canvas.width = 200
    canvas.height = Math.round(200 / aspectRatio)

    try {
      // Create a temporary video element for frame capture
      const tempVideo = document.createElement('video')
      tempVideo.src = videoElement.src
      tempVideo.currentTime = targetTime
      tempVideo.crossOrigin = 'anonymous'
      
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          tempVideo.removeEventListener('seeked', onSeeked)
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          setThumbnailDataUrl(dataUrl)
          setIsLoading(false)
          resolve()
        }
        tempVideo.addEventListener('seeked', onSeeked)
        tempVideo.addEventListener('loadeddata', onSeeked, { once: true })
      })
    } catch (error) {
      console.warn('Could not capture video frame:', error)
      setThumbnailDataUrl(null)
      setIsLoading(false)
    }
  }

  // Handle visibility changes with delay
  useEffect(() => {
    // Clear any existing timeouts
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
    }

    if (isVisible && duration > 0) {
      // Show thumbnail container immediately but with loading state
      setShowContent(true)
      
      // Delay the actual thumbnail loading for performance
      hoverTimeoutRef.current = setTimeout(() => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
        }
        loadTimeoutRef.current = setTimeout(() => {
          captureVideoFrame(time)
        }, 200) // Additional 200ms delay before loading
      }, 300) // 300ms delay before starting to load
    } else {
      setShowContent(false)
      setThumbnailDataUrl(null)
      setIsLoading(false)
    }

    // Cleanup timeouts
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
      }
    }
  }, [isVisible, time, duration])

  if (!isVisible || !showContent) return null

  return (
    <Box
      sx={{
        position: 'fixed',
        left: position.x,
        top: position.y + 20, // Position below the cursor
        transform: 'translateX(-50%)', // Center horizontally
        zIndex: 10000,
        pointerEvents: 'none'
      }}
    >
      <Paper
        sx={{
          p: 2,
          backgroundColor: 'rgba(0,0,0,0.95)',
          backdropFilter: 'blur(10px)',
          color: 'white',
          fontSize: '0.8rem',
          borderRadius: 3,
          border: '2px solid #ffa726',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 12px 32px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,167,38,0.3)',
          position: 'relative'
        }}
      >
        {/* Enhanced Thumbnail with actual video frame - Made larger */}
        <Box sx={{
          width: 200, // Increased from 140
          height: 112, // Increased from 78 (maintaining 16:9 aspect ratio)
          backgroundColor: '#1a1a1a',
          borderRadius: 1,
          mb: 1,
          border: '1px solid #333',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Actual video frame or loading spinner */}
          {thumbnailDataUrl ? (
            <img
              src={thumbnailDataUrl}
              alt="Video frame"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : isLoading ? (
            <Box sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              background: 'linear-gradient(135deg, #333 0%, #666 50%, #333 100%)'
            }}>
              <CircularProgress 
                size={32} 
                sx={{ 
                  color: '#ffa726',
                  mb: 1 
                }} 
              />
              <Box sx={{
                fontSize: '0.7rem',
                color: '#ffa726',
                fontWeight: 'bold'
              }}>
                {formatTime(time)}
              </Box>
            </Box>
          ) : (
            <Box sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              background: 'linear-gradient(135deg, #333 0%, #666 50%, #333 100%)'
            }}>
              <Box sx={{
                fontSize: '0.7rem',
                color: '#ffa726',
                fontWeight: 'bold'
              }}>
                {formatTime(time)}
              </Box>
              <Box sx={{
                fontSize: '0.6rem',
                color: '#aaa'
              }}>
                Video Preview
              </Box>
            </Box>
          )}
          
          {/* Play icon overlay */}
          <Box sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 167, 38, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.7rem',
            color: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
          }}>
            ▶
          </Box>
          
          {/* Progress indicator on thumbnail */}
          <Box sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: 'rgba(0,0,0,0.5)'
          }}>
            <Box sx={{
              height: '100%',
              width: `${(time / duration) * 100}%`,
              backgroundColor: '#ffa726',
              transition: 'width 0.1s ease'
            }} />
          </Box>
        </Box>
        
        {/* Time info */}
        <Box sx={{ 
          fontFamily: 'monospace', 
          textAlign: 'center',
          fontSize: '1rem',
          fontWeight: 'bold',
          color: '#ffa726',
          mt: 0.5
        }}>
          {formatTime(time)}
        </Box>
        
        {/* Additional frame info */}
        <Box sx={{ 
          fontSize: '0.8rem', 
          opacity: 0.9, 
          textAlign: 'center',
          color: '#fff',
          mt: 0.5
        }}>
          {Math.floor((time / duration) * 1000) / 10}% • Frame {Math.floor((time / duration) * 100) || 0}
        </Box>
      </Paper>
    </Box>
  )
}