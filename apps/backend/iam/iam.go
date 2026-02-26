package iam

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
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
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"

	iamdb "encore.app/backend/iam/db"
)

// SQLite database setup - runs migrations on startup
func setupSQLite(ctx context.Context) (*sql.DB, error) {
	// Get data directory from environment variable
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		// Default: store in root directory of the binary
		exePath, err := os.Executable()
		if err != nil {
			return nil, fmt.Errorf("failed to get executable path: %w", err)
		}
		dataDir = filepath.Join(filepath.Dir(exePath), "data")
	}

	// Create data directory if it doesn't exist
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	dbPath := filepath.Join(dataDir, "iam.db")
	fmt.Printf("[setupSQLite] Database path: %s\n", dbPath)
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	fmt.Printf("[setupSQLite] Database opened, checking if file exists...\n")
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		fmt.Printf("[setupSQLite] WARNING: Database file does not exist yet after sql.Open\n")
	} else {
		fmt.Printf("[setupSQLite] Database file exists\n")
	}

	// Run migrations
	if err := runMigrations(ctx, db); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

var db *sql.DB

// GetDB exports the database instance for other services to use
func GetDB() (*sql.DB, error) {
	return db, nil
}

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
	roleSystem role = "system"
	roleAdmin  role = "admin"
	roleUser   role = "user"
)

type scopeType string

const (
	scopeTenant    scopeType = "tenant"
	scopeSubclient scopeType = "subclient"
	scopeSystem    scopeType = "system"
)

// AuthData contains the authenticated user's session information
type AuthData struct {
	UserID      string
	Role        role
	TenantID    string
	ProjectID   string
	SubclientID string
	ScopeType   scopeType
	ScopeID     string
	Username    string
}

type authParams struct {
	SessionCookie *http.Cookie `cookie:"aicore_session"`
	Host          string       `header:"Host"`
}

type licenseVerifyResponse struct {
	Valid                bool   `json:"valid"`
	TenantName           string `json:"tenant_name"`
	MaxProjectsPerTenant int    `json:"max_projects_per_tenant"`
	WhatsappEnabled      bool   `json:"whatsapp_enabled"`
	SubclientEnabled     bool   `json:"subclient_enabled"`
	Error                string `json:"error"`
}

//encore:authhandler
func AuthHandler(ctx context.Context, p *authParams) (auth.UID, *AuthData, error) {
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
		// Skip host validation in development mode
		if encore.Meta().Environment.Type != "development" {
			if err := ensureTenantHost(ctx, session.ScopeID, host); err != nil {
				return "", nil, err
			}
		}
	}

	if session.ScopeType == string(scopeSubclient) {
		if err := ensureSubclientHost(ctx, session.ScopeID, host); err != nil {
			return "", nil, err
		}
	}

	data := &AuthData{
		UserID:      session.UserID,
		Role:        role(user.Role),
		TenantID:    toString(user.TenantID),
		ProjectID:   toString(user.ProjectID),
		SubclientID: toString(user.SubclientID),
		ScopeType:   scopeType(session.ScopeType),
		ScopeID:     session.ScopeID,
		Username:    user.Username,
	}

	return auth.UID(session.UserID), data, nil
}

type installParams struct {
	LicenseKey     string `json:"license_key"`
	TenantName     string `json:"tenant_name"`
	TenantDomain   string `json:"tenant_domain"`
	AdminUsername  string `json:"admin_username"`
	AdminPassword  string `json:"admin_password"`
	SystemUsername string `json:"system_username"`
	SystemPassword string `json:"system_password"`
	Host           string `header:"Host"`
}

type authResponse struct {
	SetCookie string `header:"Set-Cookie"`
	UserID    string `json:"user_id"`
	Role      string `json:"role"`
	ScopeType string `json:"scope_type"`
	ScopeID   string `json:"scope_id"`
	Username  string `json:"username"`
}

type sessionStatusResponse struct {
	UserID      string `json:"user_id"`
	Role        string `json:"role"`
	ScopeType   string `json:"scope_type"`
	TenantID    string `json:"tenant_id"`
	ProjectID   string `json:"project_id"`
	SubclientID string `json:"subclient_id"`
	Username    string `json:"username"`
}

// InstallStatus checks if the application has already been installed.
// Frontend uses this to decide whether to show setup wizard or login page.
//
//encore:api public method=GET path=/auth/install-status
func InstallStatus(ctx context.Context) (*installStatusResponse, error) {
	installed, err := isInstalled(ctx)
	if err != nil {
		return nil, err
	}
	return &installStatusResponse{
		Installed:   installed,
		Environment: string(encore.Meta().Environment.Type),
	}, nil
}

type installStatusResponse struct {
	Installed   bool   `json:"installed"`
	Environment string `json:"environment"`
}

// ResetInstall resets the entire install — drops all licenses, tenants, users, sessions.
// WARNING: This is destructive and only works in development mode.
//
//encore:api public method=POST path=/auth/reset-install
func ResetInstall(ctx context.Context) (*installStatusResponse, error) {
	// Safety: only in development
	if encore.Meta().Environment.Type != "development" {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "reset only available in development mode"}
	}

	fmt.Println("[RESET] ── Resetting installation... ──")

	tables := []string{"sessions", "users", "tenants", "licenses"}
	for _, t := range tables {
		_, err := db.ExecContext(ctx, "DELETE FROM "+t)
		if err != nil {
			fmt.Printf("[RESET] ✗ failed to clear table %s: %v\n", t, err)
			// Continue even if one table fails (it might not exist yet)
		} else {
			fmt.Printf("[RESET] ✓ cleared table %s\n", t)
		}
	}

	fmt.Println("[RESET] ── Installation reset complete ──")

	return &installStatusResponse{
		Installed:   false,
		Environment: string(encore.Meta().Environment.Type),
	}, nil
}

// Install verifies the license and bootstraps the initial global system user.
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
		tenantName = "Unassigned"
	}

	systemUsername := strings.TrimSpace(p.SystemUsername)
	if systemUsername == "" {
		systemUsername = strings.TrimSpace(p.AdminUsername)
	}
	if systemUsername == "" {
		systemUsername = "system"
	}
	systemPassword := p.SystemPassword
	if systemPassword == "" {
		systemPassword = p.AdminPassword
	}
	if systemPassword == "" {
		systemPassword = p.LicenseKey
	}
	systemHash, err := hashPassword(systemPassword)
	if err != nil {
		return nil, err
	}

	licenseID := newID("lic")
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
		ID:                   licenseID,
		LicenseKey:           p.LicenseKey,
		MaxProjectsPerTenant: int64(verified.MaxProjectsPerTenant),
		WhatsappEnabled:      whatsappEnabled,
		SubclientEnabled:     subclientEnabled,
		TenantName:           tenantName,
	})
	if err != nil {
		return nil, err
	}

	err = q().InsertUser(ctx, iamdb.InsertUserParams{
		ID:           userID,
		TenantID:     sql.NullString{},
		Username:     systemUsername,
		PasswordHash: sql.NullString{String: systemHash, Valid: true},
		Role:         string(roleSystem),
		Source:       "manual",
	})
	if err != nil {
		return nil, err
	}

	token, cookie, err := createSession(ctx, userID, scopeSystem, userID, normalizeHost(p.Host))
	if err != nil {
		return nil, err
	}

	_ = token
	return &authResponse{
		SetCookie: cookie,
		UserID:    userID,
		Role:      string(roleSystem),
		ScopeType: string(scopeSystem),
		ScopeID:   userID,
		Username:  systemUsername,
	}, nil
}

