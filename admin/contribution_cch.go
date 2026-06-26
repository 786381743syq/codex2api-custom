package admin

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/codex2api/database"
	"github.com/codex2api/security"
	"github.com/gin-gonic/gin"
)

const (
	defaultCCHBaseURL          = "https://cch.ysl.monster"
	defaultCCHProviderGroup    = "ChatGPT"
	defaultCCHContributionNote = "\u8d21\u732ecodex\u8d26\u53f7\u751f\u6210"
)

type generateContributionAPIKeyRequest struct {
	Email   string `json:"email"`
	KeyName string `json:"key_name"`
}

type generateContributionAPIKeyResponse struct {
	APIKey         string `json:"api_key"`
	BaseURL        string `json:"base_url"`
	KeyName        string `json:"key_name"`
	ProviderGroup  string `json:"provider_group"`
	UserID         string `json:"user_id"`
	KeyID          string `json:"key_id"`
	AlreadyCreated bool   `json:"already_created"`
	CreatedAt      string `json:"created_at"`
}

type cchClientConfig struct {
	baseURL       string
	serviceURL    string
	adminAPIKey   string
	providerGroup string
	note          string
}

type cchKeyResponse struct {
	ID            any    `json:"id"`
	Name          string `json:"name"`
	Key           string `json:"key"`
	ProviderGroup string `json:"providerGroup"`
}

type cchCreateUserResponse struct {
	User struct {
		ID any `json:"id"`
	} `json:"user"`
	DefaultKey *cchKeyResponse `json:"defaultKey"`
}

type cchHTTPError struct {
	StatusCode int
	Body       string
}

func (e *cchHTTPError) Error() string {
	return fmt.Sprintf("CCH request failed with status %d: %s", e.StatusCode, e.Body)
}

func isCCHNotFound(err error) bool {
	var httpErr *cchHTTPError
	return errors.As(err, &httpErr) && httpErr.StatusCode == http.StatusNotFound
}

func contributionCCHConfig() cchClientConfig {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("CCH_BASE_URL")), "/")
	if baseURL == "" {
		baseURL = defaultCCHBaseURL
	}
	serviceURL := strings.TrimRight(strings.TrimSpace(os.Getenv("CCH_SERVICE_BASE_URL")), "/")
	if serviceURL == "" {
		serviceURL = baseURL + "/v1"
	}
	providerGroup := strings.TrimSpace(os.Getenv("CCH_PROVIDER_GROUP"))
	if providerGroup == "" {
		providerGroup = defaultCCHProviderGroup
	}
	note := strings.TrimSpace(os.Getenv("CCH_CONTRIBUTION_NOTE"))
	if note == "" {
		note = defaultCCHContributionNote
	}
	return cchClientConfig{
		baseURL:       baseURL,
		serviceURL:    serviceURL,
		adminAPIKey:   strings.TrimSpace(os.Getenv("CCH_ADMIN_API_KEY")),
		providerGroup: providerGroup,
		note:          note,
	}
}

func normalizeContributionKeyName(input string) (string, error) {
	name := strings.TrimSpace(input)
	if name == "" {
		return "", errors.New("key_name is required")
	}
	if len([]rune(name)) > 64 {
		return "", errors.New("key_name is too long")
	}
	if strings.ContainsAny(name, "\r\n\t<>") {
		return "", errors.New("key_name is invalid")
	}
	return name, nil
}

func cchScalarID(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(v)
	case float64:
		return fmt.Sprintf("%.0f", v)
	case json.Number:
		return v.String()
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func contributionCCHNote(baseNote string, email string) string {
	baseNote = strings.TrimSpace(baseNote)
	email = strings.TrimSpace(email)
	if baseNote == "" {
		return email
	}
	if email == "" {
		return baseNote
	}
	return baseNote + " - " + email
}
func (cfg cchClientConfig) doJSON(ctx context.Context, method string, path string, body any, out any) error {
	if cfg.adminAPIKey == "" {
		return errors.New("CCH_ADMIN_API_KEY is not configured")
	}
	endpoint := cfg.baseURL + path
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return err
	}
	req.Header.Set("X-Api-Key", cfg.adminAPIKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &cchHTTPError{StatusCode: resp.StatusCode, Body: strings.TrimSpace(string(data))}
	}
	if out == nil || len(data) == 0 {
		return nil
	}
	if err := json.Unmarshal(data, out); err != nil {
		return err
	}
	return nil
}

