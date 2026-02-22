// Индексация знаний проекта для контекста Safety AI: структура SafeGram, роли, цели.
package engine

import (
	"os"
	"path/filepath"
	"strings"
)

const (
	maxKnowledgeBytes = 48 * 1024 // ~48KB в системный промпт
	maxFileBytes     = 8000      // на файл
)

// IndexKnowledge сканирует baseDir и папку archive (если есть), собирает .go, .md, .txt
// и возвращает один блок текста для вставки в system prompt. Ограничение по размеру.
func IndexKnowledge(baseDir string) string {
	if baseDir == "" {
		baseDir = "."
	}
	var out strings.Builder
	seen := make(map[string]bool)
	skipDir := map[string]bool{
		"node_modules": true, "vendor": true, ".git": true, "__pycache__": true,
	}
	var total int

	walk := func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if skipDir[info.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".go" && ext != ".md" && ext != ".txt" {
			return nil
		}
		rel, _ := filepath.Rel(baseDir, path)
		if rel == "" || rel == "." {
			return nil
		}
		if seen[rel] {
			return nil
		}
		seen[rel] = true
		body, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		content := string(body)
		if len(content) > maxFileBytes {
			content = content[:maxFileBytes] + "\n... (обрезано)"
		}
		chunk := "\n--- " + rel + " ---\n" + content
		if total+len(chunk) > maxKnowledgeBytes {
			out.WriteString("\n... (индекс обрезан по лимиту)")
			return filepath.SkipAll
		}
		out.WriteString(chunk)
		total += len(chunk)
		return nil
	}

	_ = filepath.Walk(baseDir, walk)
	return out.String()
}
