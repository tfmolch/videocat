#! /bin/bash
ssh -tt $1@$2 "export DISPLAY=":$3" && xdotool key --window \"\$(xdotool search --onlyvisible --name vlc | head -2 | tail -1)\" shift+s"
