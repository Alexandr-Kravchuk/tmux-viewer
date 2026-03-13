package tmux

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

type PaneContent struct {
	PaneID  string `json:"pane_id"`
	Content string `json:"content"`
	Lines   int    `json:"lines"`
}

func CapturePane(paneID string, lines int) (*PaneContent, error) {
	if lines <= 0 {
		lines = 50
	}
	
	cmd := exec.Command("tmux", "capture-pane", "-t", paneID, "-p", "-S", fmt.Sprintf("-%d", lines))
	var out bytes.Buffer
	cmd.Stdout = &out
	
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to capture pane %s: %w", paneID, err)
	}

	content := out.String()
	lineCount := strings.Count(content, "\n")
	
	return &PaneContent{
		PaneID:  paneID,
		Content: content,
		Lines:   lineCount,
	}, nil
}

func CapturePaneWithColors(paneID string, lines int) (*PaneContent, error) {
	if lines <= 0 {
		lines = 50
	}
	
	cmd := exec.Command("tmux", "capture-pane", "-t", paneID, "-p", "-e", "-S", fmt.Sprintf("-%d", lines))
	var out bytes.Buffer
	cmd.Stdout = &out
	
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to capture pane %s with colors: %w", paneID, err)
	}

	content := out.String()
	lineCount := strings.Count(content, "\n")
	
	return &PaneContent{
		PaneID:  paneID,
		Content: content,
		Lines:   lineCount,
	}, nil
}
