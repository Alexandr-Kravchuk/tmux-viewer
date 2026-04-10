package tmux

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

type Session struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Windows int      `json:"windows"`
	Panes   []Pane   `json:"panes"`
}

type Window struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Active bool   `json:"active"`
}

type Pane struct {
	ID      string `json:"id"`
	Active  bool   `json:"active"`
	Width   int    `json:"width"`
	Height  int    `json:"height"`
	Session string `json:"session"`
	Window  string `json:"window"`
}

func ListSessions() ([]Session, error) {
	cmd := exec.Command("tmux", "list-sessions", "-F", "#{session_id}|#{session_name}|#{session_windows}")
	var out, stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		msg := strings.ToLower(stderr.String())
		if strings.Contains(msg, "no server running") || strings.Contains(msg, "no sessions") || out.Len() == 0 {
			return []Session{}, nil
		}
		return nil, fmt.Errorf("failed to list sessions: %w", err)
	}

	var sessions []Session
	lines := strings.Split(strings.TrimSpace(out.String()), "\n")
	
	for _, line := range lines {
		if line == "" {
			continue
		}
		
		parts := strings.Split(line, "|")
		if len(parts) != 3 {
			continue
		}
		
		session := Session{
			ID:   parts[0],
			Name: parts[1],
		}
		fmt.Sscanf(parts[2], "%d", &session.Windows)
		
		panes, err := listPanesForSession(parts[1])
		if err == nil {
			session.Panes = panes
		}
		
		sessions = append(sessions, session)
	}
	
	return sessions, nil
}

func GetSession(nameOrID string) (*Session, error) {
	sessions, err := ListSessions()
	if err != nil {
		return nil, err
	}
	
	for _, s := range sessions {
		if s.Name == nameOrID || s.ID == nameOrID {
			return &s, nil
		}
	}
	
	return nil, fmt.Errorf("session not found: %s", nameOrID)
}

func listPanesForSession(sessionName string) ([]Pane, error) {
	cmd := exec.Command("tmux", "list-panes", "-s", "-t", sessionName, 
		"-F", "#{pane_id}|#{pane_active}|#{pane_width}|#{pane_height}|#{window_id}")
	var out bytes.Buffer
	cmd.Stdout = &out
	
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to list panes: %w", err)
	}

	var panes []Pane
	lines := strings.Split(strings.TrimSpace(out.String()), "\n")
	
	for _, line := range lines {
		if line == "" {
			continue
		}
		
		parts := strings.Split(line, "|")
		if len(parts) != 5 {
			continue
		}
		
		pane := Pane{
			ID:      parts[0],
			Active:  parts[1] == "1",
			Session: sessionName,
			Window:  parts[4],
		}
		fmt.Sscanf(parts[2], "%d", &pane.Width)
		fmt.Sscanf(parts[3], "%d", &pane.Height)
		
		panes = append(panes, pane)
	}
	
	return panes, nil
}

func CreateSession(name string) (*Session, error) {
	args := []string{"new-session", "-d", "-P", "-F", "#{session_id}|#{session_name}|#{session_windows}"}
	if name != "" {
		args = append(args, "-s", name)
	}
	cmd := exec.Command("tmux", args...)
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	parts := strings.Split(strings.TrimSpace(out.String()), "|")
	if len(parts) != 3 {
		return nil, fmt.Errorf("unexpected output: %s", out.String())
	}

	session := &Session{
		ID:   parts[0],
		Name: parts[1],
	}
	fmt.Sscanf(parts[2], "%d", &session.Windows)

	panes, err := listPanesForSession(session.Name)
	if err == nil {
		session.Panes = panes
	}
	return session, nil
}

func KillSession(nameOrID string) error {
	cmd := exec.Command("tmux", "kill-session", "-t", nameOrID)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to kill session %s: %w", nameOrID, err)
	}
	return nil
}

func RenameSession(oldName, newName string) error {
	if newName == "" {
		return fmt.Errorf("new name cannot be empty")
	}

	cmd := exec.Command("tmux", "rename-session", "-t", oldName, newName)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to rename session %s to %s: %w", oldName, newName, err)
	}
	return nil
}

func SendKeys(sessionName, command string) error {
	cmd := exec.Command("tmux", "send-keys", "-t", sessionName, command, "Enter")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to send keys to session %s: %w (stderr: %s)", sessionName, err, stderr.String())
	}
	return nil
}

func SendRawKeys(sessionName, keys string) error {
	cmd := exec.Command("tmux", "send-keys", "-t", sessionName, keys)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to send keys to session %s: %w (stderr: %s)", sessionName, err, stderr.String())
	}
	return nil
}