// VerifyLicense verifies a license key without installing it.
// This endpoint can be called multiple times for validation purposes.
//
//encore:api public method=POST path=/auth/verify-license
func VerifyLicense(ctx context.Context, p *verifyLicenseParams) (*licenseVerifyResult, error) {
	fmt.Println("[LICENSE] ── POST /auth/verify-license called ──")

	if p == nil || p.LicenseKey == "" {
		fmt.Println("[LICENSE] ✗ missing license_key in request body")
		return nil, badRequest("license_key is required")
	}

	verified, err := verifyLicenseWithHub(ctx, p.LicenseKey)
	if err != nil {
		fmt.Printf("[LICENSE] ✗ verification error: %v\n", err)
		return nil, err
	}

	fmt.Printf("[LICENSE] ── result: valid=%v ──\n", verified.Valid)

	return &licenseVerifyResult{
		Valid:                verified.Valid,
		TenantName:           verified.TenantName,
		MaxProjectsPerTenant: verified.MaxProjectsPerTenant,
		WhatsappEnabled:      verified.WhatsappEnabled,
		SubclientEnabled:     verified.SubclientEnabled,
		Error:                verified.Error,
	}, nil
}

type verifyLicenseParams struct {
	LicenseKey string `json:"license_key"`
}

type licenseVerifyResult struct {
	Valid                bool   `json:"valid"`
	TenantName           string `json:"tenant_name,omitempty"`
	MaxProjectsPerTenant int    `json:"max_projects_per_tenant,omitempty"`
	WhatsappEnabled      bool   `json:"whatsapp_enabled,omitempty"`
	SubclientEnabled     bool   `json:"subclient_enabled,omitempty"`
	Error                string `json:"error,omitempty"`
}

type setupVerifyLicenseParams struct {
	LicenseKey string `json:"license_key"`
}

type setupVerifyLicenseResponse struct {
	Valid                bool   `json:"valid"`
	TenantName           string `json:"tenant_name"`
	MaxProjectsPerTenant int    `json:"max_projects_per_tenant"`
	WhatsappEnabled      bool   `json:"whatsapp_enabled"`
	SubclientEnabled     bool   `json:"subclient_enabled"`
}

// SetupVerifyLicense verifies a license key during setup wizard.
//
//encore:api public method=POST path=/auth/setup/verify-license
func SetupVerifyLicense(ctx context.Context, p *setupVerifyLicenseParams) (*setupVerifyLicenseResponse, error) {
	if p == nil || p.LicenseKey == "" {
		return nil, badRequest("license_key is required")
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

	return &setupVerifyLicenseResponse{
		Valid:                verified.Valid,
		TenantName:           verified.TenantName,
		MaxProjectsPerTenant: verified.MaxProjectsPerTenant,
		WhatsappEnabled:      verified.WhatsappEnabled,
		SubclientEnabled:     verified.SubclientEnabled,
	}, nil
}

type setupCreateTenantParams struct {
	LicenseKey string `json:"license_key"`
	Name       string `json:"name"`
	Domain     string `json:"domain"`
}

type setupCreateTenantResponse struct {
	TenantID string `json:"tenant_id"`
	Name     string `json:"name"`
}

// SetupCreateTenant creates a tenant during setup wizard.
//
//encore:api public method=POST path=/auth/setup/tenant
func SetupCreateTenant(ctx context.Context, p *setupCreateTenantParams) (*setupCreateTenantResponse, error) {
	if p == nil || p.LicenseKey == "" {
		return nil, badRequest("license_key is required")
	}
	if p.Name == "" {
		return nil, badRequest("tenant name is required")
	}

	// Verify license again to ensure security
	verified, err := verifyLicenseWithHub(ctx, p.LicenseKey)
	if err != nil {
		return nil, err
	}
	if !verified.Valid {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "invalid license"}
	}

	// Create tenant
	tenantID := newID("tnt")
	domain := normalizeHost(p.Domain)
	if domain == "" {
		// Generate unique domain from tenant ID if not provided
		domain = "tenant-" + tenantID
	}
	err = q().InsertTenant(ctx, iamdb.InsertTenantParams{
		ID:     tenantID,
		Name:   strings.TrimSpace(p.Name),
		Domain: domain,
	})
	if err != nil {
		return nil, err
	}

	// Create necessary directories
	if err := os.MkdirAll(filepath.Join("data", "tenants", tenantID), 0755); err != nil {
		fmt.Printf("Warning: failed to create tenant directory: %v\n", err)
	}

	return &setupCreateTenantResponse{
		TenantID: tenantID,
		Name:     p.Name,
	}, nil
}

type setupCreateAdminParams struct {
	LicenseKey string `json:"license_key"`
	TenantID   string `json:"tenant_id"`
	Username   string `json:"username"`
	Email      string `json:"email"`
	Password   string `json:"password"`
}

type setupCreateAdminResponse struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}

// SetupCreateAdmin creates an admin user during setup wizard.
//
//encore:api public method=POST path=/auth/setup/admin
func SetupCreateAdmin(ctx context.Context, p *setupCreateAdminParams) (*setupCreateAdminResponse, error) {
	if p == nil || p.LicenseKey == "" {
		return nil, badRequest("license_key is required")
	}
	if p.Username == "" || p.Password == "" {
		return nil, badRequest("username and password are required")
	}

	// Verify license
	verified, err := verifyLicenseWithHub(ctx, p.LicenseKey)
	if err != nil {
		return nil, err
	}
	if !verified.Valid {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "invalid license"}
	}

	passwordHash, err := hashPassword(p.Password)
	if err != nil {
		return nil, err
	}

	userID := newID("usr")
	now := time.Now().UTC()
	err = q().CreateUser(ctx, iamdb.CreateUserParams{
		ID:           userID,
		// First setup user is global system user (not tenant-bound),
		// so it can authenticate from any host.
		TenantID:     sql.NullString{},
		Username:     p.Username,
		Email:        sql.NullString{String: p.Email, Valid: p.Email != ""},
		PasswordHash: sql.NullString{String: passwordHash, Valid: true},
		Role:         string(roleSystem),
		Source:       "manual",
		CreatedAt:    now,
		UpdatedAt:    now.Unix(), // CreateUser query uses INTEGER or DATETIME?
	})
	// Wait, schema says created_at DATETIME, query says updated_at ?
	// Let's check schema.sql for updated_at type in users table.
	// Step 31: line 11: ALTER TABLE users ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
	// So updated_at is INTEGER (likely unix timestamp).
	// created_at is DATETIME.

	if err != nil {
		return nil, err
	}

	return &setupCreateAdminResponse{
		UserID:   userID,
		Username: p.Username,
	}, nil
}

type setupCreateTenantAdminParams struct {
	LicenseKey string `json:"license_key"`
	TenantID   string `json:"tenant_id"`
	Username   string `json:"username"`
	Password   string `json:"password"`
}

type setupCreateTenantAdminResponse struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}

// SetupCreateTenantAdmin creates a tenant-bound admin user during setup wizard.
//
//encore:api public method=POST path=/auth/setup/tenant-admin
func SetupCreateTenantAdmin(ctx context.Context, p *setupCreateTenantAdminParams) (*setupCreateTenantAdminResponse, error) {
	if p == nil || p.LicenseKey == "" {
		return nil, badRequest("license_key is required")
	}
	if p.TenantID == "" {
		return nil, badRequest("tenant_id is required")
	}
	if p.Username == "" || p.Password == "" {
		return nil, badRequest("username and password are required")
	}

	// Verify license
	verified, err := verifyLicenseWithHub(ctx, p.LicenseKey)
	if err != nil {
		return nil, err
	}
	if !verified.Valid {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "invalid license"}
	}

	// Verify tenant exists
	tenant, err := q().GetTenantDetail(ctx, p.TenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "tenant not found"}
		}
		return nil, err
	}

	passwordHash, err := hashPassword(p.Password)
	if err != nil {
		return nil, err
	}

	userID := newID("usr")
	now := time.Now().UTC()
	err = q().CreateUser(ctx, iamdb.CreateUserParams{
		ID:           userID,
		TenantID:     sql.NullString{String: tenant.ID, Valid: true},
		Username:     p.Username,
		Email:        sql.NullString{},
		PasswordHash: sql.NullString{String: passwordHash, Valid: true},
		Role:         string(roleAdmin),
		Source:       "manual",
		CreatedAt:    now,
		UpdatedAt:    now.Unix(),
	})

	if err != nil {
		return nil, err
	}

	return &setupCreateTenantAdminResponse{
		UserID:   userID,
		Username: p.Username,
	}, nil
}

