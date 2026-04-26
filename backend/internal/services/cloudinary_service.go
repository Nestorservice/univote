package services

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"net/url"
	"strconv"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

// CloudinaryService gère l'upload et la modération des vidéos via Cloudinary.
type CloudinaryService struct {
	Cld          *cloudinary.Cloudinary
	CloudName    string
	APIKey       string
	APISecret    string
	UploadPreset string
	BackendURL   string
}

// NewCloudinaryService initialise le service Cloudinary.
func NewCloudinaryService(cloudName, apiKey, apiSecret, uploadPreset, backendURL string) (*CloudinaryService, error) {
	if cloudName == "" || apiKey == "" || apiSecret == "" {
		return nil, fmt.Errorf("cloudinary credentials are not fully configured")
	}

	cld, err := cloudinary.NewFromParams(cloudName, apiKey, apiSecret)
	if err != nil {
		return nil, err
	}

	return &CloudinaryService{
		Cld:          cld,
		CloudName:    cloudName,
		APIKey:       apiKey,
		APISecret:    apiSecret,
		UploadPreset: uploadPreset,
		BackendURL:   backendURL,
	}, nil
}

// UploadSignatureResult contient les paramètres nécessaires côté client pour l'upload.
type UploadSignatureResult struct {
	Signature  string `json:"signature"`
	Timestamp  int64  `json:"timestamp"`
	APIKey     string `json:"api_key"`
	CloudName  string `json:"cloud_name"`
	UploadURL  string `json:"upload_url"`
	Folder     string `json:"folder"`
}

// GenerateSignedUploadURL crée une signature d'upload pour un client avec les paramètres de modération.
func (s *CloudinaryService) GenerateSignedUploadURL(eventID string, resType string, videoID string) (*UploadSignatureResult, error) {
	if resType == "" {
		resType = "video"
	}
	timestamp := time.Now().Unix()
	folder := fmt.Sprintf("univote/events/%s", eventID)

	// Paramètres requis pour la modération et la transformation
	paramsToSign := url.Values{}
	paramsToSign.Add("folder", folder)
	paramsToSign.Add("timestamp", strconv.FormatInt(timestamp, 10))
	paramsToSign.Add("upload_preset", s.UploadPreset)
	paramsToSign.Add("resource_type", resType)
	paramsToSign.Add("moderation", "aws_rek") // IA AWS Rekognition intégrée
	paramsToSign.Add("context", fmt.Sprintf("pending_video_id=%s", videoID))
	paramsToSign.Add("notification_url", fmt.Sprintf("%s/api/v1/webhook/video-ready", s.BackendURL))

	if resType == "video" {
		paramsToSign.Add("transformation", "q_auto,f_mp4,vc_h264,du_30") // Qualité auto, MP4, H.264, coupe à 30s
		paramsToSign.Add("eager", "sp_hd/m3u8")                         // Génère le flux HLS
	} else {
		paramsToSign.Add("transformation", "q_auto,f_auto") // Qualité et format auto pour images
	}

	// Signer les paramètres avec l'API Secret
	signature, err := api.SignParameters(paramsToSign, s.APISecret)
	if err != nil {
		return nil, fmt.Errorf("failed to sign upload parameters: %w", err)
	}

	uploadURL := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/%s/upload", s.CloudName, resType)

	return &UploadSignatureResult{
		Signature: signature,
		Timestamp: timestamp,
		APIKey:    s.APIKey,
		CloudName: s.CloudName,
		UploadURL: uploadURL,
		Folder:    folder,
	}, nil
}

// ValidateWebhookSignature valide la signature HMAC-SHA1 d'un webhook entrant de Cloudinary.
func (s *CloudinaryService) ValidateWebhookSignature(payload []byte, signature string, timestamp string) bool {
	// Calcul de la signature Cloudinary: SHA1(payload + timestamp + APISecret)
	// payload doit être le body raw complet
	strToSign := string(payload) + timestamp + s.APISecret

	hasher := sha1.New()
	hasher.Write([]byte(strToSign))
	expectedSignature := hex.EncodeToString(hasher.Sum(nil))

	return expectedSignature == signature
}

// WebhookModerationItem représente le résultat de la modération dans le payload.
type WebhookModerationItem struct {
	Kind   string `json:"kind"`
	Status string `json:"status"` // "approved" ou "rejected"
}

// WebhookPayload est le payload JSON reçu par le webhook.
type WebhookPayload struct {
	NotificationType string                  `json:"notification_type"`
	PublicID         string                  `json:"public_id"`
	SecureURL        string                  `json:"secure_url"`
	Moderation       []WebhookModerationItem `json:"moderation"`
	Eager            []struct {
		SecureURL string `json:"secure_url"`
	} `json:"eager"`
	Duration float64 `json:"duration"`
	Context  struct {
		Custom struct {
			PendingVideoID string `json:"pending_video_id"`
		} `json:"custom"`
	} `json:"context"`
}

// ParseModerationResult analyse le payload du webhook pour extraire le résultat de modération.
func (s *CloudinaryService) ParseModerationResult(payload *WebhookPayload) (approved bool, reason string) {
	if len(payload.Moderation) == 0 {
		return false, "no_moderation_data"
	}

	mod := payload.Moderation[0]
	if mod.Status == "approved" {
		return true, ""
	}

	// Si rejeté, Cloudinary met la raison dans Kind ou d'autres champs étendus
	return false, fmt.Sprintf("rejected_by_ai: %s", mod.Kind)
}

// UploadImage upload une image directement sur Cloudinary depuis le backend.
func (s *CloudinaryService) UploadImage(ctx context.Context, file io.Reader, folder string) (string, error) {
	if s.Cld == nil {
		return "", fmt.Errorf("cloudinary service not initialized")
	}

	resp, err := s.Cld.Upload.Upload(ctx, file, uploader.UploadParams{
		Folder: folder,
	})
	if err != nil {
		return "", fmt.Errorf("cloudinary upload failed: %w", err)
	}

	return resp.SecureURL, nil
}
