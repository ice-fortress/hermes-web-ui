---
name: Windows Compatibility
description: Windows-specific compatibility fixes for cross-platform Node.js development
type: feedback
---

## Windows Compatibility Rules

### 1. Environment Variables in npm Scripts
**Problem:** Unix-style environment variable syntax (`VAR=value command`) doesn't work on Windows

**Fix:** Use nodemon.json configuration file instead of command-line arguments
```json
{
  "env": {
    "TS_NODE_PROJECT": "packages/server/tsconfig.json"
  }
}
```

**Why:** Windows cmd.exe doesn't support `VAR=value` syntax, causing "'TS_NODE_PROJECT' is not recognized" error

**How to apply:** 
- Move environment variables from package.json scripts to nodemon.json
- Use `env` field in nodemon.json for cross-platform compatibility
- Keep package.json scripts simple: just `"nodemon"`

### 2. File Permission Modes in fs.writeFile
**Problem:** `{ mode: 0o600 }` is Unix-specific and can cause issues on Windows

**Fix:** Check platform before setting file permissions
```typescript
const options: any = {}
if (process.platform !== 'win32') {
  options.mode = 0o600
}
await writeFile(TOKEN_FILE, token + '\n', options)
```

**Why:** Windows doesn't support Unix file permission modes (0o600 = owner read/write only). While Node.js ignores this on Windows, explicit platform detection is more robust and portable.

**How to apply:**
- Always check `process.platform !== 'win32'` before setting file modes
- Use empty options object on Windows
- Maintain Unix security on Linux/macOS systems

### 3. Process Killing and Signals
**Problem:** Windows doesn't support POSIX process control features

**Fix:** Check platform before using process control features
```typescript
if (process.platform === 'win32') {
  try { process.kill(pid) } catch { }
} else {
  try { process.kill(-pid, 'SIGTERM') } catch {  // Unix-only: kill process group
    try { process.kill(pid, 'SIGTERM') } catch { }
  }
}
```

**Why:** 
- Windows doesn't support negative PIDs (process groups)
- Windows doesn't support POSIX signals like `SIGTERM`
- `process.kill(pid)` without signal works on both platforms

**How to apply:**
- Always check `process.platform === 'win32'` before using process groups or signals
- Use `process.kill(pid)` without signal parameter on Windows
- Use `process.kill(-pid, 'SIGTERM')` for process groups on Unix only

### 4. Home Directory Detection
**Problem:** `process.env.HOME` doesn't exist on Windows

**Fix:** Use `homedir()` from 'os' module instead of environment variables
```typescript
// ❌ Wrong (only works on Unix)
cwd: process.env.HOME || undefined

// ✅ Correct (cross-platform)
import { homedir } from 'os'
cwd: homedir()
```

**Why:** 
- Windows uses `USERPROFILE` or `HOMEDRIVE` + `HOMEPATH` instead of `HOME`
- `homedir()` automatically handles all platforms correctly

**How to apply:**
- Always import `homedir` from 'os' module
- Replace `process.env.HOME` with `homedir()`
- Never hardcode Unix-style paths or environment variables

### 5. Hermes Data Directory Detection
**Problem:** Hermes data directory location varies by installation type:
- **Windows Native**: `%LOCALAPPDATA%\hermes` (e.g., `C:\Users\Administrator\AppData\Local\hermes`)
- **Linux/macOS/WSL2**: `~/.hermes` (e.g., `/home/user/.hermes`)
- **User Custom**: `HERMES_HOME` environment variable

**Fix:** Use intelligent path detection with fallback
```typescript
// ❌ Wrong (assumes Unix location)
const HERMES_BASE = resolve(homedir(), '.hermes')

// ✅ Correct (cross-platform detection)
import { detectHermesHome } from './hermes-path'
const HERMES_BASE = detectHermesHome()

// Shared utility function (hermes-path.ts):
export function detectHermesHome(): string {
  // 1. User custom HERMES_HOME (highest priority)
  if (process.env.HERMES_HOME) {
    return resolve(process.env.HERMES_HOME)
  }

  // 2. Windows native: check %LOCALAPPDATA%\hermes
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA
    if (localAppData) {
      const windowsPath = join(localAppData, 'hermes')
      // Verify by checking config.yaml exists
      if (existsSync(join(windowsPath, 'config.yaml'))) {
        return windowsPath
      }
    }
  }

  // 3. Default: ~/.hermes (Linux/macOS/WSL2)
  return resolve(homedir(), '.hermes')
}
```

