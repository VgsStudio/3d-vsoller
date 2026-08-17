#!/bin/bash
# Installs pi_agent.py to run persistently on the Pi via the `pi` user's
# crontab — no systemd/sudo needed (this account has no passwordless sudo).
# Run this ON the Pi (after scp'ing pi_agent.py to ~/vsoller3d/pi_agent.py).
set -euo pipefail

AGENT_DIR="$HOME/vsoller3d"
AGENT="$AGENT_DIR/pi_agent.py"
PIDFILE="$HOME/.vsoller3d_agent.pid"

chmod 600 "$AGENT"  # contains the site's admin API key

start_agent() {
  nohup python3 "$AGENT" >> "$HOME/vsoller3d_agent.log" 2>&1 &
  echo $! > "$PIDFILE"
}

# @reboot entry: start on boot
CRON_REBOOT="@reboot sleep 20 && cd $AGENT_DIR && nohup python3 $AGENT >> $HOME/vsoller3d_agent.log 2>&1 & echo \$! > $PIDFILE"

# every-minute keepalive: restart if the pid isn't alive
CRON_KEEPALIVE="* * * * * kill -0 \$(cat $PIDFILE 2>/dev/null) 2>/dev/null || (cd $AGENT_DIR && nohup python3 $AGENT >> $HOME/vsoller3d_agent.log 2>&1 & echo \$! > $PIDFILE)"

EXISTING="$(crontab -l 2>/dev/null | grep -v "vsoller3d\|pi_agent.py" || true)"
printf '%s\n%s\n%s\n' "$EXISTING" "$CRON_REBOOT" "$CRON_KEEPALIVE" | crontab -

echo "Installed. Starting agent now..."
start_agent
sleep 2
echo "PID: $(cat "$PIDFILE")"
tail -5 "$HOME/vsoller3d_agent.log" || true
