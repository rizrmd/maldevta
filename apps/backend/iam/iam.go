package iam

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"encore.dev"
	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
	_ "modernc.org/sqlite"
	"golang.org/x/crypto/bcrypt"

	iamdb "encore.app/backend/iam/db"
)

// SQLite database setup - runs migrations on startup
func setupSQLite(ctx context.Context) (*sql.DB, error) {
	// Create data directory if it doesn't exist
	dataDir := "./data"
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	dbPath := dataDir + "/iam.db"
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Run migrations
	if err := runMigrations(ctx, db); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

var db *sql.DB

func init() {
	var err error
	db, err = setupSQLite(context.Background())
	if err != nil {
		panic(fmt.Sprintf("failed to setup database: %v", err))
	}
}

// q returns the sqlc queries interface
func q() *iamdb.Queries {
	return iamdb.New(db)
}

const (
	sessionCookieName = "aicore_session"
	sessionTTL        = 7 * 24 * time.Hour
)

type role string

const (
	roleAdmin role = "admin"
	roleUser  role = "user"
)

type scopeType string

const (
	scopeTenant    scopeType = "tenant"
	scopeSubclient scopeType = "subclient"
)

type authData struct {
	UserID      string
	Role        role
	TenantID    string
	ProjectID   string
	SubclientID string
	ScopeType   scopeType
	ScopeID     string
}

type authParams struct {
	SessionCookie *http.Cookie `cookie:"aicore_session"`
	Host          string       `header:"Host"`
}

type licenseVerifyResponse struct {
	Valid                 bool   `json:"valid"`
	TenantName            string `json:"tenant_name"`
	MaxProjectsPerTenant  int    `json:"max_projects_per_tenant"`
	WhatsappEnabled       bool   `json:"whatsapp_enabled"`
	SubclientEnabled      bool   `json:"subclient_enabled"`
	Error                 string `json:"error"`
}

//encore:authhandler
func AuthHandler(ctx context.Context, p *authParams) (auth.UID, *authData, error) {
	if p == nil || p.SessionCookie == nil || p.SessionCookie.Value == "" {
		return "", nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing session"}
	}

	tokenHash := hashToken(p.SessionCookie.Value)
	session, err := q().GetSession(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid session"}
		}
		return "", nil, err
	}
	if time.Now().After(session.ExpiresAt) {
		return "", nil, &errs.Error{Code: errs.Unauthenticated, Message: "session expired"}
	}

	user, err := q().GetUserByID(ctx, session.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil, &errs.Error{Code: errs.Unauthenticated, Message: "user not found"}
		}
		return "", nil, err
	}

	host := normalizeHost(p.Host)
	if host == "" {
		host = "*"
	}

	if session.ScopeType == string(scopeTenant) {
		if err := ensureTenantHost(ctx, session.ScopeID, host); err != nil {
			return "", nil, err
		}
	}

	if session.ScopeType == string(scopeSubclient) {
		if err := ensureSubclientHost(ctx, session.ScopeID, host); err != nil {
			return "", nil, err
		}
	}

	data := &authData{
		UserID:      session.UserID,
		Role:        role(user.Role),
		TenantID:    toString(user.TenantID),
		ProjectID:   toString(user.ProjectID),
		SubclientID: toString(user.SubclientID),
		ScopeType:   scopeType(session.ScopeType),
		ScopeID:     session.ScopeID,
	}

	return auth.UID(session.UserID), data, nil
}

type installParams struct {
	LicenseKey    string `json:"license_key"`
	TenantName    string `json:"tenant_name"`
	TenantDomain  string `json:"tenant_domain"`
	AdminUsername string `json:"admin_username"`
	AdminPassword string `json:"admin_password"`
	Host          string `header:"Host"`
}

type authResponse struct {
	SetCookie string `header:"Set-Cookie"`
	UserID    string `json:"user_id"`
	Role      string `json:"role"`
	ScopeType string `json:"scope_type"`
	ScopeID   string `json:"scope_id"`
}

type sessionStatusResponse struct {
	UserID      string `json:"user_id"`
	Role        string `json:"role"`
	ScopeType   string `json:"scope_type"`
	TenantID    string `json:"tenant_id"`
	ProjectID   string `json:"project_id"`
	SubclientID string `json:"subclient_id"`
}