func (cfg cchClientConfig) setContributorAccessEnabled(ctx context.Context, userID string, keyID string, enabled bool) error {
	userID = strings.TrimSpace(userID)
	keyID = strings.TrimSpace(keyID)
	if userID == "" && keyID == "" {
		return sql.ErrNoRows
	}
	body := map[string]any{"enabled": enabled}
	if userID != "" {
		if err := cfg.doJSON(ctx, http.MethodPost, "/api/v1/users/"+url.PathEscape(userID)+":enable", body, nil); err != nil {
			return err
		}
	}
	if keyID != "" {
		if err := cfg.doJSON(ctx, http.MethodPost, "/api/v1/keys/"+url.PathEscape(keyID)+":enable", body, nil); err != nil {
			return err
		}
	}
	return nil
}
func (cfg cchClientConfig) revealKey(ctx context.Context, keyID string) (string, error) {
	if strings.TrimSpace(keyID) == "" {
		return "", sql.ErrNoRows
	}
	var result cchKeyResponse
	err := cfg.doJSON(ctx, http.MethodGet, "/api/v1/keys/"+url.PathEscape(keyID)+":reveal", nil, &result)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(result.Key) == "" {
		return "", errors.New("CCH reveal response did not include api key")
	}
	return result.Key, nil
}

func (cfg cchClientConfig) createContributorKey(ctx context.Context, keyName string, email string) (userID string, keyID string, apiKey string, err error) {
	createBody := map[string]any{
		"name":      keyName,
		"note":      contributionCCHNote(cfg.note, email),
		"tags":      []string{"contributor"},
		"isEnabled": true,
	}
	var created cchCreateUserResponse
	if err := cfg.doJSON(ctx, http.MethodPost, "/api/v1/users", createBody, &created); err != nil {
		return "", "", "", err
	}
	userID = cchScalarID(created.User.ID)
	if userID == "" {
		return "", "", "", errors.New("CCH create user response missing user id")
	}
	if created.DefaultKey != nil {
		keyID = cchScalarID(created.DefaultKey.ID)
		apiKey = strings.TrimSpace(created.DefaultKey.Key)
	}
	keyBody := map[string]any{
		"name":          keyName,
		"isEnabled":     true,
		"canLoginWebUi": false,
		"providerGroup": cfg.providerGroup,
	}
	if keyID != "" {
		var patched cchKeyResponse
		if err := cfg.doJSON(ctx, http.MethodPatch, "/api/v1/keys/"+url.PathEscape(keyID), keyBody, &patched); err != nil {
			return "", "", "", err
		}
		if strings.TrimSpace(patched.Key) != "" {
			apiKey = strings.TrimSpace(patched.Key)
		}
	} else {
		var key cchKeyResponse
		if err := cfg.doJSON(ctx, http.MethodPost, "/api/v1/users/"+url.PathEscape(userID)+"/keys", keyBody, &key); err != nil {
			return "", "", "", err
		}
		keyID = cchScalarID(key.ID)
		apiKey = strings.TrimSpace(key.Key)
	}
	if apiKey == "" && keyID != "" {
		apiKey, err = cfg.revealKey(ctx, keyID)
		if err != nil {
			return "", "", "", err
		}
	}
	if keyID == "" || apiKey == "" {
		return "", "", "", errors.New("CCH key response missing api key")
	}
	return userID, keyID, apiKey, nil
}

func contributionAPIKeyIneligibleMessage(allowedPlanTypes []string) string {
	allowed := database.NormalizeContributionAPIKeyAllowedPlanTypes(allowedPlanTypes)
	if len(allowed) == 0 {
		allowed = append([]string(nil), database.DefaultContributionAPIKeyAllowedPlanTypes...)
	}
	return "\u53ea\u6709\u4ee5\u4e0b\u7c7b\u578b\u7684\u8d21\u732e\u8d26\u53f7\u53ef\u4ee5\u751f\u6210 API Key\uff1a" + strings.Join(allowed, "\u3001")
}

func contributionPlanAllowsAPIKey(planType string, allowedPlanTypes []string) bool {
	planType = strings.ToLower(strings.TrimSpace(planType))
	if planType == "" {
		return false
	}
	allowed := database.NormalizeContributionAPIKeyAllowedPlanTypes(allowedPlanTypes)
	if len(allowed) == 0 {
		allowed = append([]string(nil), database.DefaultContributionAPIKeyAllowedPlanTypes...)
	}
	for _, allowedType := range allowed {
		if planType == allowedType {
			return true
		}
	}
	return false
}

