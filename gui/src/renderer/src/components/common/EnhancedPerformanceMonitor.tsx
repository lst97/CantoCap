/**
 * Enhanced Performance Monitor Component
 * 
 * Advanced real-time performance monitoring for subtitle temp storage operations.
 * Features memory usage tracking, IndexedDB performance metrics, and predictive alerts.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  Alert,
  Stack,
  CircularProgress,
  Badge,
  Divider
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
  CheckCircle,
  ErrorOutline,
  DataUsage,
  Timer,
  Cached,
  CloudSync,
  Analytics
} from '@mui/icons-material'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ChartOptions
} from 'chart.js'
import { useSubtitleTempStorage } from '../../hooks/useSubtitleTempStorage'
import { performanceManager, type PerformanceMetric } from '../../services/subtitle/subtitle-temp-storage-performance'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
)

interface EnhancedPerformanceMonitorProps {
  /** Show detailed metrics */
  detailed?: boolean
  /** Update interval in milliseconds */
  updateInterval?: number
  /** Compact mode for smaller displays */
  compact?: boolean
  /** Enable real-time charts */
  enableCharts?: boolean
  /** Alert thresholds */
  thresholds?: {
    latency: number
    errorRate: number
    memoryUsage: number
    cacheHitRate: number
    throughput: number
  }
  /** Show memory usage */
  showMemory?: boolean
  /** Show IndexedDB metrics */
  showStorage?: boolean
  /** Show predictive alerts */
  showPredictiveAlerts?: boolean
}

interface PerformanceStats {
  avgLatency: number
  errorRate: number
  throughput: number
  memoryUsage: number
  cacheHitRate: number
  activeOperations: number
  queueSize: number
  indexedDBConnections: number
}

interface AlertInfo {
  type: 'warning' | 'error' | 'info'
  message: string
  metric: string
  value: number
  threshold: number
  trend: 'up' | 'down' | 'stable'
}

// Default thresholds
const DEFAULT_THRESHOLDS = {
  latency: 1000, // 1 second
  errorRate: 0.05, // 5%
  memoryUsage: 0.8, // 80%
  cacheHitRate: 0.8, // 80%
  throughput: 10 // ops/sec
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

/**
 * Format percentage for display
 */
function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * Get trend direction
 */
function getTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
  const threshold = 0.05 // 5% change threshold
  const change = Math.abs(current - previous) / previous
  
  if (change < threshold) return 'stable'
  return current > previous ? 'up' : 'down'
}

/**
 * Enhanced Performance Monitor Component
 */
