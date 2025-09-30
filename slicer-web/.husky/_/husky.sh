#!/bin/sh
if [ -z "$husky_skip_init" ]; then
  if [ -f ~/.huskyrc ]; then
    . ~/.huskyrc
  fi
fi
