#!/usr/bin/env bash

command=""
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        command="inkscape"
elif [[ "$OSTYPE" == "darwin"* ]]; then
        command="/Applications/Inkscape.app/Contents/MacOS/inkscape"
else
        echo "Unsupported OS"
        exit 1
fi


function convert() {
  input="$1"
  base="${input%.*}"
  size="$2"
  output="out/${base}-${size}x${size}.png"
  mkdir -p out

  $command -w "$size" -h "$size" "$input" -o "$output"
}

convert "angle-down.svg" 40
convert "angle-up.svg" 40
convert "angle-left.svg" 40
convert "angle-right.svg" 40
convert "bluetooth-alt.svg" 20
convert "check.svg" 40
convert "coffee-bean.svg" 80
convert "equality.svg" 40
convert "horizontal-rule.svg" 40
convert "menu-dots.svg" 40
convert "minus-small.svg" 40
convert "mug-hot-alt.svg" 80
convert "mug-hot-alt.svg" 40
convert "pause.svg" 40
convert "play.svg" 40
convert "plus-small.svg" 40
convert "power.svg" 40
convert "raindrops.svg" 80
convert "raindrops.svg" 40
convert "wifi.svg" 20
convert "wind.svg" 80
convert "wind.svg" 40
convert "clock.svg" 40
convert "thermometer-half.svg" 40
convert "refresh.svg" 20
convert "refresh.svg" 40
convert "tap.svg" 60
convert "settings.svg" 40
convert "tachometer-fast.svg" 40