// Install verifies the license and bootstraps the default tenant + admin user.
// This endpoint only works once.
//
//encore:api public method=POST path=/auth/install
func Install(ctx context.Context, p *installParams) (*authResponse, error) {
	if p == nil {
		return nil, badRequest("missing payload")
	}
	if p.LicenseKey == "" {
		return nil, badRequest("license key is required")
	}

	installed, err := isInstalled(ctx)
	if err != nil {
		return nil, err
	}
	if installed {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "license already installed"}
	}

	verified, err := verifyLicenseWithHub(ctx, p.LicenseKey)
	if err != nil {
		return nil, err
	}
	if !verified.Valid {
		msg := "invalid license"
		if verified.Error != "" {
			msg = verified.Error
		}
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: msg}
	}

	tenantName := p.TenantName
	if tenantName == "" {
		tenantName = verified.TenantName
	}
	if tenantName == "" {
		tenantName = "Default Tenant"
	}

	tenantDomain := normalizeHost(p.TenantDomain)
	if tenantDomain == "" {
		tenantDomain = "*"
	}

	adminUsername := strings.TrimSpace(p.AdminUsername)
	if adminUsername == "" {
		adminUsername = "admin"
	}

	adminPassword := p.AdminPassword
	if adminPassword == "" {
		adminPassword = p.LicenseKey
	}

	hash, err := hashPassword(adminPassword)
	if err != nil {
		return nil, err
	}

	licenseID := newID("lic")
	tenantID := newID("ten")
	userID := newID("usr")

	whatsappEnabled := int64(0)
	if verified.WhatsappEnabled {
		whatsappEnabled = 1
	}
	subclientEnabled := int64(0)
	if verified.SubclientEnabled {
		subclientEnabled = 1
	}

	err = q().InsertLicense(ctx, iamdb.InsertLicenseParams{
		ID:                 licenseID,
		LicenseKey:         p.LicenseKey,
		MaxProjectsPerTenant: int64(verified.MaxProjectsPerTenant),
		WhatsappEnabled:    whatsappEnabled,
		SubclientEnabled:   subclientEnabled,
		TenantName:         tenantName,
	})
	if err != nil {
		return nil, err
	}

	err = q().InsertTenant(ctx, iamdb.InsertTenantParams{
		ID:     tenantID,
		Name:   tenantName,
		Domain: tenantDomain,
	})
	if err != nil {
		return nil, err
	}

	err = q().InsertUser(ctx, iamdb.InsertUserParams{
		ID:           userID,
		TenantID:     sql.NullString{String: tenantID, Valid: true},
		Username:     adminUsername,
		PasswordHash: sql.NullString{String: hash, Valid: true},
		Role:         string(roleAdmin),
		Source:       "manual",
	})
	if err != nil {
		return nil, err
	}

	token, cookie, err := createSession(ctx, userID, scopeTenant, tenantID, normalizeHost(p.Host))
	if err != nil {
		return nil, err
	}

	_ = token
	return &authResponse{
		SetCookie: cookie,
		UserID:    userID,
		Role:      string(roleAdmin),
		ScopeType: string(scopeTenant),
		ScopeID:   tenantID,
	}, nil
}

type tenantLoginParams struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Host     string `header:"Host"`
}

// TenantLogin authenticates a tenant admin/user using cookie sessions.
//
//encore:api public method=POST path=/auth/tenant/login
func TenantLogin(ctx context.Context, p *tenantLoginParams) (*authResponse, error) {
	if p == nil || p.Username == "" || p.Password == "" {
		return nil, badRequest("username and password are required")
	}

	tenantID, err := resolveTenantByHost(ctx, normalizeHost(p.Host))
	if err != nil {
		return nil, err
	}

	userID, userRole, passwordHash, err := findTenantUser(ctx, tenantID, p.Username)
	if err != nil {
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(p.Password)); err != nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid credentials"}
	}

	_, cookie, err := createSession(ctx, userID, scopeTenant, tenantID, normalizeHost(p.Host))
	if err != nil {
		return nil, err
	}

	return &authResponse{
		SetCookie: cookie,
		UserID:    userID,
		Role:      userRole,
		ScopeType: string(scopeTenant),
		ScopeID:   tenantID,
	}, nil
}

