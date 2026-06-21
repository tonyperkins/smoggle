#!/bin/sh
#
# smoggle-macos-compat-report.sh — READ-ONLY macOS diagnostic for Smoggle.
#
# WHAT IT DOES
#   Smoggle toggles macOS background services and reads their on/off state with
#   small shell commands. Apple occasionally changes a command's output between
#   macOS versions, which can make a toggle mis-report. This script collects how
#   those settings report their state on THIS macOS version so the detection can
#   be verified/updated for versions other than the one Smoggle was built on.
#
# WHAT IT DOES NOT DO
#   It does NOT change any setting. Every command below only *reads* state.
#   No data leaves your machine — output is printed and saved to a local file
#   that you choose to send back. You're welcome to read the whole script first.
#
# HOW TO RUN
#   1. Save this file (e.g. to your Downloads).
#   2. In Terminal:   sh ~/Downloads/macos-compat-report.sh
#   3. It will ask for your password ONCE (for a few admin-only reads). If you
#      skip that, the script just omits those lines.
#   4. Send back the file it saves to your Desktop.
#
set -u

OUT="$HOME/Desktop/smoggle-macos-report.txt"

# Print a command and its (merged) output, labeled. Never aborts on error.
run() {
  printf '$ %s\n' "$*"
  eval "$@" 2>&1
  printf '\n'
}

{
  printf '======================================================================\n'
  printf ' Smoggle macOS compatibility report\n'
  printf ' Generated: %s\n' "$(date)"
  printf '======================================================================\n\n'

  printf '##### SYSTEM #####\n\n'
  run sw_vers
  run 'sysctl -n machdep.cpu.brand_string'
  run "system_profiler SPHardwareDataType 2>/dev/null | grep -E 'Model Name|Model Identifier|Chip|Memory'"
  run 'command -v mdutil tmutil pmset softwareupdate caffeinate 2>/dev/null'

  printf '##### USER-DOMAIN SETTINGS (no admin needed) #####\n\n'
  # photos_analysis
  run "defaults read com.apple.photos PKPhotoAnalysisEnabled"
  # icloud_sync
  run "defaults read com.apple.bird.plist syncedDesktop"
  # siri
  run "defaults read com.apple.assistant.support 'Assistant Enabled'"
  # auto_updates (Smoggle reads this key; confirm it is readable without sudo)
  run "defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled"
  # handoff
  run "defaults read com.apple.coreduet.support ActivityContinuationEnabled"
  # mail_fetch
  run "defaults read com.apple.mail InboxViewerAttributes"
  # analytics
  run "defaults read com.apple.SubmitDiagInfo AutoSubmit"
  # airplay_receiver
  run "defaults read com.apple.airplay AirPlayReceiverEnabled"
  # app_nap
  run "defaults read NSGlobalDomain NSAppSleepDisabled"
  # notification_center
  run "defaults read com.apple.notificationcenterui doNotDisturb"
  # power_nap + high_power_mode live in pmset; show the full block and the lines
  run "pmset -g"
  run "pmset -g | grep -i nap"
  run "pmset -g | grep -i powermode"
  # ollama (process check — not version-fragile, included for completeness)
  run 'pgrep -x ollama >/dev/null 2>&1 && echo "ollama: running" || echo "ollama: not running"'

  printf '##### REFERENCE: human-readable wording (drift check) #####\n\n'
  # Smoggle no longer parses this wording, but capturing it shows whether Apple
  # changed phrasing again on this version (this is what broke auto_updates).
  run "softwareupdate --schedule"

  printf '##### SYSTEM SETTINGS (administrator password required) #####\n\n'
  printf 'The following are read-only but need admin rights.\n\n'
  if sudo -v 2>/dev/null; then
    # spotlight
    run "sudo mdutil -a -s"
    # timemachine
    run "sudo defaults read /Library/Preferences/com.apple.TimeMachine AutoBackup"
    # location_services
    run "sudo defaults read /var/db/locationd/Library/Preferences/ByHost/com.apple.locationd LocationServicesEnabled"
    # mdns
    run "sudo defaults read /Library/Preferences/com.apple.mDNSResponder.plist NoMulticastAdvertisements"
  else
    printf '(sudo not granted — system-level reads skipped)\n\n'
  fi

  printf '##### END OF REPORT #####\n'
} | tee "$OUT"

printf '\n----------------------------------------------------------------------\n'
printf 'Saved to: %s\n' "$OUT"
printf 'Please send that file back. Thank you!\n'
