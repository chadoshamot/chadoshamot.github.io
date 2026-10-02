param([int]$Port = 0)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$taskLocalNode = Join-Path (Get-Location).Path '.shamot/runtime/node.exe'
$taskNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$taskNodePath = if (Test-Path -LiteralPath $taskLocalNode) { $taskLocalNode } elseif ($taskNodeCommand) { $taskNodeCommand.Source } else { throw 'Install Node.js >=22.19, then run this launcher again.' }
$env:PATH = (Split-Path -Parent $taskNodePath) + ';' + $env:PATH
$taskVersion = (& $taskNodePath -p 'process.versions.node').Split('.')
if ([int]$taskVersion[0] -lt 22 -or ([int]$taskVersion[0] -eq 22 -and [int]$taskVersion[1] -lt 19)) {
  throw 'DeepSeek Harness requires Node.js >=22.19. Install a current Node.js LTS runtime.'
}
if (-not (Test-Path -LiteralPath 'node_modules/hexo')) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' } }
$taskArgs = @('tools/bridge.cjs')
if ($Port -gt 0) { $taskArgs += @('--port', "$Port") }
& $taskNodePath @taskArgs