type createProjectParams struct {
	Name             string `json:"name"`
	EnableWhatsapp   bool   `json:"enable_whatsapp"`
	EnableSubclients bool   `json:"enable_subclients"`
}

type projectResponse struct {
	ID                 string `json:"id"`
	TenantID           string `json:"tenant_id"`
	Name               string `json:"name"`
	WhatsappEnabled    bool   `json:"whatsapp_enabled"`
	SubclientEnabled   bool   `json:"subclient_enabled"`
	CreatedByUserID    string `json:"created_by_user_id"`
	CreatedAt          string `json:"created_at"`
}

type listProjectsResponse struct {
	Projects []*projectResponse `json:"projects"`
}

// CreateProject creates a tenant-level shared project (admin only).
//
//encore:api auth method=POST path=/projects
func CreateProject(ctx context.Context, p *createProjectParams) (*projectResponse, error) {
	if p == nil || strings.TrimSpace(p.Name) == "" {
		return nil, badRequest("project name is required")
	}

	raw := auth.Data()
	data, _ := raw.(*authData)
	if data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}
	if data.Role != roleAdmin {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only tenant admin can create projects"}
	}

	license, err := getLicense(ctx)
	if err != nil {
		return nil, err
	}

	count, err := countProjectsForTenant(ctx, data.TenantID)
	if err != nil {
		return nil, err
	}
	if count >= license.MaxProjectsPerTenant {
		return nil, &errs.Error{Code: errs.ResourceExhausted, Message: "project limit reached for tenant"}
	}

	if p.EnableWhatsapp && !license.WhatsappEnabled {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "whatsapp feature not enabled by license"}
	}
	if p.EnableSubclients && !license.SubclientEnabled {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "subclient feature not enabled by license"}
	}

	projectID := newID("prj")
	now := time.Now().UTC()

	whatsappEnabled := int64(0)
	if p.EnableWhatsapp {
		whatsappEnabled = 1
	}
	subclientEnabled := int64(0)
	if p.EnableSubclients {
		subclientEnabled = 1
	}

	err = q().InsertProject(ctx, iamdb.InsertProjectParams{
		ID:               projectID,
		TenantID:         data.TenantID,
		Name:             strings.TrimSpace(p.Name),
		WhatsappEnabled:  whatsappEnabled,
		SubclientEnabled: subclientEnabled,
		CreatedByUserID:  data.UserID,
		CreatedAt:        now,
	})
	if err != nil {
		return nil, err
	}

	return &projectResponse{
		ID:               projectID,
		TenantID:         data.TenantID,
		Name:             strings.TrimSpace(p.Name),
		WhatsappEnabled:  p.EnableWhatsapp,
		SubclientEnabled: p.EnableSubclients,
		CreatedByUserID:  data.UserID,
		CreatedAt:        now.Format(time.RFC3339),
	}, nil
}

type createSubclientParams struct {
	ProjectID     string `json:"project_id"`
	Name          string `json:"name"`
	Domain        string `json:"domain"`
	AdminUsername string `json:"admin_username"`
	AdminPassword string `json:"admin_password"`
}

type subclientResponse struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	Name      string `json:"name"`
	Domain    string `json:"domain"`
}

type listSubclientsResponse struct {
	Subclients []*subclientResponse `json:"subclients"`
}

// CreateSubclient creates a subclient space under a project (project admin only).
//
//encore:api auth method=POST path=/subclients
func CreateSubclient(ctx context.Context, p *createSubclientParams) (*subclientResponse, error) {
	if p == nil || p.ProjectID == "" || p.Name == "" || p.Domain == "" || p.AdminUsername == "" || p.AdminPassword == "" {
		return nil, badRequest("project_id, name, domain, admin_username, and admin_password are required")
	}

	raw := auth.Data()
	data, _ := raw.(*authData)
	if data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}
	if data.Role != roleAdmin {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only tenant admin can create subclients"}
	}

	license, err := getLicense(ctx)
	if err != nil {
		return nil, err
	}
	if !license.SubclientEnabled {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "subclient feature not enabled by license"}
	}

	ok, subclientEnabled, _, err := projectOwnedByTenant(ctx, p.ProjectID, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "project not found in tenant"}
	}
	if !subclientEnabled {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "subclient not enabled for this project"}
	}

	passwordHash, err := hashPassword(p.AdminPassword)
	if err != nil {
		return nil, err
	}

	subclientID := newID("sub")
	subDomain := normalizeHost(p.Domain)
	if subDomain == "" || subDomain == "*" {
		return nil, badRequest("subclient domain must be specific")
	}

	err = q().InsertSubclient(ctx, iamdb.InsertSubclientParams{
		ID:              subclientID,
		ProjectID:       p.ProjectID,
		Name:            p.Name,
		Domain:          subDomain,
		CreatedByUserID: data.UserID,
	})
	if err != nil {
		return nil, err
	}

	_, err = db.ExecContext(ctx, `
		INSERT INTO users (id, tenant_id, project_id, subclient_id, username, password_hash, role, source)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`,
		newID("usr"),
		data.TenantID,
		p.ProjectID,
		subclientID,
		p.AdminUsername,
		passwordHash,
		string(roleAdmin),
		"manual",
	)
	if err != nil {
		return nil, err
	}

	return &subclientResponse{
		ID:        subclientID,
		ProjectID: p.ProjectID,
		Name:      p.Name,
		Domain:    subDomain,
	}, nil
}

