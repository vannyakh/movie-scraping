import { Menu, Tray, nativeImage } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { createMainWindow } from '../windows/create-main-window'
import { getMainWindow, setMainWindow } from '../ipc/context'

type QuickTask = 'open-dashboard' | 'open-projects' | 'open-task-jobs' | 'open-settings'

let tray: Tray | null = null

const FALLBACK_TRAY_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACTSURBVHgBpZKBCYAgEEV/TeAIjuIIbdQIuUGt0CS1gW1iZ2jIVaTnhw+Cvs8/OYDJA4Y8kR3ZR2/kmazxJbpUEfQ/Dm/UG7wVwHkjlQdMFfDdJMFaACebnjJGyDWgcnZu1/lrCrl6NCoEHJBrDwEr5NrT6ko/UV8xdLAC2N49mlc5CylpYh8wCwqrvbBGLoKGvz8Bfq0QPWEUo/EAAAAASUVORK5CYII='

function ensureMainWindow() {
  let win = getMainWindow()
  if (!win || win.isDestroyed()) {
    win = createMainWindow()
    setMainWindow(win)
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return win
}

function sendQuickTask(task: QuickTask): void {
  const win = ensureMainWindow()
  win.webContents.send('tray:quickTask', task)
}

function buildTrayMenu(): Menu {
  const items: MenuItemConstructorOptions[] = [
    {
      label: 'Show App',
      click: () => {
        ensureMainWindow()
      },
    },
    {
      label: 'Hide App',
      click: () => {
        const win = getMainWindow()
        if (win && !win.isDestroyed()) {
          win.hide()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quick Tasks',
      submenu: [
        {
          label: 'Open Dashboard',
          click: () => sendQuickTask('open-dashboard'),
        },
        {
          label: 'Open Projects',
          click: () => sendQuickTask('open-projects'),
        },
        {
          label: 'Open Task Jobs',
          click: () => sendQuickTask('open-task-jobs'),
        },
        {
          label: 'Open Settings',
          click: () => sendQuickTask('open-settings'),
        },
      ],
    },
    { type: 'separator' },
    { role: 'quit' },
  ]

  return Menu.buildFromTemplate(items)
}

export function setupTray(): void {
  if (tray) return

  const icon = nativeImage.createFromDataURL(FALLBACK_TRAY_ICON)
  tray = new Tray(icon)
  tray.setToolTip('Movie Scraping')

  const contextMenu = buildTrayMenu()
  tray.setContextMenu(contextMenu)

  const showMenu = () => {
    if (!tray) return
    tray.popUpContextMenu(contextMenu)
  }

  tray.on('click', showMenu)
  tray.on('right-click', showMenu)
}

export function teardownTray(): void {
  if (!tray) return
  tray.destroy()
  tray = null
}
