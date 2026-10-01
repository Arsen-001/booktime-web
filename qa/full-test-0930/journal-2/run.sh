#!/bin/bash
# run.sh file.mjs — отдать команду раннеру и дождаться .out
D=/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/cmd
n=$(date +%s%N); cp "$1" $D/$n.mjs
for i in $(seq 1 1100); do [ -f $D/$n.out ] && { cat $D/$n.out; exit 0; }; sleep 0.5; done; echo TIMEOUT
