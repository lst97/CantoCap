/**
 * Performance Monitor Component
 * 
 * Real-time performance monitoring and metrics display for subtitle persistence operations.
 * Provides visual feedback on cache performance, memory usage, and operation metrics.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Grid,
  Tooltip,
  IconButton,
  Collapse,
  Alert
} from '@mui/material'
import {
  Speed,
  Memory,
  Storage,
  TrendingUp,
  TrendingDown,
  ExpandMore,
  ExpandLess,
  Warning,
  CheckCircle
} from '@mui/icons-material'
import { useSubtitlePersistence } from '../../hooks/useSubtitlePersistence'

interface PerformanceMonitorProps {
  /** Show detailed metrics */
  detailed?: boolean
  /** Update interval in milliseconds */
  updateInterval?: number
  /** Compact mode for smaller displays */
  compact?: boolean
  /** Alert thresholds */
  thresholds?: {
    latency: number
    errorRate: number
    memoryUsage: number
    cacheHitRate: number
  }
}

interface PerformanceMetrics {
  latency: number
  throughput: number
  errorRate: number
  cacheHitRate: number
  memoryUsage: number
  performanceScore: number
  operationsPerMinute: number
}

const DEFAULT_THRESHOLDS = {
  latency: 500, // ms
  errorRate: 5, // %
  memoryUsage: 80, // %
  cacheHitRate: 90 // %
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  detailed = false,
  updateInterval = 5000,
  compact = false,
  thresholds = DEFAULT_THRESHOLDS
}) => {
  const { getPerformanceMetrics, cacheMetrics } = useSubtitlePersistence(undefined, {})
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    latency: 0,
    throughput: 0,
    errorRate: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    performanceScore: 100,
    operationsPerMinute: 0
  })
  const [expanded, setExpanded] = useState(!compact)
  const [alerts, setAlerts] = useState<Array<{ type: 'warning' | 'error'; message: string }>>([])

  /**
   * Update performance metrics
   */
  const updateMetrics = useCallback(async () => {
    try {
      const rawMetrics = await getPerformanceMetrics()
      const recentMetrics = rawMetrics.filter(m => 
        Date.now() - m.timestamp < 5 * 60 * 1000 // Last 5 minutes
      )

      // Calculate derived metrics
      const newMetrics: PerformanceMetrics = {
        latency: recentMetrics.length > 0 
          ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length 
          : 0,
        throughput: recentMetrics.length > 0
          ? recentMetrics.reduce((sum, m) => sum + m.throughput, 0) / recentMetrics.length
          : 0,
        errorRate: recentMetrics.length > 0
          ? (recentMetrics.filter(m => !m.success).length / recentMetrics.length) * 100
          : 0,
        cacheHitRate: cacheMetrics.hitRate * 100 || 0,
        memoryUsage: cacheMetrics.memoryUsage?.total 
          ? (cacheMetrics.memoryUsage.total / (50 * 1024 * 1024)) * 100 // % of 50MB limit
          : 0,
        performanceScore: calculatePerformanceScore(recentMetrics, cacheMetrics),
        operationsPerMinute: recentMetrics.length * (60 / 5) // Scale 5-minute window to per minute
      }

      setMetrics(newMetrics)
      checkAlerts(newMetrics)
    } catch (error) {
      console.error('Failed to update performance metrics:', error)
    }
  }, [getPerformanceMetrics, cacheMetrics, thresholds])

  /**
   * Check for performance alerts
   */
  const checkAlerts = useCallback((currentMetrics: PerformanceMetrics) => {
    const newAlerts: Array<{ type: 'warning' | 'error'; message: string }> = []

    if (currentMetrics.latency > thresholds.latency) {
      newAlerts.push({
        type: currentMetrics.latency > thresholds.latency * 2 ? 'error' : 'warning',
        message: `High latency: ${Math.round(currentMetrics.latency)}ms`
      })
    }

    if (currentMetrics.errorRate > thresholds.errorRate) {
      newAlerts.push({
        type: 'error',
        message: `High error rate: ${Math.round(currentMetrics.errorRate)}%`
      })
    }

    if (currentMetrics.memoryUsage > thresholds.memoryUsage) {
      newAlerts.push({
        type: 'warning',
        message: `High memory usage: ${Math.round(currentMetrics.memoryUsage)}%`
      })
    }

    if (currentMetrics.cacheHitRate < thresholds.cacheHitRate) {
      newAlerts.push({
        type: 'warning',
        message: `Low cache hit rate: ${Math.round(currentMetrics.cacheHitRate)}%`
      })
    }

    setAlerts(newAlerts)
  }, [thresholds])

  /**
   * Calculate overall performance score
   */
  const calculatePerformanceScore = (rawMetrics: any[], cache: any): number => {
    let score = 100

    // Latency penalty
    const avgLatency = rawMetrics.length > 0 
      ? rawMetrics.reduce((sum, m) => sum + m.duration, 0) / rawMetrics.length 
      : 0
    if (avgLatency > 500) {
      score -= Math.min(30, (avgLatency - 500) / 100)
    }

    // Error rate penalty
    const errorRate = rawMetrics.length > 0
      ? (rawMetrics.filter(m => !m.success).length / rawMetrics.length) * 100
      : 0
    score -= errorRate * 2

    // Cache efficiency bonus
    const cacheEfficiency = (cache.hitRate || 0) * 100
    score += (cacheEfficiency - 50) * 0.2

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Get status color based on metric value and threshold
   */
  const getStatusColor = (value: number, threshold: number, inverse = false) => {
    const isGood = inverse ? value < threshold : value > threshold
    return isGood ? 'success' : value > threshold * 0.8 ? 'warning' : 'error'
  }

  /**
   * Format file size
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Update metrics on mount and interval
  useEffect(() => {
    updateMetrics()
    const interval = setInterval(updateMetrics, updateInterval)
    return () => clearInterval(interval)
  }, [updateMetrics, updateInterval])

  if (compact && !expanded) {
    return (
      <Card sx={{ mb: 1 }}>
        <CardContent sx={{ py: 1 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <Speed color={getStatusColor(metrics.performanceScore, 80)} />
              <Typography variant="body2">
                Performance: {Math.round(metrics.performanceScore)}%
              </Typography>
              {alerts.length > 0 && (
                <Chip 
                  size="small" 
                  color="warning" 
                  label={`${alerts.length} alert${alerts.length > 1 ? 's' : ''}`}
                />
              )}
            </Box>
            <IconButton size="small" onClick={() => setExpanded(true)}>
              <ExpandMore />
            </IconButton>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" display="flex" alignItems="center" gap={1}>
            <Speed />
            Performance Monitor
          </Typography>
          {compact && (
            <IconButton size="small" onClick={() => setExpanded(false)}>
              <ExpandLess />
            </IconButton>
          )}
        </Box>

        {/* Alerts */}
        {alerts.map((alert, index) => (
          <Alert 
            key={index} 
            severity={alert.type} 
            sx={{ mb: 1 }}
          >
            {alert.message}
          </Alert>
        ))}

        {/* Key Metrics */}
        <Grid container spacing={2} mb={2}>
          <Grid item xs={6} sm={3}>
            <Tooltip title="Average response time for file operations">
              <Box textAlign="center">
                <Typography variant="h4" color={getStatusColor(metrics.latency, thresholds.latency, true)}>
                  {Math.round(metrics.latency)}
                </Typography>
                <Typography variant="caption">Latency (ms)</Typography>
              </Box>
            </Tooltip>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Tooltip title="Percentage of successful operations">
              <Box textAlign="center">
                <Typography variant="h4" color={getStatusColor(100 - metrics.errorRate, 100 - thresholds.errorRate)}>
                  {Math.round(100 - metrics.errorRate)}%
                </Typography>
                <Typography variant="caption">Success Rate</Typography>
              </Box>
            </Tooltip>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Tooltip title="Cache hit rate for file loads">
              <Box textAlign="center">
                <Typography variant="h4" color={getStatusColor(metrics.cacheHitRate, thresholds.cacheHitRate)}>
                  {Math.round(metrics.cacheHitRate)}%
                </Typography>
                <Typography variant="caption">Cache Hit Rate</Typography>
              </Box>
            </Tooltip>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Tooltip title="Overall performance score">
              <Box textAlign="center">
                <Typography variant="h4" color={getStatusColor(metrics.performanceScore, 80)}>
                  {Math.round(metrics.performanceScore)}
                </Typography>
                <Typography variant="caption">Performance Score</Typography>
              </Box>
            </Tooltip>
          </Grid>
        </Grid>

        <Collapse in={detailed || expanded}>
          {/* Detailed Metrics */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Memory Usage
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <LinearProgress 
                variant="determinate" 
                value={Math.min(metrics.memoryUsage, 100)} 
                sx={{ flexGrow: 1, height: 8 }}
                color={getStatusColor(100 - metrics.memoryUsage, 100 - thresholds.memoryUsage)}
              />
              <Typography variant="body2">
                {Math.round(metrics.memoryUsage)}%
              </Typography>
            </Box>

            <Typography variant="subtitle2" gutterBottom>
              Cache Statistics
            </Typography>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  Entries: {cacheMetrics.entryCount || 0}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  Size: {formatBytes(cacheMetrics.currentSize || 0)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  Hits: {cacheMetrics.hitCount || 0}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  Misses: {cacheMetrics.missCount || 0}
                </Typography>
              </Grid>
            </Grid>

            <Typography variant="subtitle2" gutterBottom>
              Operation Statistics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  Throughput: {formatBytes(metrics.throughput)}/s
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  Operations/min: {Math.round(metrics.operationsPerMinute)}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  )
}

export default PerformanceMonitor