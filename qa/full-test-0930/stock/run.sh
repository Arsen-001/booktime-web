#!/bin/bash
D=/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/stock
cp "$D/jobs/$1.mjs" "$D/q/$1.mjs"
for i in $(seq 1 1200); do [ -f "$D/q/$1.mjs.out" ] && { cat "$D/q/$1.mjs.out"; rm -f "$D/q/$1.mjs.out" "$D/q/$1.mjs.done"; exit 0; }; sleep 0.5; done
echo TIMEOUT
