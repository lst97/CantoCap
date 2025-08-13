import React, { useState, useCallback } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import { BaseSlider } from './BaseSlider'

interface RangeSliderProps {
  min?: number
  max?: number
  value?: [number, number]
  onChange?: (value: [number, number]) => void
  step?: number
  label?: string
  formatValue?: (value: number) => string
  marks?: { value: number; label: string }[]
  disabled?: boolean
  size?: 'small' | 'medium'
  variant?: 'primary' | 'secondary'
  showValueChips?: boolean
}

export const RangeSlider: React.FC<RangeSliderProps> = ({
  min = 0,
  max = 100,
  value = [0, 100],
  onChange,
  step = 1,
  label,
  formatValue,
  marks,
  disabled = false,
  size = 'medium',
  variant = 'primary',
  showValueChips = true,
  ...props
}) => {
  const [internalValue, setInternalValue] = useState<[number, number]>(value)

  const handleChange = useCallback((_: Event, newValue: number | number[]) => {
    const rangeValue: [number, number] = Array.isArray(newValue) 
      ? [newValue[0] ?? 0, newValue[1] ?? 0] 
      : [newValue, newValue]
    setInternalValue(rangeValue)
    onChange?.(rangeValue)
  }, [onChange])

  const getDuration = () => {
    return internalValue[1] - internalValue[0]
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const displayFormat = formatValue || formatTime

  return (
    <Box>
      {label && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {label}
          </Typography>
          {showValueChips && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip 
                label={`Start: ${displayFormat(internalValue[0])}`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: 'primary.main',
                  fontSize: '0.7rem',
                  height: 20
                }}
              />
              <Chip 
                label={`End: ${displayFormat(internalValue[1])}`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: 'primary.main',
                  fontSize: '0.7rem',
                  height: 20
                }}
              />
              <Chip 
                label={`Duration: ${displayFormat(getDuration())}`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(87, 242, 135, 0.15)',
                  color: 'success.main',
                  fontSize: '0.7rem',
                  height: 20
                }}
              />
            </Box>
          )}
        </Box>
      )}
      
      <BaseSlider
        value={internalValue}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        marks={marks}
        disabled={disabled}
        size={size}
        variant={variant}
        valueLabelDisplay="auto"
        valueLabelFormat={displayFormat}
        sx={{
          '& .MuiSlider-track': {
            height: size === 'small' ? 6 : 8,
          },
          '& .MuiSlider-rail': {
            height: size === 'small' ? 6 : 8,
          },
        }}
        {...props}
      />
      
      {/* Range Selection Info */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mt: 1,
        px: 1
      }}>
        <Typography variant="caption" color="text.secondary">
          {displayFormat(min)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {displayFormat(max)}
        </Typography>
      </Box>
    </Box>
  )
}