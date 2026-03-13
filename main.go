package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"tmux-viewer/tmux"
)

func handleSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := tmux.ListSessions()
	if err != nil {
		http.Error(w, fmt.Sprintf("Error listing sessions: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

func handleSession(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid session path", http.StatusBadRequest)
		return
	}
	
	sessionID := parts[3]
	session, err := tmux.GetSession(sessionID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error getting session: %v", err), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session)
}

func handlePaneContent(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid pane path", http.StatusBadRequest)
		return
	}
	
	paneID := parts[3]
	
	lines := 50
	if linesParam := r.URL.Query().Get("lines"); linesParam != "" {
		if l, err := strconv.Atoi(linesParam); err == nil && l > 0 {
			lines = l
		}
	}
	
	useColors := r.URL.Query().Get("colors") != "false"
	
	var content *tmux.PaneContent
	var err error
	
	if useColors {
		content, err = tmux.CapturePaneWithColors(paneID, lines)
	} else {
		content, err = tmux.CapturePane(paneID, lines)
	}
	
	if err != nil {
		http.Error(w, fmt.Sprintf("Error capturing pane: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(content)
}

func handleDeleteSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid session path", http.StatusBadRequest)
		return
	}
	
	sessionID := parts[3]
	if err := tmux.KillSession(sessionID); err != nil {
		http.Error(w, fmt.Sprintf("Error killing session: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("Session %s killed", sessionID),
	})
}

func handleRenameSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 5 {
		http.Error(w, "Invalid session path", http.StatusBadRequest)
		return
	}
	
	sessionID := parts[3]
	
	var reqBody struct {
		NewName string `json:"new_name"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	if reqBody.NewName == "" {
		http.Error(w, "New name cannot be empty", http.StatusBadRequest)
		return
	}
	
	if err := tmux.RenameSession(sessionID, reqBody.NewName); err != nil {
		http.Error(w, fmt.Sprintf("Error renaming session: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":   "success",
		"message":  fmt.Sprintf("Session renamed to %s", reqBody.NewName),
		"new_name": reqBody.NewName,
	})
}

func handleOpenITerm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid session path", http.StatusBadRequest)
		return
	}
	
	sessionName := parts[3]
	
	script := fmt.Sprintf(`
tell application "iTerm"
	activate
	tell current window
		create tab with default profile
		tell current session
			write text "tmux attach -t %s"
		end tell
	end tell
end tell
`, sessionName)
	
	cmd := exec.Command("osascript", "-e", script)
	if err := cmd.Run(); err != nil {
		http.Error(w, fmt.Sprintf("Error opening iTerm: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("Opened session %s in iTerm2", sessionName),
	})
}

func setupRoutes() *http.ServeMux {
	mux := http.NewServeMux()
	
	mux.HandleFunc("/api/sessions", handleSessions)
	mux.HandleFunc("/api/session/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodDelete {
			handleDeleteSession(w, r)
		} else if r.Method == http.MethodGet {
			handleSession(w, r)
		} else if r.Method == http.MethodPut && strings.Contains(r.URL.Path, "/rename") {
			handleRenameSession(w, r)
		} else if r.Method == http.MethodPost && strings.Contains(r.URL.Path, "/open-iterm") {
			handleOpenITerm(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/pane/", handlePaneContent)
	mux.HandleFunc("/ws", handleWebSocket)
	
	fs := http.FileServer(http.Dir("./web"))
	mux.Handle("/", fs)
	
	return mux
}

func main() {
	startWatcher()
	
	mux := setupRoutes()
	
	addr := ":8888"
	log.Printf("Starting tmux-viewer on http://localhost%s\n", addr)
	
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