type setupCompleteParams struct {
	LicenseKey string `json:"license_key"`
	TenantID   string `json:"tenant_id"` // Optional, to verify it exists
	UserID     string `json:"user_id"`   // The admin user to log in as
}

// SetupComplete finalizes the setup by saving the license and logging in.
//
//encore:api public method=POST path=/auth/setup/complete
func SetupComplete(ctx context.Context, p *setupCompleteParams) (*authResponse, error) {
	if p == nil || p.LicenseKey == "" {
		return nil, badRequest("license_key is required")
	}

	// Check if already installed to prevent re-setup
	installed, err := isInstalled(ctx)
	if err != nil {
		return nil, err
	}
	if installed {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "already installed"}
	}

	verified, err := verifyLicenseWithHub(ctx, p.LicenseKey)
	if err != nil {
		return nil, err
	}
	if !verified.Valid {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "invalid license"}
	}

	// Verify user exists using GetUserDetail which returns full info
	user, err := q().GetUserDetail(ctx, p.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "admin user not found"}
		}
		return nil, err
	}

	// Save license to mark as installed
	licenseID := newID("lic")
	whatsappEnabled := int64(0)
	if verified.WhatsappEnabled {
		whatsappEnabled = 1
	}
	subclientEnabled := int64(0)
	if verified.SubclientEnabled {
		subclientEnabled = 1
	}

	err = q().InsertLicense(ctx, iamdb.InsertLicenseParams{
		ID:                   licenseID,
		LicenseKey:           p.LicenseKey,
		MaxProjectsPerTenant: int64(verified.MaxProjectsPerTenant),
		WhatsappEnabled:      whatsappEnabled,
		SubclientEnabled:     subclientEnabled,
		TenantName:           verified.TenantName,
	})
	if err != nil {
		return nil, err
	}

	// Create session for the verified user
	// If the user belongs to a tenant, the session scope should be tenant
	scopeType := scopeTenant
	scopeID := user.TenantID.String
	if !user.TenantID.Valid {
		// Fallback, though setup wizard should have created tenant user
		scopeType = scopeSystem
		scopeID = user.ID
	}

	token, cookie, err := createSession(ctx, user.ID, scopeType, scopeID, "setup-wizard")
	if err != nil {
		return nil, err
	}

	_ = token
	return &authResponse{
		SetCookie: cookie,
		UserID:    user.ID,
		Role:      user.Role,
		ScopeType: string(scopeType),
		ScopeID:   scopeID,
		Username:  user.Username,
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

	systemUserID, systemRole, systemHash, systemErr := findSystemUser(ctx, p.Username)
	if systemErr == nil {
		if err := bcrypt.CompareHashAndPassword([]byte(systemHash), []byte(p.Password)); err != nil {
			return nil, &errs.Error{Code: errs.Unauthenticated, Message: "invalid credentials"}
		}

		_, cookie, err := createSession(ctx, systemUserID, scopeSystem, systemUserID, normalizeHost(p.Host))
		if err != nil {
			return nil, err
		}

		return &authResponse{
			SetCookie: cookie,
			UserID:    systemUserID,
			Role:      systemRole,
			ScopeType: string(scopeSystem),
			ScopeID:   systemUserID,
			Username:  p.Username,
		}, nil
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
		Username:  p.Username,
	}, nil
}

type createProjectParams struct {
	Name             string `json:"name"`
	EnableWhatsapp   bool   `json:"enable_whatsapp"`
	EnableSubclients bool   `json:"enable_subclients"`
}

type projectResponse struct {
	ID                               string   `json:"id"`
	TenantID                         string   `json:"tenant_id"`
	Name                             string   `json:"name"`
	WhatsappEnabled                  bool     `json:"whatsapp_enabled"`
	SubclientEnabled                 bool     `json:"subclient_enabled"`
	SubClientsEnabled                bool     `json:"sub_clients_enabled"` // Alias for frontend compatibility
	SubclientRegistrationEnabled     bool     `json:"subclient_registration_enabled"`
	SubClientsRegistrationEnabled    bool     `json:"sub_clients_registration_enabled"` // Alias for frontend compatibility
	CreatedByUserID                  string   `json:"created_by_user_id"`
	CreatedAt                        string   `json:"created_at"`
	ShowHistory                      bool     `json:"show_history"`
	UseClientUID                     bool     `json:"use_client_uid"`
	AllowedOrigins                   []string `json:"allowed_origins"`
	ContextRole                      string   `json:"context_role"`
}

type listProjectsResponse struct {
	Projects []*projectResponse `json:"projects"`
}

type RenameProjectParams struct {
	Name string `json:"name" validate:"min=1"`
}