func contributionAccountsAllowAPIKey(rows []*database.AccountContributionRow, allowedPlanTypes []string) bool {
	for _, row := range rows {
		if row != nil && contributionPlanAllowsAPIKey(row.PlanType, allowedPlanTypes) {
			return true
		}
	}
	return false
}

func (h *Handler) contributionAPIKeyAllowedPlanTypes(ctx context.Context) ([]string, error) {
	if h == nil || h.db == nil {
		return append([]string(nil), database.DefaultContributionAPIKeyAllowedPlanTypes...), nil
	}
	return h.db.GetContributionAPIKeyAllowedPlanTypes(ctx)
}

func contributionAccountsExcludingID(rows []*database.AccountContributionRow, excludeID int64) []*database.AccountContributionRow {
	if len(rows) == 0 {
		return nil
	}
	kept := make([]*database.AccountContributionRow, 0, len(rows))
	for _, row := range rows {
		if row == nil || row.ID == excludeID {
			continue
		}
		kept = append(kept, row)
	}
	return kept
}

func (h *Handler) clearContributionContactCCHKey(ctx context.Context, email string, keyID string, reason string) {
	if h == nil || h.db == nil || strings.TrimSpace(keyID) == "" {
		return
	}
	if err := h.db.ClearContributionContactCCHKey(ctx, email, keyID); err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Printf("clear stale contribution CCH API key failed: email=%s key_id=%s reason=%s err=%v", email, keyID, reason, err)
	}
}

func (h *Handler) syncContributionCCHKeysAsync(allowedPlanTypes []string) {
	if h == nil || h.db == nil {
		return
	}
	allowed := database.NormalizeContributionAPIKeyAllowedPlanTypes(allowedPlanTypes)
	if len(allowed) == 0 {
		allowed = append([]string(nil), database.DefaultContributionAPIKeyAllowedPlanTypes...)
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		if err := h.syncContributionCCHKeys(ctx, allowed); err != nil {
			log.Printf("sync contribution CCH API key states failed: %v", err)
		}
	}()
}

func (h *Handler) syncContributionCCHKeys(ctx context.Context, allowedPlanTypes []string) error {
	if h == nil || h.db == nil {
		return nil
	}
	cfg := contributionCCHConfig()
	if cfg.adminAPIKey == "" {
		return nil
	}
	contacts, err := h.db.ListContributionContactsWithCCHKeys(ctx)
	if err != nil {
		return err
	}
	for _, contact := range contacts {
		if contact == nil || strings.TrimSpace(contact.CCHKeyID) == "" {
			continue
		}
		unlock := h.lockContributionAPIKey(contact.Email)
		rows, err := h.db.FindAccountsByEmail(ctx, contact.Email)
		if err != nil {
			unlock()
			return err
		}
		eligible := contributionAccountsAllowAPIKey(rows, allowedPlanTypes)
		if err := cfg.setContributorAccessEnabled(ctx, contact.CCHUserID, contact.CCHKeyID, eligible); err != nil {
			if isCCHNotFound(err) {
				h.clearContributionContactCCHKey(ctx, contact.Email, contact.CCHKeyID, "cch_not_found")
				unlock()
				continue
			}
			log.Printf("sync contribution CCH API key state failed: email=%s key_id=%s enabled=%t err=%v", contact.Email, contact.CCHKeyID, eligible, err)
		}
		unlock()
	}
	return nil
}

