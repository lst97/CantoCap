import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Badge,
  Chip,
  Paper,
  Alert,
} from '@mui/material';
import {
  FilePresent as FileIcon,
  History as HistoryIcon,
  MoreVert as MoreVertIcon,
  OpenInNew as OpenInNewIcon,
  Delete as DeleteIcon,
  Description as SrtIcon,
  Language as VttIcon,
  TextSnippet as TxtIcon,
  DataObject as JsonIcon,
  VideoFile as FcpxmlIcon,
  Warning as WarningIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';

import { useExportHistory, useExportActions } from '../../../stores/useStepStore';
import type { ExportRecord } from '../../../stores/types/StoreTypes';
import { BaseCard } from '../../elements';
import { formatRelativeTime, groupHistoryByDate } from './utils';
import { useExportHistoryFileStatus, getExportRecordStatus } from '../../../hooks/useFileStatus';

// Format-specific icons and metadata
const getFormatIcon = (format: string) => {
  switch (format.toLowerCase()) {
    case 'srt':
      return <SrtIcon fontSize='small' color='primary' />;
    case 'vtt':
      return <VttIcon fontSize='small' color='primary' />;
    case 'txt':
      return <TxtIcon fontSize='small' color='primary' />;
    case 'json':
      return <JsonIcon fontSize='small' color='primary' />;
    case 'fcpxml':
      return <FcpxmlIcon fontSize='small' color='primary' />;
    default:
      return <FileIcon fontSize='small' color='primary' />;
  }
};

const getFormatMetadata = (format: string) => {
  switch (format.toLowerCase()) {
    case 'srt':
      return { 
        name: 'SubRip Subtitle',
        compatibility: 'Universal',
        professional: false 
      };
    case 'vtt':
      return { 
        name: 'WebVTT',
        compatibility: 'HTML5 Video',
        professional: false 
      };
    case 'txt':
      return { 
        name: 'Plain Text',
        compatibility: 'Text Editors',
        professional: false 
      };
    case 'json':
      return { 
        name: 'JSON Data',
        compatibility: 'APIs/Development',
        professional: false 
      };
    case 'fcpxml':
      return { 
        name: 'Final Cut Pro XML',
        compatibility: 'Professional NLE',
        professional: true 
      };
    default:
      return { 
        name: format.toUpperCase(),
        compatibility: 'Unknown',
        professional: false 
      };
  }
};

export const ExportHistory: React.FC = () => {
  const history = useExportHistory();
  const { removeFromHistory, clearHistory } = useExportActions();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedItem, setSelectedItem] = useState<ExportRecord | null>(null);
  
  // Check file existence for all export records
  const fileStatusMap = useExportHistoryFileStatus(history);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const groupedHistory = useMemo(() => {
    // Convert ExportRecord to format expected by groupHistoryByDate
    const historyWithTimestamp = history.map((item) => ({
      ...item,
      timestamp: new Date(item.exportedAt).getTime(),
    }));
    return groupHistoryByDate(historyWithTimestamp);
  }, [history]);

  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, item: ExportRecord) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedItem(item);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
    setSelectedItem(null);
  }, []);

  const handleOpenFile = useCallback(async () => {
    if (!selectedItem) return;

    try {
      // Use electron API to open file with system default app
      await window.electronAPI.openFileDialog({
        defaultPath: selectedItem.outputPath,
      });
    } catch {
      // Silent fail - file may not exist or system may not have default app
      // TODO: Show user-friendly error message if needed
    }

    handleMenuClose();
  }, [selectedItem, handleMenuClose]);

  const handleDeleteItem = useCallback(() => {
    if (!selectedItem) return;

    // Find the item in history by matching properties since we need the exact item
    const itemIndex = history.findIndex(
      (item) =>
        item.outputPath === selectedItem.outputPath && item.exportedAt === selectedItem.exportedAt
    );
    if (itemIndex >= 0) {
      removeFromHistory(itemIndex);
    }
    handleMenuClose();
  }, [selectedItem, history, removeFromHistory, handleMenuClose]);

  if (history.length === 0) {
    return (
      <BaseCard variant='subtle' sx={{ padding: 2 }}>
        <Typography variant='h6' sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon color='primary' />
          Export History
        </Typography>

        <Box
          sx={{
            p: 3,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <HistoryIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
          <Typography variant='body2'>
            No exports yet. Your export history will appear here.
          </Typography>
        </Box>
      </BaseCard>
    );
  }

  return (
    <BaseCard variant='subtle' role='region' aria-labelledby='history-title' sx={{ padding: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography
          id='history-title'
          variant='h6'
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <HistoryIcon color='primary' />
          Export History
          <Badge badgeContent={history.length} color='primary' />
        </Typography>

        {history.length > 0 && (
          <Tooltip title='Clear all history'>
            <IconButton size='small' onClick={clearHistory}>
              <DeleteIcon fontSize='small' />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
        {Object.entries(groupedHistory).map(([groupKey, items]) => (
          <Box key={groupKey} sx={{ mb: 2 }}>
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ fontWeight: 600, px: 1, mb: 1, display: 'block' }}
            >
              {groupKey}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {items.map((item, index) => (
                <Paper
                  key={`${item.outputPath}-${item.exportedAt}-${index}`}
                  sx={{
                    p: 2,
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      transform: 'translateY(-1px)',
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}
                    >
                      {getFormatIcon(item.format)}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {(() => {
                          const fileStatus = getExportRecordStatus(item, fileStatusMap);
                          const fileName = item.outputPath.split('/').pop() || item.outputPath;
                          const tooltipTitle = fileStatus.exists 
                            ? item.outputPath 
                            : `${item.outputPath} (File no longer exists)`;
                          
                          return (
                            <Tooltip title={tooltipTitle}>
                              <Typography
                                variant='body2'
                                noWrap
                                sx={{
                                  fontWeight: 500,
                                  fontSize: '0.875rem',
                                  ...((!fileStatus.exists) && {
                                    color: 'text.disabled',
                                    textDecoration: 'line-through',
                                    opacity: 0.6,
                                  }),
                                }}
                              >
                                {fileName}
                              </Typography>
                            </Tooltip>
                          );
                        })()}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          {(() => {
                            const formatMeta = getFormatMetadata(item.format);
                            return (
                              <Tooltip title={`${formatMeta.name} - ${formatMeta.compatibility}`}>
                                <Chip
                                  label={item.format.toUpperCase()}
                                  size='small'
                                  variant={formatMeta.professional ? 'filled' : 'outlined'}
                                  color={formatMeta.professional ? 'primary' : 'default'}
                                  sx={{
                                    fontSize: '0.625rem',
                                    height: 18,
                                    '& .MuiChip-label': { px: 0.75 },
                                    ...(formatMeta.professional && {
                                      backgroundColor: 'rgba(25, 118, 210, 0.15)',
                                      color: '#1976d2',
                                      border: '1px solid rgba(25, 118, 210, 0.5)',
                                      fontWeight: 600,
                                    }),
                                  }}
                                />
                              </Tooltip>
                            );
                          })()}
                          {getFormatMetadata(item.format).professional && (
                            <Chip
                              label='PRO'
                              size='small'
                              sx={{
                                fontSize: '0.5rem',
                                height: 14,
                                minWidth: 'auto',
                                backgroundColor: 'rgba(76, 175, 80, 0.15)',
                                color: '#4caf50',
                                border: '1px solid rgba(76, 175, 80, 0.5)',
                                fontWeight: 700,
                                '& .MuiChip-label': { px: 0.5 },
                              }}
                            />
                          )}
                          <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.7rem' }}>
                            {formatFileSize(item.fileSize ?? 0)} •{' '}
                            {formatRelativeTime(
                              item.timestamp ?? new Date(item.exportedAt).getTime()
                            )}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    <IconButton
                      size='small'
                      onClick={(e) => handleMenuOpen(e, item)}
                      aria-label={`Options for ${item.outputPath.split('/').pop() || item.outputPath}`}
                      sx={{ ml: 1 }}
                    >
                      <MoreVertIcon fontSize='small' />
                    </IconButton>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {(() => {
          const fileStatus = selectedItem 
            ? getExportRecordStatus(selectedItem, fileStatusMap) 
            : { exists: true, isChecking: false };
          
          return (
            <MenuItem 
              onClick={handleOpenFile} 
              disabled={!fileStatus.exists}
            >
              <ListItemIcon>
                {fileStatus.exists ? (
                  <OpenInNewIcon fontSize='small' />
                ) : (
                  <ErrorIcon fontSize='small' color='disabled' />
                )}
              </ListItemIcon>
              <ListItemText>
                {fileStatus.exists ? 'Open File' : 'File Removed'}
              </ListItemText>
            </MenuItem>
          );
        })()}
        <MenuItem onClick={handleDeleteItem}>
          <ListItemIcon>
            <DeleteIcon fontSize='small' />
          </ListItemIcon>
          <ListItemText>Remove from History</ListItemText>
        </MenuItem>
      </Menu>
    </BaseCard>
  );
};