// CreateProject creates a tenant-level shared project (admin only).
//
//encore:api auth method=POST path=/projects
func CreateProject(ctx context.Context, p *createProjectParams) (*projectResponse, error) {
	if p == nil || strings.TrimSpace(p.Name) == "" {
		return nil, badRequest("project name is required")
	}

	raw := auth.Data()
	data, _ := raw.(*AuthData)
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

	// Initialize project directory structure
	if err := ensureProjectDirs(data.TenantID, projectID); err != nil {
		return nil, fmt.Errorf("failed to initialize project directories: %w", err)
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

// RenameProject updates the name of a project.
//
//encore:api auth method=PATCH path=/projects/:projectId
func RenameProject(ctx context.Context, projectId string, p *RenameProjectParams) error {
	fmt.Printf("RenameProject: ID=%s payload=%+v\n", projectId, p)
	if p == nil || strings.TrimSpace(p.Name) == "" {
		return &errs.Error{Code: errs.InvalidArgument, Message: "project name is required"}
	}

	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil || data.ScopeType != scopeTenant {
		return &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return err
	}
	if !ok {
		return &errs.Error{Code: errs.PermissionDenied, Message: "project not found"}
	}

	return q().UpdateProject(ctx, iamdb.UpdateProjectParams{
		ID:       projectId,
		TenantID: data.TenantID,
		Name:     strings.TrimSpace(p.Name),
	})
}

// DeleteProject deletes a project and all its sub-resources (admin only).
//
//encore:api auth method=DELETE path=/projects/:projectId
func DeleteProject(ctx context.Context, projectId string) error {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil || data.ScopeType != scopeTenant {
		return &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}
	if data.Role != roleAdmin {
		return &errs.Error{Code: errs.PermissionDenied, Message: "only tenant admin can delete projects"}
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return err
	}
	if !ok {
		return &errs.Error{Code: errs.PermissionDenied, Message: "project not found"}
	}

	return q().DeleteProject(ctx, iamdb.DeleteProjectParams{
		ID:       projectId,
		TenantID: data.TenantID,
	})
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
	data, _ := raw.(*AuthData)
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

	// Initialize subclient directory structure
	if err := ensureSubclientDirs(data.TenantID, p.ProjectID, subclientID); err != nil {
		return nil, fmt.Errorf("failed to initialize subclient directories: %w", err)
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
		Username:    p.Username,
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
		Username:  p.Username,
	}, nil
}

// SessionStatus returns currently authenticated session identity.
//
//encore:api auth method=GET path=/auth/session
func SessionStatus(ctx context.Context) (*sessionStatusResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
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
		Username:    data.Username,
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
	data, _ := raw.(*AuthData)
	if data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	projects, err := q().ListProjects(ctx, data.TenantID)
	if err != nil {
		return nil, err
	}

	out := make([]*projectResponse, len(projects))
	for i, p := range projects {
		// Get context_role and subclient_registration_enabled for each project
		var contextRole string
		var subclientRegistrationEnabled int64 = 1 // Default to enabled
		_ = db.QueryRowContext(ctx, "SELECT COALESCE(context_role, 'general'), COALESCE(subclient_registration_enabled, 1) FROM projects WHERE id = ?", p.ID).Scan(&contextRole, &subclientRegistrationEnabled)
		if contextRole == "" {
			contextRole = "general"
		}

		out[i] = &projectResponse{
			ID:                            p.ID,
			TenantID:                      p.TenantID,
			Name:                          p.Name,
			WhatsappEnabled:               p.WhatsappEnabled == 1,
			SubclientEnabled:              p.SubclientEnabled == 1,
			SubClientsEnabled:             p.SubclientEnabled == 1, // Same value, different field name
			SubclientRegistrationEnabled:  subclientRegistrationEnabled == 1,
			SubClientsRegistrationEnabled: subclientRegistrationEnabled == 1, // Same value, different field name
			CreatedByUserID:               p.CreatedByUserID,
			CreatedAt:                     p.CreatedAt.Format(time.RFC3339),
			ShowHistory:                   false,      // Default value
			UseClientUID:                  false,      // Default value
			AllowedOrigins:                []string{}, // Default value
			ContextRole:                   contextRole,
		}
	}

	return &listProjectsResponse{Projects: out}, nil
}

// GetProject retrieves a single project by ID.
//
//encore:api auth method=GET path=/projects/:projectId
func GetProject(ctx context.Context, projectId string) (*projectResponseWrapper, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Query project with all fields including subclient_registration_enabled
	var allowedOriginsStr sql.NullString
	var subclientRegistrationEnabled int64
	project, err := q().GetProject(ctx, iamdb.GetProjectParams{
		ID:       projectId,
		TenantID: data.TenantID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
		}
		return nil, err
	}

	// Get additional fields that might not be in the model yet
	err = db.QueryRowContext(ctx, `
		SELECT allowed_origins, COALESCE(subclient_registration_enabled, 1)
		FROM projects WHERE id = ? AND tenant_id = ?
	`, projectId, data.TenantID).Scan(&allowedOriginsStr, &subclientRegistrationEnabled)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		// If column doesn't exist yet, use default value
		subclientRegistrationEnabled = 1
	}

	// Parse allowed_origins from comma-separated string
	var allowedOrigins []string
	if allowedOriginsStr.Valid {
		origins := strings.Split(allowedOriginsStr.String, ",")
		for _, origin := range origins {
			trimmed := strings.TrimSpace(origin)
			if trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
	}

	return &projectResponseWrapper{
		Success: true,
		Data: &projectResponse{
			ID:                            project.ID,
			TenantID:                      project.TenantID,
			Name:                          project.Name,
			WhatsappEnabled:               project.WhatsappEnabled == 1,
			SubclientEnabled:              project.SubclientEnabled == 1,
			SubClientsEnabled:             project.SubclientEnabled == 1, // Same value, different field name
			SubclientRegistrationEnabled:  subclientRegistrationEnabled == 1,
			SubClientsRegistrationEnabled: subclientRegistrationEnabled == 1, // Same value, different field name
			CreatedByUserID:               project.CreatedByUserID,
			CreatedAt:                     project.CreatedAt.Format(time.RFC3339),
			ShowHistory:                   project.ShowHistory == 1,
			UseClientUID:                  project.UseClientUid == 1,
			AllowedOrigins:                allowedOrigins,
		},
	}, nil
}

type projectResponseWrapper struct {
	Success bool             `json:"success"`
	Data    *projectResponse `json:"data"`
}

type updateProjectParams struct {
	ShowHistory                      bool     `json:"show_history"`
	UseClientUID                     bool     `json:"use_client_uid"`
	AllowedOrigins                   []string `json:"allowed_origins"`
	SubClientsEnabled                bool     `json:"sub_clients_enabled"`
	SubClientsRegistrationEnabled    bool     `json:"sub_clients_registration_enabled"`
}

// UpdateProjectSettings updates project embed settings.
//
//encore:api auth method=PUT path=/projects/:projectId
func UpdateProjectSettings(ctx context.Context, projectId string, p *updateProjectParams) (*successResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "project not found"}
	}

	// Convert allowed_origins array to comma-separated string
	allowedOriginsStr := ""
	if len(p.AllowedOrigins) > 0 {
		allowedOriginsStr = strings.Join(p.AllowedOrigins, ",")
	}

	showHistory := int64(0)
	if p.ShowHistory {
		showHistory = 1
	}

	useClientUID := int64(0)
	if p.UseClientUID {
		useClientUID = 1
	}

	subClientsEnabled := int64(0)
	if p.SubClientsEnabled {
		subClientsEnabled = 1
	}

	subClientsRegistrationEnabled := int64(1)
	if !p.SubClientsRegistrationEnabled {
		subClientsRegistrationEnabled = 0
	}

	// Update project settings including sub-client settings
	// Try with subclient_registration_enabled first
	_, err = db.ExecContext(ctx, `
		UPDATE projects
		SET show_history = ?, use_client_uid = ?, allowed_origins = ?, subclient_enabled = ?, subclient_registration_enabled = ?
		WHERE id = ? AND tenant_id = ?
	`, showHistory, useClientUID, allowedOriginsStr, subClientsEnabled, subClientsRegistrationEnabled, projectId, data.TenantID)

	// If the column doesn't exist (older databases), try without it
	if err != nil && strings.Contains(err.Error(), "no such column") {
		_, err = db.ExecContext(ctx, `
			UPDATE projects
			SET show_history = ?, use_client_uid = ?, allowed_origins = ?, subclient_enabled = ?
			WHERE id = ? AND tenant_id = ?
		`, showHistory, useClientUID, allowedOriginsStr, subClientsEnabled, projectId, data.TenantID)
	}

	if err != nil {
		return nil, err
	}

	return &successResponse{Success: true}, nil
}

type successResponse struct {
	Success bool `json:"success"`
}

// GetEmbedCSS retrieves custom CSS for a project.
//
//encore:api auth method=GET path=/projects/:projectId/embed/css
func GetEmbedCSS(ctx context.Context, projectId string) (*embedCSSResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "project not found"}
	}

	css, err := q().GetEmbedCSS(ctx, projectId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// No CSS saved yet, return empty
			return &embedCSSResponse{
				Success: true,
				Data: &embedCSSData{
					CustomCSS: "",
				},
			}, nil
		}
		return nil, err
	}

	return &embedCSSResponse{
		Success: true,
		Data: &embedCSSData{
			CustomCSS: css,
		},
	}, nil
}

type embedCSSResponse struct {
	Success bool          `json:"success"`
	Data    *embedCSSData `json:"data"`
}

type embedCSSData struct {
	CustomCSS string `json:"customCss"`
}

type saveEmbedCSSParams struct {
	CustomCSS string `json:"customCss"`
}

// SaveEmbedCSS saves custom CSS for a project.
//
//encore:api auth method=POST path=/projects/:projectId/embed/css
func SaveEmbedCSS(ctx context.Context, projectId string, p *saveEmbedCSSParams) (*successResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "project not found"}
	}

	// Validate CSS size (max 10KB)
	if len(p.CustomCSS) > 10240 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "custom CSS exceeds maximum size of 10KB"}
	}

	_, err = q().UpsertEmbedCSS(ctx, iamdb.UpsertEmbedCSSParams{
		ProjectID: projectId,
		CustomCss: p.CustomCSS,
	})
	if err != nil {
		return nil, err
	}

	return &successResponse{Success: true}, nil
}

// ============================================================================
// Project Sub-Clients Management
// ============================================================================

// SubClientUser represents a user in a sub-client
type SubClientUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