type subclientLoginParams struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Host     string `header:"Host"`
}

// SubclientLogin authenticates a subclient user/admin with cookie sessions.
//
//encore:api public method=POST path=/auth/subclient/login
func SubclientLogin(ctx context.Context, p *subclientLoginParams) (*authResponse, error) {
	if p == nil || p.Username == "" || p.Password == "" {
		return nil, badRequest("username and password are required")
	}

	host := normalizeHost(p.Host)
	if host == "" || host == "*" {
		return nil, badRequest("subclient login requires host header")
	}

	subclient, err := q().GetSubclientByDomain(ctx, host)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "subclient not found for host"}
		}
		return nil, err
	}

	user, err := q().GetSubclientUser(ctx, iamdb.GetSubclientUserParams{
		SubclientID: sql.NullString{String: subclient.ID, Valid: true},
		Username:     p.Username,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid credentials"}
		}
		return nil, err
	}

	userID := user.ID
	userRole := user.Role
	passwordHash := user.PasswordHash.String

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(p.Password)); err != nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid credentials"}
	}

	_, cookie, err := createSession(ctx, userID, scopeSubclient, subclient.ID, host)
	if err != nil {
		return nil, err
	}

	return &authResponse{
		SetCookie: cookie,
		UserID:    userID,
		Role:      userRole,
		ScopeType: string(scopeSubclient),
		ScopeID:   subclient.ID,
	}, nil
}

// SessionStatus returns currently authenticated session identity.
//
//encore:api auth method=GET path=/auth/session
func SessionStatus(ctx context.Context) (*sessionStatusResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*authData)
	if data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}

	return &sessionStatusResponse{
		UserID:      data.UserID,
		Role:        string(data.Role),
		ScopeType:   string(data.ScopeType),
		TenantID:    data.TenantID,
		ProjectID:   data.ProjectID,
		SubclientID: data.SubclientID,
	}, nil
}

type logoutResponse struct {
	SetCookie string `header:"Set-Cookie"`
	OK        bool   `json:"ok"`
}

// Logout invalidates the current session and clears the cookie.
//
//encore:api public method=POST path=/auth/logout
func Logout(ctx context.Context, p *authParams) (*logoutResponse, error) {
	if p != nil && p.SessionCookie != nil && p.SessionCookie.Value != "" {
		tokenHash := hashToken(p.SessionCookie.Value)
		_ = q().DeleteSession(ctx, tokenHash)
	}

	cookie := (&http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   encore.Meta().Environment.Type != "development",
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	}).String()

	return &logoutResponse{SetCookie: cookie, OK: true}, nil
}

// ListProjects returns projects for current tenant scope.
//
//encore:api auth method=GET path=/projects
func ListProjects(ctx context.Context) (*listProjectsResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*authData)
	if data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	projects, err := q().ListProjects(ctx, data.TenantID)
	if err != nil {
		return nil, err
	}

	out := make([]*projectResponse, len(projects))
	for i, p := range projects {
		out[i] = &projectResponse{
			ID:               p.ID,
			TenantID:         p.TenantID,
			Name:             p.Name,
			WhatsappEnabled:  p.WhatsappEnabled == 1,
			SubclientEnabled: p.SubclientEnabled == 1,
			CreatedByUserID:  p.CreatedByUserID,
			CreatedAt:        p.CreatedAt.Format(time.RFC3339),
		}
	}

	return &listProjectsResponse{Projects: out}, nil
}

