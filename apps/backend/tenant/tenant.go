package tenant

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"

	iam "encore.app/backend/iam"
)

// Get database instance from IAM service (shared database)
func getDB() (*sql.DB, error) {
	return iam.GetDB()
}

// AuthData from IAM service - use a local type to avoid circular dependencies
type TenantAuthData struct {
	UserID    string
	Role      string
	TenantID  string
	ScopeType string
}

const (
	roleAdmin = "admin"
	roleUser  = "user"
)

// Tenant represents a tenant in the system
type Tenant struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Domain    string `json:"domain"`
	IsDefault bool   `json:"is_default"`
	HasLogo   bool   `json:"has_logo"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

// User represents a user in the system
type User struct {
	ID        string `json:"id"`
	TenantID  string `json:"tenant_id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	Source    string `json:"source"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

// ListTenantsResponse is the response for listing tenants
type ListTenantsResponse struct {
	Tenants []*Tenant `json:"tenants"`
}

// GetTenantResponse is the response for getting a tenant
type GetTenantResponse struct {
	Tenant *Tenant `json:"tenant"`
}

// CreateTenantRequest is the request for creating a tenant
type CreateTenantRequest struct {
	Name   string `json:"name"`
	Domain string `json:"domain"`
}

// UpdateTenantRequest is the request for updating a tenant
type UpdateTenantRequest struct {
	Name   string `json:"name"`
	Domain string `json:"domain"`
}

// ListUsersResponse is the response for listing users
type ListUsersResponse struct {
	Users []*User `json:"users"`
}

// CreateUserRequest is the request for creating a user
type CreateUserRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// CreateUserResponse is the response for creating a user
type CreateUserResponse struct {
	User *User `json:"user"`
}

// UpdateUserRequest is the request for updating a user
type UpdateUserRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// Helper to check if user is admin
func isAdmin(data *iam.AuthData) bool {
	if data == nil {
		return false
	}
	return string(data.Role) == roleAdmin
}

// Helper to parse time from flexible DB types
func parseDBTime(v interface{}) int64 {
	switch val := v.(type) {
	case int64:
		return val
	case time.Time:
		return val.Unix()
	}
	return 0
}