func contributionAPIKeyResponseFromContact(ctx context.Context, cfg cchClientConfig, contactRow *database.ContributionContactRow, fallbackKeyName string) (*generateContributionAPIKeyResponse, error) {
	if contactRow == nil || strings.TrimSpace(contactRow.CCHKeyID) == "" {
		return nil, nil
	}
	apiKey, err := cfg.revealKey(ctx, contactRow.CCHKeyID)
	if err != nil {
		return nil, err
	}
	return &generateContributionAPIKeyResponse{
		APIKey:         apiKey,
		BaseURL:        cchFirstNonEmpty(contactRow.CCHAPIBaseURL, cfg.serviceURL),
		KeyName:        cchFirstNonEmpty(contactRow.CCHKeyName, fallbackKeyName),
		ProviderGroup:  cfg.providerGroup,
		UserID:         contactRow.CCHUserID,
		KeyID:          contactRow.CCHKeyID,
		AlreadyCreated: true,
		CreatedAt:      timeOrNow(contactRow.CCHAPIKeyCreatedAt).Format(time.RFC3339),
	}, nil
}
func (h *Handler) lockContributionAPIKey(email string) func() {
	if h == nil {
		return func() {}
	}
	value, _ := h.contributionAPIKeyLocks.LoadOrStore(email, &sync.Mutex{})
	mu, ok := value.(*sync.Mutex)
	if !ok {
		return func() {}
	}
	mu.Lock()
	return func() { mu.Unlock() }
}
func (h *Handler) GenerateContributionAPIKey(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
	var req generateContributionAPIKeyRequest
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request")
		return
	}
	email, err := normalizeContactEmail(req.Email)
	if err != nil {
		writeError(c, http.StatusBadRequest, err.Error())
		return
	}
	keyName, err := normalizeContributionKeyName(req.KeyName)
	if err != nil {
		writeError(c, http.StatusBadRequest, err.Error())
		return
	}
	if !h.allowContributionContactSubmit(c.ClientIP(), email+"|api-key") {
		writeError(c, http.StatusTooManyRequests, "too many requests")
		return
	}
	unlockAPIKey := h.lockContributionAPIKey(email)
	defer unlockAPIKey()

	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	rows, err := h.db.FindAccountsByEmail(ctx, email)
	if err != nil {
		writeInternalError(c, err)
		return
	}
	if len(rows) == 0 {
		writeError(c, http.StatusForbidden, "email has no contributed account")
		return
	}
	allowedPlanTypes, err := h.contributionAPIKeyAllowedPlanTypes(ctx)
	if err != nil {
		writeInternalError(c, err)
		return
	}
	if !contributionAccountsAllowAPIKey(rows, allowedPlanTypes) {
		writeError(c, http.StatusForbidden, contributionAPIKeyIneligibleMessage(allowedPlanTypes))
		return
	}
	contactRow, err := h.db.FindContributionContactByEmail(ctx, email)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			writeInternalError(c, err)
			return
		}
		contactRow, err = h.db.UpsertContributionContact(ctx, email)
		if err != nil {
			writeInternalError(c, err)
			return
		}
	}

	cfg := contributionCCHConfig()
	if contactRow.CCHKeyID != "" {
		staleCCHKey := false
		if err := cfg.setContributorAccessEnabled(ctx, contactRow.CCHUserID, contactRow.CCHKeyID, true); err != nil {
			if isCCHNotFound(err) {
				staleCCHKey = true
			} else {
				log.Printf("sync existing CCH API key enabled state before reveal failed: key_id=%s err=%v", contactRow.CCHKeyID, err)
			}
		}
		if !staleCCHKey {
			response, err := contributionAPIKeyResponseFromContact(ctx, cfg, contactRow, keyName)
			if err != nil {
				if !isCCHNotFound(err) {
					writeError(c, http.StatusBadGateway, "existing CCH api key cannot be loaded")
					return
				}
				staleCCHKey = true
			} else {
				c.JSON(http.StatusOK, response)
				return
			}
		}
		if staleCCHKey {
			security.SecurityAuditLog("PUBLIC_CONTRIBUTION_API_KEY_STALE", fmt.Sprintf("email=%s old_cch_key_id=%s ip=%s", email, contactRow.CCHKeyID, c.ClientIP()))
			h.clearContributionContactCCHKey(ctx, email, contactRow.CCHKeyID, "cch_not_found")
		}
	}

	userID, keyID, apiKey, err := cfg.createContributorKey(ctx, keyName, email)
	if err != nil {
		writeError(c, http.StatusBadGateway, "CCH api key generation failed")
		return
	}
	createdAt := time.Now()
	if err := h.db.UpdateContributionContactCCHKey(ctx, email, userID, keyID, keyName, cfg.serviceURL, createdAt); err != nil {
		writeInternalError(c, err)
		return
	}
	security.SecurityAuditLog("PUBLIC_CONTRIBUTION_API_KEY_GENERATED", fmt.Sprintf("email=%s cch_user_id=%s cch_key_id=%s ip=%s", email, userID, keyID, c.ClientIP()))
	c.JSON(http.StatusOK, generateContributionAPIKeyResponse{
		APIKey:         apiKey,
		BaseURL:        cfg.serviceURL,
		KeyName:        keyName,
		ProviderGroup:  cfg.providerGroup,
		UserID:         userID,
		KeyID:          keyID,
		AlreadyCreated: false,
		CreatedAt:      createdAt.Format(time.RFC3339),
	})
}

func cchFirstNonEmpty(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}

func timeOrNow(value time.Time) time.Time {
	if value.IsZero() {
		return time.Now()
	}
	return value
}