// SubClientDetail represents a detailed sub-client
type SubClientDetail struct {
	ID                   string          `json:"id"`
	ProjectID            string          `json:"project_id"`
	Name                 string          `json:"name"`
	Description          string          `json:"description"`
	ShortID              string          `json:"short_id"`
	Pathname             string          `json:"pathname"`
	RegistrationEnabled  bool            `json:"registration_enabled"`
	Suspended            bool            `json:"suspended"`
	WhatsappClientID     string          `json:"whatsapp_client_id"`
	Users                []SubClientUser `json:"users"`
	CreatedAt            int64           `json:"created_at"`
	UpdatedAt            int64           `json:"updated_at"`
}

type listProjectSubClientsResponse struct {
	Success bool                `json:"success"`
	Data    *listSubClientsData `json:"data"`
}

type listSubClientsData struct {
	SubClients []SubClientDetail `json:"subClients"`
	Enabled    bool              `json:"enabled"`
}

// ListProjectSubClients returns sub-clients for a project.
// API path: /projects/:projectId/sub-clients
//
//encore:api auth method=GET path=/projects/:projectId/sub-clients
func ListProjectSubClients(ctx context.Context, projectId string) (*listProjectSubClientsResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	// Get project to check if sub-clients are enabled
	project, err := q().GetProject(ctx, iamdb.GetProjectParams{
		ID:       projectId,
		TenantID: data.TenantID,
	})
	if err != nil {
		return nil, err
	}

	// Get sub-clients
	subclients, err := getProjectSubClients(ctx, projectId)
	if err != nil {
		return nil, err
	}

	return &listProjectSubClientsResponse{
		Success: true,
		Data: &listSubClientsData{
			SubClients: subclients,
			Enabled:    project.SubclientEnabled == 1,
		},
	}, nil
}

type createSubClientRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type createSubClientResponse struct {
	Success bool                `json:"success"`
	Data    *createSubClientData `json:"data"`
}

type createSubClientData struct {
	SubClient SubClientDetail `json:"subClient"`
}

// CreateProjectSubClient creates a new sub-client for a project.
// API path: /projects/:projectId/sub-clients
//
//encore:api auth method=POST path=/projects/:projectId/sub-clients
func CreateProjectSubClient(ctx context.Context, projectId string, p *createSubClientRequest) (*createSubClientResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}

	if p == nil || strings.TrimSpace(p.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "name is required"}
	}

	// Verify project exists and belongs to tenant
	ok, subClientEnabled, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}
	if !subClientEnabled {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "sub-clients not enabled for this project"}
	}

	// Generate sub-client ID
	subClientID := newID("scl")

	// Generate short ID (4 characters)
	shortID := generateShortID()

	// Generate pathname from name
	pathname := generatePathname(p.Name)

	now := time.Now().Unix()

	// Insert sub-client
	_, err = db.ExecContext(ctx, `
		INSERT INTO subclients (id, project_id, name, description, short_id, pathname, registration_enabled, suspended, created_by_user_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)
	`, subClientID, projectId, strings.TrimSpace(p.Name), nullStringFromString(p.Description), shortID, pathname, data.UserID, now, now)

	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			if strings.Contains(err.Error(), "short_id") {
				return nil, &errs.Error{Code: errs.AlreadyExists, Message: "short ID already exists, please try again"}
			}
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "sub-client with this name already exists"}
		}
		return nil, fmt.Errorf("failed to create sub-client: %w", err)
	}

	// Get the created sub-client
	subClients, err := getProjectSubClients(ctx, projectId)
	if err != nil {
		return nil, err
	}

	var created *SubClientDetail
	for _, sc := range subClients {
		if sc.ID == subClientID {
			created = &sc
			break
		}
	}

	if created == nil {
		return nil, &errs.Error{Code: errs.Internal, Message: "failed to retrieve created sub-client"}
	}

	return &createSubClientResponse{
		Success: true,
		Data: &createSubClientData{
			SubClient: *created,
		},
	}, nil
}

type updateSubClientRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Pathname    string `json:"pathname"`
	Suspended   *bool  `json:"suspended"`
}

type updateSubClientResponse struct {
	Success bool                `json:"success"`
	Data    *updateSubClientData `json:"data"`
}

type updateSubClientData struct {
	SubClient SubClientDetail `json:"subClient"`
}

// UpdateProjectSubClient updates a sub-client.
// API path: /projects/:projectId/sub-clients/:subClientId
//
//encore:api auth method=PUT path=/projects/:projectId/sub-clients/:subClientId
func UpdateProjectSubClient(ctx context.Context, projectId, subClientId string, p *updateSubClientRequest) (*updateSubClientResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}

	if p == nil {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid request"}
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	// Verify sub-client exists and belongs to project
	subClient, err := getSubClientByID(ctx, subClientId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "sub-client not found"}
		}
		return nil, err
	}
	if subClient.ProjectID != projectId {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "sub-client does not belong to this project"}
	}

	// Build updates
	updates := []string{}
	values := []interface{}{}

	if p.Name != "" {
		updates = append(updates, "name = ?")
		values = append(values, strings.TrimSpace(p.Name))

		// Update pathname if not explicitly provided
		if p.Pathname == "" {
			updates = append(updates, "pathname = ?")
			values = append(values, generatePathname(p.Name))
		}
	}

	if p.Pathname != "" {
		// Validate pathname format
		if !isValidPathname(p.Pathname) {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "pathname must contain only lowercase letters, numbers, and hyphens"}
		}
		updates = append(updates, "pathname = ?")
		values = append(values, p.Pathname)
	}

	if p.Description != "" {
		updates = append(updates, "description = ?")
		values = append(values, nullStringFromString(p.Description))
	}

	if p.Suspended != nil {
		suspended := 0
		if *p.Suspended {
			suspended = 1
		}
		updates = append(updates, "suspended = ?")
		values = append(values, suspended)
	}

	if len(updates) == 0 {
		// No updates, return current sub-client
		resp, err := getSubClientDetailResponse(ctx, projectId, subClientId)
		if err != nil {
			return nil, err
		}
		return &updateSubClientResponse{
			Success: resp.Success,
			Data:    &updateSubClientData{SubClient: resp.Data.SubClient},
		}, nil
	}

	updates = append(updates, "updated_at = ?")
	values = append(values, time.Now().Unix())
	values = append(values, subClientId)

	query := fmt.Sprintf("UPDATE subclients SET %s WHERE id = ?", strings.Join(updates, ", "))
	_, err = db.ExecContext(ctx, query, values...)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "pathname already exists"}
		}
		return nil, fmt.Errorf("failed to update sub-client: %w", err)
	}

	resp, err := getSubClientDetailResponse(ctx, projectId, subClientId)
	if err != nil {
		return nil, err
	}
	return &updateSubClientResponse{
		Success: resp.Success,
		Data:    &updateSubClientData{SubClient: resp.Data.SubClient},
	}, nil
}

// DeleteProjectSubClient deletes a sub-client.
// API path: /projects/:projectId/sub-clients/:subClientId
//
//encore:api auth method=DELETE path=/projects/:projectId/sub-clients/:subClientId
func DeleteProjectSubClient(ctx context.Context, projectId, subClientId string) (*successResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	// Verify sub-client exists and belongs to project
	subClient, err := getSubClientByID(ctx, subClientId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "sub-client not found"}
		}
		return nil, err
	}
	if subClient.ProjectID != projectId {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "sub-client does not belong to this project"}
	}

	// Check if suspended before allowing deletion
	if !subClient.Suspended {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "cannot delete active sub-client. Suspend it first."}
	}

	// Delete sub-client (cascade will handle users, etc.)
	_, err = db.ExecContext(ctx, "DELETE FROM subclients WHERE id = ?", subClientId)
	if err != nil {
		return nil, fmt.Errorf("failed to delete sub-client: %w", err)
	}

	return &successResponse{Success: true}, nil
}

// REMOVED: GetProjectSubClientDetail endpoint
// This endpoint was removed because it conflicted with the frontend route.
// The frontend now fetches sub-client details using the ListProjectSubClients endpoint
// and filters by subClientId. This allows the SPA to handle page refreshes correctly
// without routing conflicts.

