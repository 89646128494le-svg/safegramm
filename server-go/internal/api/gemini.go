package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"time"

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

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func askWithOpenAI(messageText, systemPrompt string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	openAIReq := OpenAIRequest{
		Model: "gpt-4o-mini",
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: messageText},
		},
	}
	jsonData, _ := json.Marshal(openAIReq)

	req, _ := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", &providerError{status: resp.StatusCode, body: string(body)}
	}
	var aiResp OpenAIResponse
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &aiResp); err != nil {
		return "", err
	}
	if len(aiResp.Choices) > 0 {
		return aiResp.Choices[0].Message.Content, nil
	}
	return "", nil
}

type providerError struct {
	status int
	body   string
}

func (e *providerError) Error() string { return "provider_error" }

func AskGemini(c *gin.Context) {
	var req struct {
		Message string `json:"message" binding:"required"`
		Mode    string `json:"mode"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	systemPrompt := "Ты — Safety, интеллектуальный помощник SafeGram. Отвечай кратко и на русском языке."
	if req.Mode == "x" {
		systemPrompt = "Ты — Safety-X, строгий аудит-бот SafeGram. Фокусируйся на безопасности и коде."
	}

	// Основной провайдер: Gemini. Fallback: OpenAI.
	if geminiKey := os.Getenv("GEMINI_API_KEY"); geminiKey != "" {
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
		url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiKey

		httpClient := &http.Client{Timeout: 30 * time.Second}
		httpReq, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
		httpReq.Header.Set("Content-Type", "application/json")

		resp, err := httpClient.Do(httpReq)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var parsed geminiResponse
				if decodeErr := json.NewDecoder(resp.Body).Decode(&parsed); decodeErr == nil {
					if len(parsed.Candidates) > 0 && len(parsed.Candidates[0].Content.Parts) > 0 {
						reply := parsed.Candidates[0].Content.Parts[0].Text
						c.JSON(http.StatusOK, gin.H{
							"reply":    reply,
							"provider": "gemini",
							"model":    "gemini-1.5-flash",
						})
						return
					}
				}
			}
		}
	}

	if os.Getenv("OPENAI_API_KEY") != "" {
		reply, err := askWithOpenAI(req.Message, systemPrompt)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "AI provider returned error", "errorCode": "AI_PROVIDER_ERROR"})
			return
		}
		if reply == "" {
			reply = "Я не получил содержательный ответ от модели. Попробуйте переформулировать запрос."
		}
		c.JSON(http.StatusOK, gin.H{
			"reply":    reply,
			"provider": "openai",
			"model":    "gpt-4o-mini",
		})
		return
	}

	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "server_error", "errorCode": "AI_NOT_CONFIGURED"})
}
