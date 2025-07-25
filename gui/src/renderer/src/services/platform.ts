export type Platform = 'windows' | 'macos' | 'linux'

let cachedPlatform: Platform | null = null

export const getPlatform = async (): Promise<Platform> => {
  if (cachedPlatform) return cachedPlatform
  
  try {
    const platform = await window.cantocapAPI.getPlatform()
    switch (platform) {
      case 'darwin':
        cachedPlatform = 'macos'
        break
      case 'win32':
        cachedPlatform = 'windows'
        break
      default:
        cachedPlatform = 'linux'
    }
    return cachedPlatform
  } catch (error) {
    // Fallback to user agent detection
    const userAgent = navigator.userAgent.toLowerCase()
    if (userAgent.includes('mac')) return 'macos'
    if (userAgent.includes('win')) return 'windows'
    return 'linux'
  }
}

export const isMac = async (): Promise<boolean> => (await getPlatform()) === 'macos'
export const isWindows = async (): Promise<boolean> => (await getPlatform()) === 'windows'
export const isLinux = async (): Promise<boolean> => (await getPlatform()) === 'linux'

// Window control actions connected to Electron IPC
export const windowControls = {
  minimize: () => {
    try {
      window.cantocapAPI.minimizeWindow()
    } catch (error) {
      console.error('Failed to minimize window:', error)
    }
  },
  maximize: () => {
    try {
      window.cantocapAPI.maximizeWindow()
    } catch (error) {
      console.error('Failed to maximize window:', error)
    }
  },
  close: () => {
    try {
      window.cantocapAPI.closeWindow()
    } catch (error) {
      console.error('Failed to close window:', error)
    }
  }
}