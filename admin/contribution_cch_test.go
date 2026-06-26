package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCreateContributorKeyHandlesTopLevelUserID(t *testing.T) {
	var sawCreateUser bool
	var sawCreateKey bool
	var sawReveal bool

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Api-Key") != "admin-test-key" {
			t.Fatalf("missing admin api key header")
		}
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/users":
			sawCreateUser = true
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatalf("decode create user body: %v", err)
			}
			if body["name"] != "contributor-key" {
				t.Fatalf("unexpected user name: %v", body["name"])
			}
			if body["providerGroup"] != "ChatGPT" {
				t.Fatalf("unexpected provider group: %v", body["providerGroup"])
			}
			if !strings.Contains(body["note"].(string), "person@example.com") {
				t.Fatalf("note does not include email: %v", body["note"])
			}
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"id":123,"name":"contributor-key"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/users/123/keys":
			sawCreateKey = true
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatalf("decode create key body: %v", err)
			}
			if body["providerGroup"] != "ChatGPT" {
				t.Fatalf("unexpected key provider group: %v", body["providerGroup"])
			}
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"id":456,"name":"contributor-key"}`))
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/keys/456:reveal":
			sawReveal = true
			_, _ = w.Write([]byte(`{"key":"sk-test"}`))
		default:
			t.Fatalf("unexpected CCH request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer server.Close()

	cfg := cchClientConfig{
		baseURL:       server.URL,
		serviceURL:    server.URL + "/v1",
		adminAPIKey:   "admin-test-key",
		providerGroup: "ChatGPT",
		note:          "contribution-codex-account-generated",
	}
	userID, keyID, apiKey, err := cfg.createContributorKey(context.Background(), "contributor-key", "person@example.com")
	if err != nil {
		t.Fatalf("createContributorKey returned error: %v", err)
	}
	if userID != "123" || keyID != "456" || apiKey != "sk-test" {
		t.Fatalf("unexpected result userID=%q keyID=%q apiKey=%q", userID, keyID, apiKey)
	}
	if !sawCreateUser || !sawCreateKey || !sawReveal {
		t.Fatalf("expected create user, create key, and reveal calls; got user=%t key=%t reveal=%t", sawCreateUser, sawCreateKey, sawReveal)
	}
}
