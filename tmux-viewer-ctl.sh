#!/bin/bash

TMUX_VIEWER_DIR="$HOME/Projects/tmux-viewer"
PID_FILE="/tmp/tmux-viewer.pid"

case "$1" in
    start)
        if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
            echo "tmux-viewer is already running on http://localhost:8888"
            exit 0
        fi
        
        cd "$TMUX_VIEWER_DIR"
        nohup ./tmux-viewer > /tmp/tmux-viewer.log 2>&1 &
        echo $! > "$PID_FILE"
        
        sleep 1
        if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
            echo "tmux-viewer started on http://localhost:8888"
            echo "Logs: /tmp/tmux-viewer.log"
        else
            echo "Failed to start tmux-viewer"
            exit 1
        fi
        ;;
    
    stop)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if kill -0 $PID 2>/dev/null; then
                kill $PID
                rm "$PID_FILE"
                echo "tmux-viewer stopped"
            else
                rm "$PID_FILE"
                echo "tmux-viewer was not running"
            fi
        else
            echo "tmux-viewer is not running"
        fi
        ;;
    
    restart)
        $0 stop
        sleep 1
        $0 start
        ;;
    
    status)
        if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
            echo "tmux-viewer is running (PID: $(cat $PID_FILE))"
            echo "URL: http://localhost:8888"
        else
            echo "tmux-viewer is not running"
        fi
        ;;
    
    open)
        open http://localhost:8888
        ;;
    
    *)
        echo "Usage: $0 {start|stop|restart|status|open}"
        echo ""
        echo "Commands:"
        echo "  start   - Start tmux-viewer server"
        echo "  stop    - Stop tmux-viewer server"
        echo "  restart - Restart tmux-viewer server"
        echo "  status  - Check if server is running"
        echo "  open    - Open in browser"
        exit 1
        ;;
esac
