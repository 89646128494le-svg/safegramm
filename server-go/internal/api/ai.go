package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// Структуры для OpenAI (или совместимых API)
type OpenAIRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OpenAIResponse struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
}

// AskSafety обрабатывает запрос к AI
func AskSafety(c *gin.Context) {
	var req struct {
		Message string `json:"message"`
		Mode    string `json:"mode"` // "safety" или "x"
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	apiKey := os.Getenv("OPENAI_API_KEY") // Ключ берем из переменных окружения сервера!
	if apiKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI service not configured"})
		return
	}

	// Настройка промпта
	systemPrompt := "You are Safety, a helpful assistant for SafeGram messenger."
	if req.Mode == "x" {
		systemPrompt = "You are Safety-X, a strict security auditor for SafeGram. Be technical and concise."
	}

	openAIReq := OpenAIRequest{
		Model: "gpt-4o-mini", // Или "gpt-3.5-turbo"
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: req.Message},
		},
	}

	jsonData, _ := json.Marshal(openAIReq)

	// Отправка запроса в OpenAI
	client := &http.Client{}
	r, _ := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonData))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(r)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call AI provider"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "AI provider returned error"})
		return
	}

	var aiResp OpenAIResponse
	body, _ := io.ReadAll(resp.Body)
	json.Unmarshal(body, &aiResp)

	if len(aiResp.Choices) > 0 {
		c.JSON(http.StatusOK, gin.H{"reply": aiResp.Choices[0].Message.Content})
	} else {
		c.JSON(http.StatusOK, gin.H{"reply": "I have nothing to say."})
	}
}