type listSubclientsParams struct {
	ProjectID string `query:"project_id"`
}

// ListSubclients returns subclients for a project in current tenant.
//
//encore:api auth method=GET path=/subclients
func ListSubclients(ctx context.Context, p *listSubclientsParams) (*listSubclientsResponse, error) {
	if p == nil || p.ProjectID == "" {
		return nil, badRequest("project_id is required")
	}
	raw := auth.Data()
	data, _ := raw.(*authData)
	if data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	ok, _, _, err := projectOwnedByTenant(ctx, p.ProjectID, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "project not found in tenant"}
	}

	subclients, err := q().ListSubclients(ctx, p.ProjectID)
	if err != nil {
		return nil, err
	}

	out := make([]*subclientResponse, len(subclients))
	for i, s := range subclients {
		out[i] = &subclientResponse{
			ID:        s.ID,
			ProjectID: s.ProjectID,
			Name:      s.Name,
			Domain:    s.Domain,
		}
	}

	return &listSubclientsResponse{Subclients: out}, nil
}

type whatsappProvisionParams struct {
	ProjectID    string `json:"project_id"`
	PhoneNumber  string `json:"phone_number"`
	AsSubclient  bool   `json:"as_subclient"`
	SubclientID  string `json:"subclient_id"`
}

type whatsappProvisionResponse struct {
	UserID string `json:"user_id"`
}

// ProvisionWhatsappUser creates a user from an incoming WhatsApp chat event.
//
//encore:api auth method=POST path=/projects/whatsapp/provision-user
func ProvisionWhatsappUser(ctx context.Context, p *whatsappProvisionParams) (*whatsappProvisionResponse, error) {
	if p == nil || p.ProjectID == "" || p.PhoneNumber == "" {
		return nil, badRequest("project_id and phone_number are required")
	}

	raw := auth.Data()
	data, _ := raw.(*authData)
	if data == nil {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "auth required"}
	}

	license, err := getLicense(ctx)
	if err != nil {
		return nil, err
	}
	if !license.WhatsappEnabled {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "whatsapp feature not enabled by license"}
	}

	ok, _, whatsappEnabled, err := projectOwnedByTenant(ctx, p.ProjectID, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "project not found in tenant"}
	}
	if !whatsappEnabled {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "whatsapp is not enabled for this project"}
	}

	userID := newID("usr")
	username := normalizePhone(p.PhoneNumber)
	if username == "" {
		return nil, badRequest("invalid phone number")
	}

	subclientID := ""
	if p.AsSubclient {
		subclientID = p.SubclientID
	}

	subclientIDValue := sql.NullString{String: subclientID, Valid: subclientID != ""}
	err = q().UpsertWhatsappUser(ctx, iamdb.UpsertWhatsappUserParams{
		ID:        userID,
		TenantID:  sql.NullString{String: data.TenantID, Valid: true},
		ProjectID: sql.NullString{String: p.ProjectID, Valid: true},
		Username:  username,
		Role:      string(roleUser),
		Source:    "whatsapp",
	})
	_ = subclientIDValue // For subclient support in future
	if err != nil {
		return nil, err
	}

	return &whatsappProvisionResponse{UserID: userID}, nil
}

type license struct {
	MaxProjectsPerTenant int
	WhatsappEnabled      bool
	SubclientEnabled     bool
}

func getLicense(ctx context.Context) (*license, error) {
	row, err := q().GetLicense(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "license not installed"}
		}
		return nil, err
	}

	maxProjects := int(row.MaxProjectsPerTenant)
	if maxProjects <= 0 {
		maxProjects = 1
	}

	return &license{
		MaxProjectsPerTenant: maxProjects,
		WhatsappEnabled:      row.WhatsappEnabled == 1,
		SubclientEnabled:     row.SubclientEnabled == 1,
	}, nil
}