export const EnhancedPerformanceMonitor: React.FC<EnhancedPerformanceMonitorProps> = ({
  detailed = false,
  updateInterval = 1000,
  compact = false,
  enableCharts = false,
  thresholds = DEFAULT_THRESHOLDS,
  showMemory = true,
  showStorage = true,
  showPredictiveAlerts = true
}) => {
  const [expanded, setExpanded] = useState(detailed)
  const [currentStats, setCurrentStats] = useState<PerformanceStats>({
    avgLatency: 0,
    errorRate: 0,
    throughput: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    activeOperations: 0,
    queueSize: 0,
    indexedDBConnections: 0
  })
  const [previousStats, setPreviousStats] = useState<PerformanceStats>(currentStats)
  const [alerts, setAlerts] = useState<AlertInfo[]>([])
  const [chartData, setChartData] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: 'Latency (ms)',
        data: [] as number[],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      },
      {
        label: 'Memory Usage (%)',
        data: [] as number[],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.1
      },
      {
        label: 'Throughput (ops/s)',
        data: [] as number[],
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.1
      }
    ]
  })

  const updateIntervalRef = useRef<NodeJS.Timeout>()
  const tempStorage = useSubtitleTempStorage()

  // Chart options
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        display: !compact
      },
      title: {
        display: false
      }
    },
    scales: {
      x: {
        display: !compact,
        grid: {
          display: false
        }
      },
      y: {
        display: !compact,
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    },
    elements: {
      point: {
        radius: compact ? 0 : 2
      }
    }
  }

  // Update performance stats
  const updateStats = useCallback(() => {
    const metrics = performanceManager.metricsCollector.getMetrics(Date.now() - 60000) // Last minute
    const memoryUsage = performanceManager.memoryManager.getMemoryUsage()
    const avgPerf = performanceManager.metricsCollector.getAveragePerformance()

    const newStats: PerformanceStats = {
      avgLatency: avgPerf.averageDuration,
      errorRate: avgPerf.errorRate,
      throughput: avgPerf.throughput,
      memoryUsage: memoryUsage?.ratio || 0,
      cacheHitRate: metrics.filter(m => m.cacheHit).length / Math.max(1, metrics.length),
      activeOperations: tempStorage.isSaving || tempStorage.isAutoSaving ? 1 : 0,
      queueSize: 0, // Would need to expose from service
      indexedDBConnections: 1 // Would need to expose from connection pool
    }

    setPreviousStats(currentStats)
    setCurrentStats(newStats)

    // Update chart data
    if (enableCharts) {
      const now = new Date().toLocaleTimeString()
      setChartData(prev => {
        const newLabels = [...prev.labels, now].slice(-20) // Keep last 20 points
        const newLatencyData = [...prev.datasets[0].data, newStats.avgLatency].slice(-20)
        const newMemoryData = [...prev.datasets[1].data, newStats.memoryUsage * 100].slice(-20)
        const newThroughputData = [...prev.datasets[2].data, newStats.throughput].slice(-20)

        return {
          labels: newLabels,
          datasets: [
            { ...prev.datasets[0], data: newLatencyData },
            { ...prev.datasets[1], data: newMemoryData },
            { ...prev.datasets[2], data: newThroughputData }
          ]
        }
      })
    }

    // Generate alerts
    generateAlerts(newStats, previousStats)
  }, [currentStats, tempStorage, enableCharts, previousStats])

  // Generate performance alerts
  const generateAlerts = useCallback((current: PerformanceStats, previous: PerformanceStats) => {
    const newAlerts: AlertInfo[] = []

    // Latency alert
    if (current.avgLatency > thresholds.latency) {
      newAlerts.push({
        type: current.avgLatency > thresholds.latency * 2 ? 'error' : 'warning',
        message: `High latency detected: ${formatDuration(current.avgLatency)}`,
        metric: 'latency',
        value: current.avgLatency,
        threshold: thresholds.latency,
        trend: getTrend(current.avgLatency, previous.avgLatency)
      })
    }

    // Error rate alert
    if (current.errorRate > thresholds.errorRate) {
      newAlerts.push({
        type: 'error',
        message: `High error rate: ${formatPercentage(current.errorRate)}`,
        metric: 'errorRate',
        value: current.errorRate,
        threshold: thresholds.errorRate,
        trend: getTrend(current.errorRate, previous.errorRate)
      })
    }

    // Memory usage alert
    if (current.memoryUsage > thresholds.memoryUsage) {
      newAlerts.push({
        type: current.memoryUsage > 0.9 ? 'error' : 'warning',
        message: `High memory usage: ${formatPercentage(current.memoryUsage)}`,
        metric: 'memoryUsage',
        value: current.memoryUsage,
        threshold: thresholds.memoryUsage,
        trend: getTrend(current.memoryUsage, previous.memoryUsage)
      })
    }

    // Cache hit rate alert
    if (current.cacheHitRate < thresholds.cacheHitRate && current.cacheHitRate > 0) {
      newAlerts.push({
        type: 'warning',
        message: `Low cache hit rate: ${formatPercentage(current.cacheHitRate)}`,
        metric: 'cacheHitRate',
        value: current.cacheHitRate,
        threshold: thresholds.cacheHitRate,
        trend: getTrend(current.cacheHitRate, previous.cacheHitRate)
      })
    }

    // Throughput alert
    if (current.throughput < thresholds.throughput && current.throughput > 0) {
      newAlerts.push({
        type: 'info',
        message: `Low throughput: ${current.throughput.toFixed(1)} ops/s`,
        metric: 'throughput',
        value: current.throughput,
        threshold: thresholds.throughput,
        trend: getTrend(current.throughput, previous.throughput)
      })
    }

    setAlerts(newAlerts)
  }, [thresholds])

  // Performance status indicator
  const getPerformanceStatus = useMemo(() => {
    const criticalAlerts = alerts.filter(a => a.type === 'error').length
    const warningAlerts = alerts.filter(a => a.type === 'warning').length

    if (criticalAlerts > 0) {
      return { color: 'error' as const, icon: <ErrorOutline />, label: 'Critical' }
    }
    if (warningAlerts > 0) {
      return { color: 'warning' as const, icon: <Warning />, label: 'Warning' }
    }
    return { color: 'success' as const, icon: <CheckCircle />, label: 'Good' }
  }, [alerts])

  // Setup update interval
  useEffect(() => {
    updateStats() // Initial update

    updateIntervalRef.current = setInterval(updateStats, updateInterval)

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [updateStats, updateInterval])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [])

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title={`Performance: ${getPerformanceStatus.label}`}>
          <Badge badgeContent={alerts.length} color={getPerformanceStatus.color}>
            <Chip
              icon={getPerformanceStatus.icon}
              label={formatDuration(currentStats.avgLatency)}
              size="small"
              color={getPerformanceStatus.color}
              variant="outlined"
              onClick={() => setExpanded(!expanded)}
            />
          </Badge>
        </Tooltip>
        
        {showMemory && (
          <Tooltip title={`Memory: ${formatPercentage(currentStats.memoryUsage)}`}>
            <Chip
              icon={<Memory />}
              label={formatPercentage(currentStats.memoryUsage)}
              size="small"
              color={currentStats.memoryUsage > thresholds.memoryUsage ? 'warning' : 'default'}
              variant="outlined"
            />
          </Tooltip>
        )}

        <Collapse in={expanded} orientation="horizontal">
          <Box sx={{ ml: 1, minWidth: 200 }}>
            {enableCharts && (
              <Box sx={{ height: 60 }}>
                <Line data={chartData} options={chartOptions} />
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>
    )
  }

  return (
    <Card 
      sx={{ 
        minWidth: 300,
        maxWidth: expanded ? 800 : 400,
        transition: 'all 0.3s ease-in-out'
      }}
    >
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Analytics />
            Performance Monitor
            <Badge badgeContent={alerts.length} color={getPerformanceStatus.color}>
              <Chip
                icon={getPerformanceStatus.icon}
                label={getPerformanceStatus.label}
                size="small"
                color={getPerformanceStatus.color}
                variant="filled"
              />
            </Badge>
          </Typography>
          
          <IconButton onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        {/* Key Metrics */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Avg Latency
              </Typography>
              <Typography variant="h6" color={currentStats.avgLatency > thresholds.latency ? 'error' : 'text.primary'}>
                {formatDuration(currentStats.avgLatency)}
              </Typography>
              {getTrend(currentStats.avgLatency, previousStats.avgLatency) === 'up' ? 
                <TrendingUp color="error" fontSize="small" /> : 
                <TrendingDown color="success" fontSize="small" />
              }
            </Box>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Error Rate
              </Typography>
              <Typography variant="h6" color={currentStats.errorRate > thresholds.errorRate ? 'error' : 'text.primary'}>
                {formatPercentage(currentStats.errorRate)}
              </Typography>
            </Box>
          </Grid>

          {showMemory && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Memory Usage
                </Typography>
                <Typography variant="h6" color={currentStats.memoryUsage > thresholds.memoryUsage ? 'warning' : 'text.primary'}>
                  {formatPercentage(currentStats.memoryUsage)}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={currentStats.memoryUsage * 100}
                  color={currentStats.memoryUsage > thresholds.memoryUsage ? 'warning' : 'primary'}
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Grid>
          )}

          <Grid size={{ xs: 6, sm: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Throughput
              </Typography>
              <Typography variant="h6">
                {currentStats.throughput.toFixed(1)} ops/s
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Alerts */}
        {showPredictiveAlerts && alerts.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Stack spacing={1}>
              {alerts.slice(0, 3).map((alert, index) => (
                <Alert 
                  key={index}
                  severity={alert.type}
                  size="small"
                  icon={alert.trend === 'up' ? <TrendingUp /> : 
                        alert.trend === 'down' ? <TrendingDown /> : undefined}
                >
                  {alert.message}
                </Alert>
              ))}
              {alerts.length > 3 && (
                <Typography variant="caption" color="text.secondary" align="center">
                  ... and {alerts.length - 3} more alerts
                </Typography>
              )}
            </Stack>
          </Box>
        )}

        {/* Detailed Metrics */}
        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />
          
          {/* Real-time Chart */}
          {enableCharts && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Real-time Performance Trends
              </Typography>
              <Box sx={{ height: 200 }}>
                <Line data={chartData} options={chartOptions} />
              </Box>
            </Box>
          )}

          {/* Storage Metrics */}
          {showStorage && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Storage Performance
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Cached fontSize="small" />
                    <Typography variant="body2">
                      Cache Hit Rate: {formatPercentage(currentStats.cacheHitRate)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DataUsage fontSize="small" />
                    <Typography variant="body2">
                      Active Operations: {currentStats.activeOperations}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* System Status */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              System Status
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                icon={tempStorage.isSaving ? <CircularProgress size={16} /> : <CloudSync />}
                label={tempStorage.isSaving ? 'Saving...' : 'Ready'}
                size="small"
                color={tempStorage.isSaving ? 'primary' : 'success'}
                variant="outlined"
              />
              
              {tempStorage.hasUnsavedChanges && (
                <Chip
                  icon={<Timer />}
                  label="Unsaved Changes"
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
              
              {tempStorage.error && (
                <Chip
                  icon={<ErrorOutline />}
                  label="Error"
                  size="small"
                  color="error"
                  variant="filled"
                />
              )}
            </Stack>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  )
}

export default EnhancedPerformanceMonitor