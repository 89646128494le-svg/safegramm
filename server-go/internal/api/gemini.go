package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// Структуры для запроса к Google Gemini API
type GeminiRequest struct {
	Contents []GeminiContent `json:"contents"`
}

type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
	Role  string       `json:"role,omitempty"` // "user" или "model"
}

type GeminiPart struct {
	Text string `json:"text"`
}

// Структура ответа от Google Gemini API
type GeminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

// AskGemini обрабатывает запрос от фронтенда и пересылает его в Gemini
func AskGemini(c *gin.Context) {
	var req struct {
		Message string `json:"message"`
		Mode    string `json:"mode"` // "safety" или "x"
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Gemini API key not configured"})
		return
	}

	// Настройка системного промпта (Gemini понимает контекст через историю, но здесь мы шлем одним сообщением для простоты)
	systemPrompt := "You are Safety, a helpful assistant for SafeGram messenger. Answer in Russian."
	if req.Mode == "x" {
		systemPrompt = "You are Safety-X, a strict security auditor for SafeGram. Be technical, concise, and paranoid. Answer in Russian."
	}

	// Формируем тело запроса
	geminiReq := GeminiRequest{
		Contents: []GeminiContent{
			{
				Role: "user",
				Parts: []GeminiPart{
					{Text: systemPrompt + "\n\nUser request: " + req.Message},
				},
			},
		},
	}

	jsonData, err := json.Marshal(geminiReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encode request"})
		return
	}

	// URL для модели gemini-1.5-flash
	apiURL := "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey

	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to AI provider"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		c.JSON(http.StatusBadGateway, gin.H{"error": "AI provider error: " + string(body)})
		return
	}

	var geminiResp GeminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse AI response"})
		return
	}

	// Извлекаем текст ответа
	reply := "I have nothing to say."
	if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
		reply = geminiResp.Candidates[0].Content.Parts[0].Text
	}

	c.JSON(http.StatusOK, gin.H{"reply": reply})
}
