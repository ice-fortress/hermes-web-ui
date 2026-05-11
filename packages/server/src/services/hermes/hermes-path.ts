/**
 * Hermes 路径检测工具 - 跨平台兼容
 *
 * Hermes 数据目录在不同平台上的位置：
 * - Windows 原生安装: %LOCALAPPDATA%\hermes
 * - Linux/macOS/WSL2: ~/.hermes
 * - 用户自定义: HERMES_HOME 环境变量
 */

import { resolve, join } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'

/**
 * 智能检测 Hermes 数据目录
 *
 * 检测优先级：
 * 1. HERMES_HOME 环境变量（用户自定义）
 * 2. Windows: %LOCALAPPDATA%\hermes（原生安装）
 * 3. 默认: ~/.hermes（Linux/macOS/WSL2）
 *
 * @returns Hermes 数据目录的绝对路径
 */
export function detectHermesHome(): string {
  // 1. 用户自定义的环境变量（最高优先级）
  if (process.env.HERMES_HOME) {
    return resolve(process.env.HERMES_HOME)
  }

  // 2. Windows 原生安装：检查 %LOCALAPPDATA%\hermes
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA
    if (localAppData) {
      const windowsPath = join(localAppData, 'hermes')
      // 检查是否存在 config.yaml 来验证这是有效的 Hermes 安装
      if (existsSync(join(windowsPath, 'config.yaml'))) {
        return windowsPath
      }
    }
  }

  // 3. 默认路径：~/.hermes（Linux/macOS/WSL2）
  return resolve(homedir(), '.hermes')
}

/**
 * 获取 Hermes CLI 二进制文件路径
 * @param customBin 自定义的 hermes 二进制路径
 * @returns hermes 命令名称或路径
 */
export function getHermesBin(customBin?: string): string {
  if (customBin?.trim()) return customBin.trim()
  if (process.env.HERMES_BIN?.trim()) return process.env.HERMES_BIN.trim()

  // Windows 原生安装特殊处理：检查 venv/Scripts/hermes.exe
  if (process.platform === 'win32') {
    const hermesHome = detectHermesHome()
    const agentDir = join(hermesHome, 'hermes-agent')
    const venvExe = join(agentDir, 'venv', 'Scripts', 'hermes.exe')
    if (existsSync(venvExe)) {
      return venvExe
    }
    // 备选：检查 .venv/Scripts/hermes.exe（某些安装方式）
    const altVenvExe = join(agentDir, '.venv', 'Scripts', 'hermes.exe')
    if (existsSync(altVenvExe)) {
      return altVenvExe
    }
  }

  // 默认：使用 'hermes' 命令（假设在 PATH 中）
  return 'hermes'
}