// Helper to scan tenant row
func scanTenant(row *sql.Row) (*Tenant, error) {
	var t Tenant
	var isDefault, hasLogo int
	var createdAt, updatedAt interface{}
	err := row.Scan(&t.ID, &t.Name, &t.Domain, &isDefault, &hasLogo, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	t.IsDefault = isDefault == 1
	t.HasLogo = hasLogo == 1
	t.CreatedAt = parseDBTime(createdAt)
	t.UpdatedAt = parseDBTime(updatedAt)
	return &t, nil
}

// Helper to scan user row
func scanUser(row *sql.Row) (*User, error) {
	var u User
	var email sql.NullString
	var createdAt, updatedAt interface{}
	err := row.Scan(&u.ID, &u.TenantID, &u.Username, &email, &u.Role, &u.Source, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	u.Email = email.String
	u.CreatedAt = parseDBTime(createdAt)
	u.UpdatedAt = parseDBTime(updatedAt)
	return &u, nil
}

//encore:api auth method=GET path=/api/admin/tenants
func ListTenants(ctx context.Context) (*ListTenantsResponse, error) {
	raw := auth.Data()
	if raw == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	data, _ := raw.(*iam.AuthData)
	if data == nil || !isAdmin(data) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only admins can list tenants"}
	}

	db, err := getDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	rows, err := db.QueryContext(ctx, `
		SELECT id, name, domain, is_default, has_logo, created_at, updated_at
		FROM tenants ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list tenants: %w", err)
	}
	defer rows.Close()

	var tenants []*Tenant
	for rows.Next() {
		var t Tenant
		var isDefault, hasLogo int
		var createdAt, updatedAt interface{}
		err := rows.Scan(&t.ID, &t.Name, &t.Domain, &isDefault, &hasLogo, &createdAt, &updatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan tenant: %w", err)
		}
		t.IsDefault = isDefault == 1
		t.HasLogo = hasLogo == 1
		t.CreatedAt = parseDBTime(createdAt)
		t.UpdatedAt = parseDBTime(updatedAt)
		tenants = append(tenants, &t)
	}

	return &ListTenantsResponse{Tenants: tenants}, nil
}

//encore:api auth method=GET path=/api/admin/tenants/:tenantID
func GetTenant(ctx context.Context, tenantID string) (*GetTenantResponse, error) {
	raw := auth.Data()
	if raw == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	data, _ := raw.(*iam.AuthData)
	if data == nil || !isAdmin(data) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only admins can view tenants"}
	}

	db, err := getDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	row := db.QueryRowContext(ctx, `
		SELECT id, name, domain, is_default, has_logo, created_at, updated_at
		FROM tenants WHERE id = ?
	`, tenantID)

	tenant, err := scanTenant(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "tenant not found"}
		}
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}

	return &GetTenantResponse{Tenant: tenant}, nil
}

//encore:api auth method=POST path=/api/admin/tenants
func CreateTenant(ctx context.Context, p *CreateTenantRequest) (*GetTenantResponse, error) {
	raw := auth.Data()
	if raw == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	data, _ := raw.(*iam.AuthData)
	if data == nil || !isAdmin(data) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only admins can create tenants"}
	}

	if p == nil || strings.TrimSpace(p.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "tenant name is required"}
	}

	tenantID := newID("ten")
	domain := strings.TrimSpace(strings.ToLower(p.Domain))
	if domain == "" {
		domain = "*"
	}
	now := time.Now().Unix()

	db, err := getDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	_, err = db.ExecContext(ctx, `
		INSERT INTO tenants (id, name, domain, is_default, has_logo, created_at, updated_at)
		VALUES (?, ?, ?, 0, 0, ?, ?)
	`, tenantID, strings.TrimSpace(p.Name), domain, now, now)

	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "domain already exists"}
		}
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}

	// Create tenant directory
	if err := os.MkdirAll(getTenantPath(tenantID), 0755); err != nil && !os.IsExist(err) {
		return nil, fmt.Errorf("failed to create tenant directory: %w", err)
	}

	return &GetTenantResponse{
		Tenant: &Tenant{
			ID:        tenantID,
			Name:      strings.TrimSpace(p.Name),
			Domain:    domain,
			IsDefault: false,
			HasLogo:   false,
			CreatedAt: now,
			UpdatedAt: now,
		},
	}, nil
}

//encore:api auth method=PUT path=/api/admin/tenants/:tenantID
func UpdateTenant(ctx context.Context, tenantID string, p *UpdateTenantRequest) (*GetTenantResponse, error) {
	raw := auth.Data()
	if raw == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	data, _ := raw.(*iam.AuthData)
	if data == nil || !isAdmin(data) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only admins can update tenants"}
	}

	if p == nil {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid request"}
	}

	db, err := getDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	// Check if tenant exists
	row := db.QueryRowContext(ctx, `SELECT id FROM tenants WHERE id = ?`, tenantID)
	var id string
	err = row.Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "tenant not found"}
		}
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}

	// Build update query dynamically
	updates := []string{}
	values := []interface{}{}

	if p.Name != "" {
		updates = append(updates, "name = ?")
		values = append(values, strings.TrimSpace(p.Name))
	}
	if p.Domain != "" {
		updates = append(updates, "domain = ?")
		values = append(values, strings.TrimSpace(strings.ToLower(p.Domain)))
	}

	if len(updates) == 0 {
		return GetTenant(ctx, tenantID)
	}

	updates = append(updates, "updated_at = ?")
	values = append(values, time.Now().Unix())
	values = append(values, tenantID)

	query := fmt.Sprintf("UPDATE tenants SET %s WHERE id = ?", strings.Join(updates, ", "))
	_, err = db.ExecContext(ctx, query, values...)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "domain already exists"}
		}
		return nil, fmt.Errorf("failed to update tenant: %w", err)
	}

	return GetTenant(ctx, tenantID)
}

//encore:api auth method=DELETE path=/api/admin/tenants/:tenantID
func DeleteTenant(ctx context.Context, tenantID string) error {
	raw := auth.Data()
	if raw == nil {
		return &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	data, _ := raw.(*iam.AuthData)
	if data == nil || !isAdmin(data) {
		return &errs.Error{Code: errs.PermissionDenied, Message: "only admins can delete tenants"}
	}

	db, err := getDB()
	if err != nil {
		return fmt.Errorf("failed to get database: %w", err)
	}

	// Check if tenant exists and if it's default
	var isDefault int
	row := db.QueryRowContext(ctx, `SELECT is_default FROM tenants WHERE id = ?`, tenantID)
	err = row.Scan(&isDefault)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &errs.Error{Code: errs.NotFound, Message: "tenant not found"}
		}
		return fmt.Errorf("failed to get tenant: %w", err)
	}

	if isDefault == 1 {
		return &errs.Error{Code: errs.FailedPrecondition, Message: "cannot delete default tenant"}
	}

	// Delete tenant (cascade will handle users, projects, etc.)
	result, err := db.ExecContext(ctx, "DELETE FROM tenants WHERE id = ?", tenantID)
	if err != nil {
		return fmt.Errorf("failed to delete tenant: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &errs.Error{Code: errs.NotFound, Message: "tenant not found"}
	}

	return nil
}

// ============================================================================
// User Management
// ============================================================================

//encore:api auth method=GET path=/api/admin/tenants/:tenantID/users
func ListTenantUsers(ctx context.Context, tenantID string) (*ListUsersResponse, error) {
	raw := auth.Data()
	if raw == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	data, _ := raw.(*iam.AuthData)
	if data == nil || !isAdmin(data) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only admins can list users"}
	}

	db, err := getDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	// Verify tenant exists
	var exists int
	err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM tenants WHERE id = ?", tenantID).Scan(&exists)
	if err != nil || exists == 0 {
		return nil, &errs.Error{Code: errs.NotFound, Message: "tenant not found"}
	}

	rows, err := db.QueryContext(ctx, `
		SELECT id, tenant_id, username, email, role, source, created_at, updated_at
		FROM users
		WHERE tenant_id = ? AND subclient_id IS NULL
		ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	var users []*User
	for rows.Next() {
		var u User
		var email sql.NullString
		var createdAt, updatedAt interface{}
		err := rows.Scan(&u.ID, &u.TenantID, &u.Username, &email, &u.Role, &u.Source, &createdAt, &updatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		u.Email = email.String
		u.CreatedAt = parseDBTime(createdAt)
		u.UpdatedAt = parseDBTime(updatedAt)
		users = append(users, &u)
	}

	return &ListUsersResponse{Users: users}, nil
}

//encore:api auth method=POST path=/api/admin/tenants/:tenantID/users
func CreateTenantUser(ctx context.Context, tenantID string, p *CreateUserRequest) (*CreateUserResponse, error) {
	raw := auth.Data()
	if raw == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	data, _ := raw.(*iam.AuthData)
	if data == nil || !isAdmin(data) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only admins can create users"}
	}

	if p == nil || strings.TrimSpace(p.Username) == "" || p.Password == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "username and password are required"}
	}

	if len(p.Password) < 8 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "password must be at least 8 characters"}
	}

	// Validate role
	role := strings.ToLower(p.Role)
	if role != roleAdmin && role != roleUser {
		role = roleUser
	}

	db, err := getDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	// Verify tenant exists
	var exists int
	err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM tenants WHERE id = ?", tenantID).Scan(&exists)
	if err != nil || exists == 0 {
		return nil, &errs.Error{Code: errs.NotFound, Message: "tenant not found"}
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(p.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	userID := newID("usr")
	now := time.Now().Unix()

	var email sql.NullString
	if p.Email != "" {
		email = sql.NullString{String: strings.TrimSpace(p.Email), Valid: true}
	}

	_, err = db.ExecContext(ctx, `
		INSERT INTO users (id, tenant_id, username, email, password_hash, role, source, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, userID, tenantID, strings.TrimSpace(p.Username), email, string(hash), role, "manual", now, now)

	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "username already exists in this tenant"}
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Get the created user
	row := db.QueryRowContext(ctx, `
		SELECT id, tenant_id, username, email, role, source, created_at, updated_at
		FROM users WHERE id = ?
	`, userID)

	user, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("failed to get created user: %w", err)
	}

	return &CreateUserResponse{User: user}, nil
}

//encore:api auth method=PUT path=/api/admin/tenants/:tenantID/users/:userID
func UpdateTenantUser(ctx context.Context, tenantID, userID string, p *UpdateUserRequest) (*CreateUserResponse, error) {
	raw := auth.Data()
	if raw == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	data, _ := raw.(*iam.AuthData)
	if data == nil || !isAdmin(data) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only admins can update users"}
	}

	if p == nil {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid request"}
	}

	db, err := getDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	// Verify tenant exists
	var exists int
	err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM tenants WHERE id = ?", tenantID).Scan(&exists)
	if err != nil || exists == 0 {
		return nil, &errs.Error{Code: errs.NotFound, Message: "tenant not found"}
	}

	// Get existing user
	var userTenantID string
	row := db.QueryRowContext(ctx, `SELECT tenant_id FROM users WHERE id = ?`, userID)
	err = row.Scan(&userTenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "user not found"}
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Verify user belongs to tenant
	if userTenantID != tenantID {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "user does not belong to this tenant"}
	}

	// Build updates
	updates := []string{}
	values := []interface{}{}

	if p.Username != "" {
		updates = append(updates, "username = ?")
		values = append(values, strings.TrimSpace(p.Username))
	}
	if p.Email != "" {
		updates = append(updates, "email = ?")
		values = append(values, strings.TrimSpace(p.Email))
	}
	if p.Role != "" {
		role := strings.ToLower(p.Role)
		if role == roleAdmin || role == roleUser {
			updates = append(updates, "role = ?")
			values = append(values, role)
		}
	}

	if p.Password != "" {
		if len(p.Password) < 8 {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "password must be at least 8 characters"}
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(p.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("failed to hash password: %w", err)
		}
		updates = append(updates, "password_hash = ?")
		values = append(values, string(hash))
	}

	if len(updates) == 0 {
		return GetTenantUser(ctx, tenantID, userID)
	}

	updates = append(updates, "updated_at = ?")
	values = append(values, time.Now().Unix())
	values = append(values, userID)

	query := fmt.Sprintf("UPDATE users SET %s WHERE id = ?", strings.Join(updates, ", "))
	_, err = db.ExecContext(ctx, query, values...)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "username or email already exists"}
		}
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return GetTenantUser(ctx, tenantID, userID)
}

// GetTenantUser gets a single user
//
//encore:api auth method=GET path=/api/admin/tenants/:tenantID/users/:userID
func GetTenantUser(ctx context.Context, tenantID, userID string) (*CreateUserResponse, error) {
	raw := auth.Data()
	if raw == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	data, _ := raw.(*iam.AuthData)
	if data == nil || !isAdmin(data) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "only admins can view users"}
	}

	db, err := getDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	row := db.QueryRowContext(ctx, `
		SELECT id, tenant_id, username, email, role, source, created_at, updated_at
		FROM users WHERE id = ?
	`, userID)

	user, err := scanUser(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "user not found"}
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &CreateUserResponse{User: user}, nil
}

//encore:api auth method=DELETE path=/api/admin/tenants/:tenantID/users/:userID
func DeleteTenantUser(ctx context.Context, tenantID, userID string) error {
	raw := auth.Data()
	if raw == nil {
		return &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	data, _ := raw.(*iam.AuthData)
	if data == nil || !isAdmin(data) {
		return &errs.Error{Code: errs.PermissionDenied, Message: "only admins can delete users"}
	}

	db, err := getDB()
	if err != nil {
		return fmt.Errorf("failed to get database: %w", err)
	}

	// Get existing user
	var userTenantID string
	row := db.QueryRowContext(ctx, `SELECT tenant_id FROM users WHERE id = ?`, userID)
	err = row.Scan(&userTenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &errs.Error{Code: errs.NotFound, Message: "user not found"}
		}
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Verify user belongs to tenant
	if userTenantID != tenantID {
		return &errs.Error{Code: errs.PermissionDenied, Message: "user does not belong to this tenant"}
	}

	// Don't allow deleting yourself
	if data.UserID == userID {
		return &errs.Error{Code: errs.FailedPrecondition, Message: "cannot delete yourself"}
	}

	_, err = db.ExecContext(ctx, "DELETE FROM users WHERE id = ?", userID)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}

// ============================================================================
// Helper Functions
// ============================================================================

func getTenantPath(tenantID string) string {
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		exePath, _ := os.Executable()
		dataDir = filepath.Join(filepath.Dir(exePath), "data")
	}
	return filepath.Join(dataDir, "tenants", tenantID)
}

func newID(prefix string) string {
	b := make([]byte, 10)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp-based ID if crypto/rand fails
		return prefix + "_" + fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return prefix + "_" + hex.EncodeToString(b)
}