func isInstalled(ctx context.Context) (bool, error) {
	count, err := q().CountLicenses(ctx)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func verifyLicenseWithHub(ctx context.Context, key string) (*licenseVerifyResponse, error) {
	body, err := json.Marshal(map[string]string{"license_key": key})
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://hub.maldevta.com/api/license/verify", strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(request)
	if err != nil {
		return nil, &errs.Error{Code: errs.Unavailable, Message: "failed contacting license hub"}
	}
	defer resp.Body.Close()

	var out licenseVerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: "invalid response from license hub"}
	}

	if resp.StatusCode >= 400 {
		if out.Error == "" {
			out.Error = fmt.Sprintf("license hub rejected request (%d)", resp.StatusCode)
		}
		out.Valid = false
	}

	return &out, nil
}

func createSession(ctx context.Context, userID string, scope scopeType, scopeID, host string) (token string, setCookie string, err error) {
	token = newToken()
	tokenHash := hashToken(token)
	expiresAt := time.Now().UTC().Add(sessionTTL)
	sessionID := newID("ses")

	hostValue := sql.NullString{String: host, Valid: host != ""}
	err = q().InsertSession(ctx, iamdb.InsertSessionParams{
		ID:        sessionID,
		UserID:    userID,
		ScopeType: string(scope),
		ScopeID:   scopeID,
		TokenHash: tokenHash,
		Host:      hostValue,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return "", "", err
	}

	cookie := &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   encore.Meta().Environment.Type != "development",
		SameSite: http.SameSiteLaxMode,
		Expires:  expiresAt,
	}

	return token, cookie.String(), nil
}

func hashPassword(password string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

func findTenantUser(ctx context.Context, tenantID, username string) (userID, userRole, passwordHash string, err error) {
	user, err := q().GetTenantUser(ctx, iamdb.GetTenantUserParams{
		TenantID: sql.NullString{String: tenantID, Valid: true},
		Username:  username,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", "", &errs.Error{Code: errs.Unauthenticated, Message: "invalid credentials"}
		}
		return "", "", "", err
	}
	return user.ID, user.Role, user.PasswordHash.String, nil
}

func resolveTenantByHost(ctx context.Context, host string) (string, error) {
	host = normalizeHost(host)

	if host != "" && host != "*" {
		tenantID, err := q().GetTenantByDomain(ctx, host)
		if err == nil {
			return tenantID, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return "", err
		}
	}

	tenantID, err := q().GetDefaultTenant(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", &errs.Error{Code: errs.NotFound, Message: "tenant not found"}
		}
		return "", err
	}
	return tenantID, nil
}

func countProjectsForTenant(ctx context.Context, tenantID string) (int, error) {
	count, err := q().CountProjectsForTenant(ctx, tenantID)
	return int(count), err
}

func projectOwnedByTenant(ctx context.Context, projectID, tenantID string) (exists bool, subclientEnabled bool, whatsappEnabled bool, err error) {
	row, err := q().GetProjectByTenant(ctx, iamdb.GetProjectByTenantParams{
		ID:       projectID,
		TenantID: tenantID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, false, false, nil
		}
		return false, false, false, err
	}
	return true, row.SubclientEnabled == 1, row.WhatsappEnabled == 1, nil
}

func ensureTenantHost(ctx context.Context, tenantID, host string) error {
	domain, err := q().GetTenantByID(ctx, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &errs.Error{Code: errs.PermissionDenied, Message: "tenant not found"}
		}
		return err
	}
	if domain == "*" || domain == host {
		return nil
	}
	return &errs.Error{Code: errs.PermissionDenied, Message: "host not allowed for tenant"}
}

func ensureSubclientHost(ctx context.Context, subclientID, host string) error {
	domain, err := q().GetSubclientByID(ctx, subclientID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &errs.Error{Code: errs.PermissionDenied, Message: "subclient not found"}
		}
		return err
	}
	if domain == host {
		return nil
	}
	return &errs.Error{Code: errs.PermissionDenied, Message: "host not allowed for subclient"}
}

func hashToken(token string) string {
	s := sha256.Sum256([]byte(token))
	return hex.EncodeToString(s[:])
}

func runMigrations(ctx context.Context, db *sql.DB) error {
	// Check if migrations table exists
	var migrationTableExists int
	err := db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_migrations'
	`).Scan(&migrationTableExists)
	if err != nil {
		return fmt.Errorf("failed to check migrations table: %w", err)
	}

	// Create migrations table if it doesn't exist
	if migrationTableExists == 0 {
		if _, err := db.ExecContext(ctx, `
			CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)
		`); err != nil {
			return fmt.Errorf("failed to create migrations table: %w", err)
		}
	}

	// Get current migration version
	var currentVersion int
	err = db.QueryRowContext(ctx, `SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&currentVersion)
	if err != nil {
		return fmt.Errorf("failed to get current migration version: %w", err)
	}

	// Run pending migrations
	if currentVersion < 1 {
		if err := applyMigration(ctx, db, 1); err != nil {
			return err
		}
	}

	return nil
}

