#!/bin/bash
# usage: run.sh file.js  |  echo code | run.sh
if [ -n "$1" ]; then curl -s --max-time 590 --data-binary @"$1" localhost:4791; else curl -s --max-time 590 --data-binary @- localhost:4791; fi
