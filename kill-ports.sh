#!/bin/bash

# Kill processes on ports 3000-3008 and 5173-5177

echo "Killing processes on ports 3000-3008 and 5173-5177..."

for port in {3000..3008} {5173..5177}; do
    pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo "Killing process $pid on port $port"
        kill -9 $pid 2>/dev/null
    fi
done

echo "Done."
