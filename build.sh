#!/bin/bash
set -e

echo "Building tmux-viewer..."
go build -o tmux-viewer

echo "Build successful!"
echo "Binary created: ./tmux-viewer"
echo ""
echo "To run: ./tmux-viewer"
echo "Open in browser: http://localhost:8888"