**Why:**
- Windows native Hermes installer uses `%LOCALAPPDATA%\hermes`, not `~/.hermes`
- Hardcoded `~/.hermes` fails to find user's actual Hermes installation
- Must check `config.yaml` existence to verify valid Hermes installation
- WSL2 and Unix systems still use `~/.hermes`

**How to apply:**
- Always use `detectHermesHome()` from shared `hermes-path.ts` utility
- Never hardcode `resolve(homedir(), '.hermes')` in production code
- Test on actual Windows native Hermes installations

### 6. Hermes CLI Binary Detection
**Problem:** Hermes CLI binary location varies by platform:
- **Windows Native**: `%LOCALAPPDATA%\hermes\hermes-agent\venv\Scripts\hermes.exe`
- **Linux/macOS**: `hermes` command (in PATH)
- **WSL2**: `hermes` command (in PATH)
- **User Custom**: `HERMES_BIN` environment variable

**Fix:** Use intelligent binary path detection
```typescript
// ❌ Wrong (assumes 'hermes' is in PATH)
const HERMES_BIN = 'hermes'

// ✅ Correct (cross-platform detection)
function resolveHermesBin(): string {
  // 1. User custom HERMES_BIN (highest priority)
  const envBin = process.env.HERMES_BIN?.trim()
  if (envBin) return envBin

  // 2. Windows native: check venv/Scripts/hermes.exe
  if (process.platform === 'win32') {
    const hermesHome = detectHermesHome()
    const agentDir = join(hermesHome, 'hermes-agent')
    const venvExe = join(agentDir, 'venv', 'Scripts', 'hermes.exe')
    if (existsSync(venvExe)) {
      return venvExe
    }
    // Fallback: .venv/Scripts/hermes.exe (some installations)
    const altVenvExe = join(agentDir, '.venv', 'Scripts', 'hermes.exe')
    if (existsSync(altVenvExe)) {
      return altVenvExe
    }
  }

  // 3. Default: 'hermes' command (Linux/macOS/WSL2)
  return 'hermes'
}
```

**Why:**
- Windows native Hermes installer does NOT add `hermes.exe` to system PATH
- Hardcoded `'hermes'` command fails on Windows native installations
- Must check both `venv/Scripts/hermes.exe` and `.venv/Scripts/hermes.exe` paths
- Linux/macOS/WSL2 installations have `hermes` in PATH

**How to apply:**
- Always use `resolveHermesBin()` function before calling Hermes CLI
- Never assume `'hermes'` command exists without platform detection
- Test actual CLI execution on Windows native installations

### 7. Gateway Startup Mode & Stale Lock Files
**Problem:** Windows native Hermes gateway has special startup requirements and lock file issues:
- **Windows Native**: Should use `gateway run --replace` mode, not `gateway start/stop`
- **Stale Lock Files**: When processes crash, lock files aren't cleaned up, preventing new starts
- **Init System Mismatch**: Code detects `'windows-service'` but should use `run` mode for web-ui

**Fix:** Force Windows to use `gateway run` mode and clean stale lock files
```typescript
// ❌ Wrong (assumes systemd/launchd for Windows)
const needsRunMode = !['systemd', 'launchd', 'windows-service'].includes(initSystem)

// ✅ Correct (Windows special handling)
const needsRunMode = process.platform === 'win32' ? true : !['systemd', 'launchd'].includes(initSystem)

// Before starting gateway, clean stale lock files on Windows
if (process.platform === 'win32') {
  const lockPath = join(hermesHome, 'gateway.lock')
  if (existsSync(lockPath)) {
    try {
      const content = readFileSync(lockPath, 'utf-8').trim()
      const lockData = JSON.parse(content)
      const pid = lockData.pid

      if (pid && !isProcessAlive(pid)) {
        // Clean stale lock file using PowerShell
        execSync(`powershell.exe -Command "Remove-Item -Path '${lockPath}' -Force"`, { stdio: 'ignore' })
        logger.info('Successfully removed stale lock file')
      }
    } catch (err) {
      logger.debug('Failed to check/clean lock file: %s', err)
    }
  }
}
```