// ============================================================================
// Sub-Client User Management
// ============================================================================

type listSubClientUsersResponse struct {
	Success bool                `json:"success"`
	Data    *listSubClientUsers `json:"data"`
}

type listSubClientUsers struct {
	Users []SubClientUser `json:"users"`
}

// ListSubClientUsers lists users for a sub-client.
// API path: /projects/:projectId/sub-clients/:subClientId/users
//
//encore:api auth method=GET path=/projects/:projectId/sub-clients/:subClientId/users
func ListSubClientUsers(ctx context.Context, projectId, subClientId string) (*listSubClientUsersResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	// Verify sub-client exists and belongs to project
	subClient, err := getSubClientByID(ctx, subClientId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "sub-client not found"}
		}
		return nil, err
	}
	if subClient.ProjectID != projectId {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "sub-client does not belong to this project"}
	}

	// Get users for this sub-client
	users, err := getSubClientUsers(ctx, subClientId)
	if err != nil {
		return nil, err
	}

	return &listSubClientUsersResponse{
		Success: true,
		Data: &listSubClientUsers{
			Users: users,
		},
	}, nil
}

type createSubClientUserRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type createSubClientUserResponse struct {
	Success bool           `json:"success"`
	Data    *subClientUser `json:"data"`
	Message string         `json:"message"`
}

type subClientUser struct {
	User       SubClientUser `json:"user"`
	CreatedAt int64          `json:"created_at"`
}

// CreateSubClientUser creates a new user in a sub-client.
// API path: /projects/:projectId/sub-clients/:subClientId/users
//
//encore:api auth method=POST path=/projects/:projectId/sub-clients/:subClientId/users
func CreateSubClientUser(ctx context.Context, projectId, subClientId string, p *createSubClientUserRequest) (*createSubClientUserResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}

	// Validate request
	if p == nil {
		return nil, badRequest("request body is required")
	}
	if strings.TrimSpace(p.Username) == "" {
		return nil, badRequest("username is required")
	}
	if strings.TrimSpace(p.Email) == "" {
		return nil, badRequest("email is required")
	}
	if strings.TrimSpace(p.Password) == "" {
		return nil, badRequest("password is required")
	}
	if len(p.Password) < 8 {
		return nil, badRequest("password must be at least 8 characters")
	}
	if p.Role != "" && p.Role != "admin" && p.Role != "user" {
		return nil, badRequest("role must be either 'admin' or 'user'")
	}

	// Default role to "user" if not specified
	role := p.Role
	if role == "" {
		role = "user"
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	// Verify sub-client exists and belongs to project
	subClient, err := getSubClientByID(ctx, subClientId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "sub-client not found"}
		}
		return nil, err
	}
	if subClient.ProjectID != projectId {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "sub-client does not belong to this project"}
	}

	// Check if username already exists for this sub-client
	var existingUserID string
	err = db.QueryRowContext(ctx, "SELECT id FROM users WHERE subclient_id = ? AND username = ?", subClientId, p.Username).Scan(&existingUserID)
	if err == nil {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "username already exists in this sub-client"}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("failed to check existing username: %w", err)
	}

	// Check if email already exists for this sub-client
	err = db.QueryRowContext(ctx, "SELECT id FROM users WHERE subclient_id = ? AND email = ?", subClientId, p.Email).Scan(&existingUserID)
	if err == nil {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "email already exists in this sub-client"}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("failed to check existing email: %w", err)
	}

	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(p.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create the user
	now := time.Now().UnixMilli()
	userID := newID("usr")
	_, err = db.ExecContext(ctx, `
		INSERT INTO users (id, tenant_id, project_id, subclient_id, username, email, password_hash, role, source, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, userID, data.TenantID, projectId, subClientId, p.Username, p.Email, string(hashedPassword), role, "manual", now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &createSubClientUserResponse{
		Success: true,
		Data: &subClientUser{
			User: SubClientUser{
				ID:       userID,
				Username: p.Username,
				Email:    p.Email,
				Role:     role,
			},
			CreatedAt: now,
		},
		Message: "User created successfully",
	}, nil
}

type updateUserRoleRequest struct {
	Role string `json:"role"`
}

type updateUserRoleResponse struct {
	Success bool `json:"success"`
}

// UpdateSubClientUserRole updates a user's role in a sub-client.
// API path: /projects/:projectId/sub-clients/:subClientId/users/:userId/role
//
//encore:api auth method=PUT path=/projects/:projectId/sub-clients/:subClientId/users/:userId/role
func UpdateSubClientUserRole(ctx context.Context, projectId, subClientId, userId string, p *updateUserRoleRequest) (*updateUserRoleResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}

	if p == nil || p.Role == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "role is required"}
	}

	// Validate role
	role := strings.ToLower(p.Role)
	if role != "admin" && role != "user" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "role must be 'admin' or 'user'"}
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	// Verify sub-client exists and belongs to project
	subClient, err := getSubClientByID(ctx, subClientId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "sub-client not found"}
		}
		return nil, err
	}
	if subClient.ProjectID != projectId {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "sub-client does not belong to this project"}
	}

	// Update user role
	_, err = db.ExecContext(ctx, `
		UPDATE users SET role = ?, updated_at = ?
		WHERE id = ? AND subclient_id = ?
	`, role, time.Now().Unix(), userId, subClientId)

	if err != nil {
		return nil, fmt.Errorf("failed to update user role: %w", err)
	}

	return &updateUserRoleResponse{Success: true}, nil
}

// DeleteSubClientUser deletes a user from a sub-client.
// API path: /projects/:projectId/sub-clients/:subClientId/users/:userId
//
//encore:api auth method=DELETE path=/projects/:projectId/sub-clients/:subClientId/users/:userId
func DeleteSubClientUser(ctx context.Context, projectId, subClientId, userId string) (*successResponse, error) {
	raw := auth.Data()
	data, _ := raw.(*AuthData)
	if data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}

	// Don't allow deleting yourself
	if data.UserID == userId {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "cannot delete yourself"}
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectId, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	// Verify sub-client exists and belongs to project
	subClient, err := getSubClientByID(ctx, subClientId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "sub-client not found"}
		}
		return nil, err
	}
	if subClient.ProjectID != projectId {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "sub-client does not belong to this project"}
	}

	// Delete user
	_, err = db.ExecContext(ctx, "DELETE FROM users WHERE id = ? AND subclient_id = ?", userId, subClientId)
	if err != nil {
		return nil, fmt.Errorf("failed to delete user: %w", err)
	}

	return &successResponse{Success: true}, nil
}

// ============================================================================
// Helper Functions
// ============================================================================

// getProjectSubClients retrieves all sub-clients for a project with their users
func getProjectSubClients(ctx context.Context, projectID string) ([]SubClientDetail, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, project_id, name, COALESCE(description, '') as description,
		       COALESCE(short_id, '') as short_id, COALESCE(pathname, '') as pathname,
		       COALESCE(registration_enabled, 1) as registration_enabled,
		       COALESCE(suspended, 0) as suspended,
		       COALESCE(whatsapp_client_id, '') as whatsapp_client_id,
		       created_at, COALESCE(updated_at, 0) as updated_at
		FROM subclients
		WHERE project_id = ?
		ORDER BY created_at DESC
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subClients []SubClientDetail
	for rows.Next() {
		var sc SubClientDetail
		var description sql.NullString
		var shortID, pathname, whatsappClientID sql.NullString
		var createdAt sql.NullInt64
		var registrationEnabled, suspended int

		err := rows.Scan(&sc.ID, &sc.ProjectID, &sc.Name, &description,
			&shortID, &pathname, &registrationEnabled, &suspended,
			&whatsappClientID, &createdAt, &sc.UpdatedAt)
		if err != nil {
			return nil, err
		}

		sc.Description = description.String
		sc.ShortID = shortID.String
		sc.Pathname = pathname.String
		sc.RegistrationEnabled = registrationEnabled == 1
		sc.Suspended = suspended == 1
		sc.WhatsappClientID = whatsappClientID.String
		sc.CreatedAt = createdAt.Int64

		// Get users for this sub-client
		users, err := getSubClientUsers(ctx, sc.ID)
		if err != nil {
			return nil, err
		}
		sc.Users = users

		subClients = append(subClients, sc)
	}

	return subClients, nil
}

// getSubClientByID retrieves a single sub-client by ID
func getSubClientByID(ctx context.Context, subClientID string) (*SubClientDetail, error) {
	var sc SubClientDetail
	var description sql.NullString
	var shortID, pathname, whatsappClientID sql.NullString
	var createdAt sql.NullInt64
	var registrationEnabled, suspended int

	err := db.QueryRowContext(ctx, `
		SELECT id, project_id, name, COALESCE(description, '') as description,
		       COALESCE(short_id, '') as short_id, COALESCE(pathname, '') as pathname,
		       COALESCE(registration_enabled, 1) as registration_enabled,
		       COALESCE(suspended, 0) as suspended,
		       COALESCE(whatsapp_client_id, '') as whatsapp_client_id,
		       created_at, COALESCE(updated_at, 0) as updated_at
		FROM subclients
		WHERE id = ?
	`, subClientID).Scan(&sc.ID, &sc.ProjectID, &sc.Name, &description,
		&shortID, &pathname, &registrationEnabled, &suspended,
		&whatsappClientID, &createdAt, &sc.UpdatedAt)

	if err != nil {
		return nil, err
	}

	sc.Description = description.String
	sc.ShortID = shortID.String
	sc.Pathname = pathname.String
	sc.RegistrationEnabled = registrationEnabled == 1
	sc.Suspended = suspended == 1
	sc.WhatsappClientID = whatsappClientID.String
	sc.CreatedAt = createdAt.Int64

	return &sc, nil
}

// getSubClientUsers retrieves all users for a sub-client
func getSubClientUsers(ctx context.Context, subClientID string) ([]SubClientUser, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, username, COALESCE(email, '') as email, role
		FROM users
		WHERE subclient_id = ?
		ORDER BY created_at DESC
	`, subClientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []SubClientUser
	for rows.Next() {
		var u SubClientUser
		var email sql.NullString

		err := rows.Scan(&u.ID, &u.Username, &email, &u.Role)
		if err != nil {
			return nil, err
		}

		u.Email = email.String
		users = append(users, u)
	}

	return users, nil
}

// getSubClientDetailResponse returns a sub-client detail response
func getSubClientDetailResponse(ctx context.Context, projectId, subClientId string) (*createSubClientResponse, error) {
	subClient, err := getSubClientByID(ctx, subClientId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "sub-client not found"}
		}
		return nil, err
	}

	// Get users for this sub-client
	users, err := getSubClientUsers(ctx, subClientId)
	if err != nil {
		return nil, err
	}
	subClient.Users = users

	return &createSubClientResponse{
		Success: true,
		Data: &createSubClientData{
			SubClient: *subClient,
		},
	}, nil
}