func applyMigration(ctx context.Context, db *sql.DB, version int) error {
	migrationSQL, err := readMigrationFile(version)
	if err != nil {
		return fmt.Errorf("failed to read migration file for version %d: %w", version, err)
	}

	// Convert PostgreSQL-specific syntax to SQLite
	sqlStr := string(migrationSQL)
	sqlStr = strings.ReplaceAll(sqlStr, "TIMESTAMPTZ", "TIMESTAMP")
	sqlStr = strings.ReplaceAll(sqlStr, "BOOLEAN", "INTEGER")
	sqlStr = strings.ReplaceAll(sqlStr, " NOW()", " CURRENT_TIMESTAMP")
	sqlStr = strings.ReplaceAll(sqlStr, "DEFAULT FALSE", "DEFAULT 0")
	sqlStr = strings.ReplaceAll(sqlStr, "DEFAULT TRUE", "DEFAULT 1")
	sqlStr = strings.ReplaceAll(sqlStr, "= TRUE", "= 1")
	sqlStr = strings.ReplaceAll(sqlStr, "= FALSE", "= 0")

	sqlStr = strings.ReplaceAll(sqlStr, "REFERENCES tenants(id) ON DELETE CASCADE", "REFERENCES tenants(id) ON DELETE CASCADE")
	sqlStr = strings.ReplaceAll(sqlStr, "REFERENCES users(id) ON DELETE CASCADE", "REFERENCES users(id) ON DELETE CASCADE")
	sqlStr = strings.ReplaceAll(sqlStr, "REFERENCES projects(id) ON DELETE CASCADE", "REFERENCES projects(id) ON DELETE CASCADE")
	sqlStr = strings.ReplaceAll(sqlStr, "REFERENCES subclients(id) ON DELETE CASCADE", "REFERENCES subclients(id) ON DELETE CASCADE")

	// Enable foreign keys
	if _, err := db.ExecContext(ctx, `PRAGMA foreign_keys = ON`); err != nil {
		return fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	// Execute migration
	if _, err := db.ExecContext(ctx, sqlStr); err != nil {
		return fmt.Errorf("failed to apply migration %d: %w", version, err)
	}

	// Record migration
	if _, err := db.ExecContext(ctx, `INSERT INTO schema_migrations (version) VALUES (?)`, version); err != nil {
		return fmt.Errorf("failed to record migration %d: %w", version, err)
	}

	return nil
}

func readMigrationFile(version int) ([]byte, error) {
	fileName := fmt.Sprintf("%d_init.up.sql", version)
	candidates := []string{
		filepath.Join("sqlite_migrations", fileName),
		filepath.Join("backend", "iam", "sqlite_migrations", fileName),
		filepath.Join("apps", "backend", "iam", "sqlite_migrations", fileName),
	}

	for _, candidate := range candidates {
		migrationSQL, err := os.ReadFile(candidate)
		if err == nil {
			return migrationSQL, nil
		}
		if !os.IsNotExist(err) {
			return nil, err
		}
	}

	return nil, os.ErrNotExist
}

func normalizeHost(host string) string {
	host = strings.TrimSpace(strings.ToLower(host))
	host = strings.TrimPrefix(host, "http://")
	host = strings.TrimPrefix(host, "https://")
	if idx := strings.Index(host, ":"); idx > 0 {
		host = host[:idx]
	}
	if host == "" {
		return ""
	}
	return host
}

func toString(value interface{}) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case []byte:
		return string(v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

func normalizePhone(phone string) string {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return ""
	}
	buf := strings.Builder{}
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			buf.WriteRune(r)
		}
	}
	if buf.Len() < 6 {
		return ""
	}
	return buf.String()
}

func badRequest(msg string) error {
	return &errs.Error{Code: errs.InvalidArgument, Message: msg}
}

func newToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func newID(prefix string) string {
	b := make([]byte, 10)
	_, _ = rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}