**Why:**
- Windows `gateway start/stop` uses Scheduled Tasks, not suitable for web-ui process management
- `gateway run --replace` automatically handles process replacement and lock files
- Windows processes can crash without cleaning lock files, requiring manual cleanup
- PowerShell `Remove-Item -Force` can delete locked files that Unix `rm` cannot

**How to apply:**
- Always force Windows to use `gateway run --replace` mode for web-ui
- Check and clean stale lock files before starting gateway on Windows
- Use PowerShell for file operations on Windows when Unix tools fail
- Never assume lock files are clean on Windows

### 6. Testing on Windows
**Why important:** Windows has different:
- Command-line syntax (cmd.exe vs bash)
- File system behavior
- Path handling
- Environment variable setting
- Process control (no signals, no process groups)
- Home directory detection
- **Hermes data directory location** (Native vs WSL2)

**How to apply:**
- Always test npm scripts on Windows before merging
- Use cross-platform tools (nodemon.json instead of env vars in scripts)
- Avoid shell-specific features in package.json scripts
- Test process management code on Windows
- Verify all file system paths work on Windows
- Test on actual Windows native Hermes installation (not just WSL2)

## Branch: fix/windows-compatibility
Created 2026-05-11 to address Windows development environment issues.

## Files Modified
1. `nodemon.json` - Added for cross-platform environment variable handling
2. `package.json` - Simplified dev:server script
3. `packages/server/src/services/auth.ts` - Platform-specific file permissions
4. `packages/server/src/services/hermes/gateway-manager.ts` - **CRITICAL FIXES**: Platform-specific process killing, Hermes path detection, Windows gateway run mode, Stale lock file cleanup
5. `packages/server/src/routes/hermes/terminal.ts` - Use `homedir()` instead of `process.env.HOME`
6. `packages/server/src/services/hermes/plugins.ts` - Use `homedir()` instead of `process.env.HOME`
7. `packages/server/src/services/hermes/hermes-path.ts` - NEW: Shared cross-platform Hermes path detection utility
8. `packages/server/src/services/hermes/hermes-profile.ts` - Use `detectHermesHome()`
9. `packages/server/src/services/hermes/model-context.ts` - Use `detectHermesHome()`
10. `packages/server/src/services/hermes/session-sync.ts` - Use `detectHermesHome()`
11. `packages/server/src/services/hermes/profile-credentials.ts` - Use `detectHermesHome()`
12. `packages/server/src/services/hermes/hermes-cli.ts` - **CRITICAL FIX**: Use `resolveHermesBin()` to find Windows native hermes.exe

## Critical Windows Gateway Issues Fixed
1. **Stale Lock Files**: Added Windows-specific cleanup using PowerShell
2. **Wrong Startup Mode**: Force Windows to use `gateway run --replace` instead of `gateway start`
3. **Binary Path Detection**: Automatically find `hermes.exe` in `venv/Scripts/`
4. **Process Management**: Windows-specific signal and process group handling

## Key Discovery
Windows native Hermes installation uses `%LOCALAPPDATA%\hermes` (e.g., `C:\Users\Administrator\AppData\Local\hermes`), **NOT** `~/.hermes`. This is documented in [Hermes Windows Native Guide](https://hermes-agent.nousresearch.com/docs/user-guide/windows-native) but the web-ui code was hardcoded to Unix paths.

## Reference
- Hermes Windows Native Guide: https://hermes-agent.nousresearch.com/docs/user-guide/windows-native
- Data dir variations:
  - Windows Native: `%LOCALAPPDATA%\hermes`
  - Linux/macOS/WSL2: `~/.hermes`
  - User custom: `HERMES_HOME` environment variable
