package main

import (
	"fmt"
	"os"
	"strings"
)

func buildRawContentURL(ref, repoPath string) string {
	repo := strings.TrimSpace(os.Getenv("TEMPLUI_REPO"))
	if repo == "" {
		repo = "RimJur/templui"
	} else {
		repo = strings.Trim(repo, "/")
	}
	return fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/%s", repo, ref, repoPath)
}
