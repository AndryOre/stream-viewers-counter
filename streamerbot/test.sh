#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}"
export PATH="$DOTNET_ROOT:$PATH"
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_NOLOGO=1

if ! command -v dotnet >/dev/null 2>&1 || ! dotnet --list-sdks | grep -q '^8\.'; then
  installer="$(mktemp)"
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o "$installer"
  bash "$installer" --channel 8.0 --install-dir "$DOTNET_ROOT"
  rm -f "$installer"
fi

dotnet build "$here/x-poller/XPoller.Compile.csproj" --nologo -v q
dotnet test "$here/tests/XPoller.Tests.csproj" "$@"
