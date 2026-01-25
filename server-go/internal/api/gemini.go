package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// Структуры для Google Gemini API
type GeminiRequest struct {
	Contents []struct {
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	} `json:"contents"`
}

func AskGemini(c *gin.Context) {
	var req struct {
		Message string `json:"message" binding:"required"`
		Mode    string `json:"mode"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Vercel автоматически подставит ключ из настроек Environment Variables
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Gemini API key is not configured in Vercel settings"})
		return
	}

	systemPrompt := "Ты — Safety, интеллектуальный помощник SafeGram. Отвечай кратко и на русском языке."
	if req.Mode == "x" {
		systemPrompt = "Ты — Safety-X, строгий аудит-бот SafeGram. Фокусируйся на безопасности и коде."
	}

	geminiPayload := GeminiRequest{}
	geminiPayload.Contents = append(geminiPayload.Contents, struct {
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	}{
		Parts: []struct {
			Text string `json:"text"`
		}{
			{Text: systemPrompt + "\n\nПользователь: " + req.Message},
		},
	})

	jsonData, _ := json.Marshal(geminiPayload)
	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to Gemini"})
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	c.JSON(http.StatusOK, result)
}