// generateShortID generates a 4-character short ID
func generateShortID() string {
	b := make([]byte, 2)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp-based ID
		return fmt.Sprintf("%04x", time.Now().UnixNano()%0xFFFF)
	}
	return hex.EncodeToString(b)[:4]
}

// generatePathname generates a pathname from a name
func generatePathname(name string) string {
	// Convert to lowercase and replace spaces with hyphens
	pathname := strings.ToLower(strings.TrimSpace(name))
	pathname = strings.ReplaceAll(pathname, " ", "-")
	pathname = strings.ReplaceAll(pathname, "_", "-")

	// Remove all characters except lowercase letters, numbers, and hyphens
	var result strings.Builder
	for _, r := range pathname {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			result.WriteRune(r)
		}
	}

	pathname = result.String()

	// Remove consecutive hyphens
	for strings.Contains(pathname, "--") {
		pathname = strings.ReplaceAll(pathname, "--", "-")
	}

	// Remove leading/trailing hyphens
	pathname = strings.Trim(pathname, "-")

	// Limit to 50 characters
	if len(pathname) > 50 {
		pathname = pathname[:50]
	}

	// Ensure it's not empty
	if pathname == "" {
		pathname = "client"
	}

	return pathname
}

// isValidPathname validates pathname format
func isValidPathname(pathname string) bool {
	if pathname == "" {
		return false
	}
	for _, r := range pathname {
		if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-') {
			return false
		}
	}
	return true
}

// nullStringFromString converts a string to sql.NullString
func nullStringFromString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
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
	data, _ := raw.(*AuthData)
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
	ProjectID   string `json:"project_id"`
	PhoneNumber string `json:"phone_number"`
	AsSubclient bool   `json:"as_subclient"`
	SubclientID string `json:"subclient_id"`
}

type whatsappProvisionResponse struct {
	UserID string `json:"user_id"`
}

// ProvisionWhatsappUser creates a user from an incoming WhatsApp chat event.
//
//encore:api auth method=POST path=/whatsapp/provision-user
func ProvisionWhatsappUser(ctx context.Context, p *whatsappProvisionParams) (*whatsappProvisionResponse, error) {
	if p == nil || p.ProjectID == "" || p.PhoneNumber == "" {
		return nil, badRequest("project_id and phone_number are required")
	}

	raw := auth.Data()
	data, _ := raw.(*AuthData)
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

	// Dev mode: auto-generate trial license if none exists
	if encore.Meta().Environment.Type == "development" {
		count, err := q().CountLicenses(ctx)
		if err != nil {
			return nil, err
		}
		if count == 0 {
			// Create dev trial license
			devLicenseId := newID("lic")
			devLicenseKey := newID("dev")
			tenantName := "Dev Trial"
			err = q().InsertLicense(ctx, iamdb.InsertLicenseParams{
				ID:                   devLicenseId,
				LicenseKey:           devLicenseKey,
				MaxProjectsPerTenant: 999,
				WhatsappEnabled:      1,
				SubclientEnabled:     1,
				TenantName:           tenantName,
			})
			if err != nil {
				return nil, err
			}
			// Auto-use dev license
			return &license{
				MaxProjectsPerTenant: 999,
				WhatsappEnabled:      true,
				SubclientEnabled:     true,
			}, nil
		}
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
	envType := string(encore.Meta().Environment.Type)
	maskedKey := key
	if len(maskedKey) > 8 {
		maskedKey = maskedKey[:4] + "..." + maskedKey[len(maskedKey)-4:]
	}

	fmt.Printf("[LICENSE] verify started | env=%s | input_key=%s\n", envType, maskedKey)

	// Dev Bypass: Use OPENAI_API_KEY from .env as a valid license key in development
	if encore.Meta().Environment.Type == "development" {
		devKey := os.Getenv("OPENAI_API_KEY")
		if devKey == "" {
			fmt.Println("[LICENSE] ⚠ OPENAI_API_KEY is empty — .env file missing or key not set. Dev bypass disabled.")
		} else {
			maskedDevKey := devKey
			if len(maskedDevKey) > 8 {
				maskedDevKey = maskedDevKey[:4] + "..." + maskedDevKey[len(maskedDevKey)-4:]
			}
			fmt.Printf("[LICENSE] dev bypass check | env_key=%s | match=%v\n", maskedDevKey, key == devKey)

			if key == devKey {
				fmt.Println("[LICENSE] ✓ Dev bypass activated — license accepted locally")
				return &licenseVerifyResponse{
					Valid:                true,
					TenantName:           "Dev Local (Bypass)",
					MaxProjectsPerTenant: 999,
					WhatsappEnabled:      true,
					SubclientEnabled:     true,
				}, nil
			}
			fmt.Println("[LICENSE] ✗ Key does not match OPENAI_API_KEY, falling through to hub verification")
		}
	} else {
		fmt.Printf("[LICENSE] not in development mode (env=%s), skipping dev bypass\n", envType)
	}

	hubURL := "https://hub.maldevta.com/api/license/verify"
	fmt.Printf("[LICENSE] contacting license hub: %s\n", hubURL)

	body, err := json.Marshal(map[string]string{"license_key": key})
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, hubURL, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")

	// Create a custom client. Only skip SSL verification in development.
	tr := &http.Transport{}
	if encore.Meta().Environment.Type == "development" {
		tr.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}
	client := &http.Client{Transport: tr, Timeout: 15 * time.Second}

	resp, err := client.Do(request)
	if err != nil {
		fmt.Printf("[LICENSE] ✗ hub connection failed: %v\n", err)
		return nil, &errs.Error{Code: errs.Unavailable, Message: fmt.Sprintf("failed contacting license hub: %v", err)}
	}
	defer resp.Body.Close()

	fmt.Printf("[LICENSE] hub responded with status=%d\n", resp.StatusCode)

	var out licenseVerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		fmt.Printf("[LICENSE] ✗ failed to decode hub response: %v\n", err)
		return nil, &errs.Error{Code: errs.Internal, Message: "invalid response from license hub"}
	}

	if resp.StatusCode >= 400 {
		if out.Error == "" {
			out.Error = fmt.Sprintf("license hub rejected request (%d)", resp.StatusCode)
		}
		out.Valid = false
		fmt.Printf("[LICENSE] ✗ hub rejected: status=%d error=%s\n", resp.StatusCode, out.Error)
	} else {
		fmt.Printf("[LICENSE] hub result: valid=%v tenant=%s\n", out.Valid, out.TenantName)
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
		Username: username,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", "", &errs.Error{Code: errs.Unauthenticated, Message: "invalid credentials"}
		}
		return "", "", "", err
	}
	return user.ID, user.Role, user.PasswordHash.String, nil
}

