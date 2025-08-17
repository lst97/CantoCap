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
} from '@mui/material';
import {
  FilePresent as FileIcon,
  History as HistoryIcon,
  MoreVert as MoreVertIcon,
  OpenInNew as OpenInNewIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

import { useExportHistory, useExportActions } from '../../../stores/useStepStore';
import type { ExportRecord } from '../../../stores/types/StoreTypes';
import { BaseCard } from '../../elements';
import { formatRelativeTime, groupHistoryByDate } from './utils';

export const ExportHistory: React.FC = () => {
  const history = useExportHistory();
  const { removeFromHistory, clearHistory } = useExportActions();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedItem, setSelectedItem] = useState<ExportRecord | null>(null);

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
                      <FileIcon fontSize='small' color='primary' />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Tooltip title={item.outputPath}>
                          <Typography
                            variant='body2'
                            noWrap
                            sx={{
                              fontWeight: 500,
                              fontSize: '0.875rem',
                            }}
                          >
                            {item.outputPath.split('/').pop() || item.outputPath}
                          </Typography>
                        </Tooltip>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Chip
                            label={item.format.toUpperCase()}
                            size='small'
                            variant='outlined'
                            sx={{
                              fontSize: '0.7rem',
                              height: 20,
                              '& .MuiChip-label': { px: 1 },
                            }}
                          />
                          <Typography variant='caption' color='text.secondary'>
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
        <MenuItem onClick={handleOpenFile}>
          <ListItemIcon>
            <OpenInNewIcon fontSize='small' />
          </ListItemIcon>
          <ListItemText>Open File</ListItemText>
        </MenuItem>
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