func findSystemUser(ctx context.Context, username string) (userID, userRole, passwordHash string, err error) {
	row := db.QueryRowContext(ctx, `
		SELECT id, role, password_hash
		FROM users
		WHERE tenant_id IS NULL AND subclient_id IS NULL AND role = ? AND username = ?
		LIMIT 1
	`, string(roleSystem), username)

	var hash sql.NullString
	if err := row.Scan(&userID, &userRole, &hash); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", "", &errs.Error{Code: errs.Unauthenticated, Message: "invalid credentials"}
		}
		return "", "", "", err
	}
	if !hash.Valid {
		return "", "", "", &errs.Error{Code: errs.Unauthenticated, Message: "invalid credentials"}
	}
	return userID, userRole, hash.String, nil
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
	// Allow if domain is wildcard, exact match, or host is localhost (for development)
	if domain == "*" || domain == host || isLocalhost(host) {
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

	if currentVersion < 2 {
		if err := applyMigration(ctx, db, 2); err != nil {
			return err
		}
	}

	if currentVersion < 3 {
		if err := applyMigration(ctx, db, 3); err != nil {
			return err
		}
	}

	if currentVersion < 4 {
		if err := applyMigration(ctx, db, 4); err != nil {
			return err
		}
	}

	if currentVersion < 5 {
		if err := applyMigration(ctx, db, 5); err != nil {
			return err
		}
	}

	if currentVersion < 6 {
		if err := applyMigration(ctx, db, 6); err != nil {
			return err
		}
	}

	if currentVersion < 7 {
		if err := applyMigration(ctx, db, 7); err != nil {
			return err
		}
	}

	if currentVersion < 8 {
		if err := applyMigration(ctx, db, 8); err != nil {
			return err
		}
	}

	if currentVersion < 9 {
		if err := applyMigration(ctx, db, 9); err != nil {
			return err
		}
	}

	if currentVersion < 10 {
		if err := applyMigration(ctx, db, 10); err != nil {
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

	// Execute migration statements
	statements := strings.Split(sqlStr, ";")
	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			// Ignore duplicate column errors (common in dev when restoring DBs)
			if strings.Contains(err.Error(), "duplicate column name") {
				fmt.Printf("Warning: Migration %d encountered duplicate column error, ignoring: %v\n", version, err)
				continue
			}
			return fmt.Errorf("failed to apply migration %d statement '%s': %w", version, stmt, err)
		}
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

// isLocalhost checks if a host is a localhost address (for development/testing)
func isLocalhost(host string) bool {
	h := normalizeHost(host)
	return h == "localhost" || h == "127.0.0.1" || h == "::1" || strings.HasPrefix(h, "localhost:")
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

// ============================================================================
// ROLE-BASED CHAT APIS
// ============================================================================

type getProjectRoleResponse struct {
	ContextRole string `json:"context_role"`
}

type updateProjectRoleRequest struct {
	ContextRole string `json:"context_role" validate:"required"`
}

// GetProjectRole retrieves the context role for a project
//
//encore:api auth method=GET path=/projects/:projectId/role
func GetProjectRole(ctx context.Context, projectId string) (*getProjectRoleResponse, error) {
	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Get project to verify ownership
	_, err := q().GetProject(ctx, iamdb.GetProjectParams{
		ID:       projectId,
		TenantID: data.TenantID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
		}
		return nil, err
	}

	// Get context_role from project
	var contextRole string
	err = db.QueryRowContext(ctx, "SELECT context_role FROM projects WHERE id = ? AND tenant_id = ?", projectId, data.TenantID).Scan(&contextRole)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
		}
		return nil, err
	}

	return &getProjectRoleResponse{
		ContextRole: contextRole,
	}, nil
}

// UpdateProjectRole updates the context role for a project
//
//encore:api auth method=PUT path=/projects/:projectId/role
func UpdateProjectRole(ctx context.Context, projectId string, req *updateProjectRoleRequest) (*getProjectRoleResponse, error) {
	if req == nil || strings.TrimSpace(req.ContextRole) == "" {
		return nil, badRequest("context_role is required")
	}

	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Verify project exists
	_, err := q().GetProject(ctx, iamdb.GetProjectParams{
		ID:       projectId,
		TenantID: data.TenantID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
		}
		return nil, err
	}

	// Validate role exists
	role := getRoleByID(req.ContextRole)
	if role == nil {
		return nil, badRequest("invalid role ID")
	}

	// Update project role
	_, err = db.ExecContext(ctx, "UPDATE projects SET context_role = ? WHERE id = ? AND tenant_id = ?", req.ContextRole, projectId, data.TenantID)
	if err != nil {
		return nil, err
	}

	return &getProjectRoleResponse{
		ContextRole: req.ContextRole,
	}, nil
}

// CheckQuestionScope checks if a question is within the project's role scope
//
//encore:api auth method=POST path=/projects/:projectId/check-scope
func CheckQuestionScope(ctx context.Context, projectId string, req *checkQuestionScopeRequest) (*checkQuestionScopeResponse, error) {
	if req == nil || strings.TrimSpace(req.Question) == "" {
		return nil, badRequest("question is required")
	}

	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Get project role
	var contextRole string
	err := db.QueryRowContext(ctx, "SELECT COALESCE(context_role, 'general') FROM projects WHERE id = ? AND tenant_id = ?", projectId, data.TenantID).Scan(&contextRole)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
		}
		return nil, err
	}

	if contextRole == "" {
		contextRole = "general"
	}

	// Get role definition
	role := getRoleByID(contextRole)

	// Check if question is in scope
	inScope := isQuestionInScope(req.Question, role)

	response := &checkQuestionScopeResponse{
		InScope: inScope,
		Role:    contextRole,
	}

	if !inScope && role != nil {
		response.RefusalMessage = getOutOfScopeResponse(role)
	}

	return response, nil
}

type checkQuestionScopeRequest struct {
	Question string `json:"question"`
}

type checkQuestionScopeResponse struct {
	InScope         bool   `json:"in_scope"`
	Role            string `json:"role"`
	RefusalMessage  string `json:"refusal_message,omitempty"`
}
