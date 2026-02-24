package iam

import (
	"context"
	"os"
	"path/filepath"

	"encore.dev/beta/errs"
)

// EmbedInfoResponse contains embed configuration
type EmbedInfoResponse struct {
	ProjectName     string `json:"projectName"`
	ShowHistory     bool   `json:"showHistory"`
	UseClientUID    bool   `json:"useClientUid"`
	CustomCss       string `json:"customCss,omitempty"`
	WelcomeMessage string `json:"welcomeMessage,omitempty"`
}

// GetEmbedInfo validates embed token and returns configuration
//
//encore:api public method=GET path=/api/embed/info
func GetEmbedInfo(ctx context.Context, p *EmbedInfoParams) (*EmbedInfoResponse, error) {
	if p == nil || p.ProjectID == "" || p.EmbedToken == "" {
		return nil, badRequest("projectId and embedToken are required")
	}

	// Validate: projectId === embedToken
	if p.ProjectID != p.EmbedToken {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "invalid embed token"}
	}

	// Find project in file system
	tenantsDir := filepath.Join(getDataDir(), "tenants")
	tenants, err := os.ReadDir(tenantsDir)
	if err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	var tenantID, projectName string
	projectFound := false

	for _, tenant := range tenants {
		if !tenant.IsDir() {
			continue
		}
		tID := tenant.Name()

		projectsDir := filepath.Join(tenantsDir, tID, "projects")
		projects, err := os.ReadDir(projectsDir)
		if err != nil {
			continue
		}

		for _, project := range projects {
			if project.Name() == p.ProjectID {
				tenantID = tID
				projectName = p.ProjectID // Use ID as name for now
				projectFound = true
				break
			}
		}
		if projectFound {
			break
		}
	}

	if !projectFound {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	// Load custom CSS
	customCss := ""
	cssPath := filepath.Join(getProjectPath(tenantID, p.ProjectID), "embed.css")
	if cssData, err := os.ReadFile(cssPath); err == nil {
		customCss = string(cssData)
	}

	// Default values
	return &EmbedInfoResponse{
		ProjectName:     projectName,
		ShowHistory:     false,
		UseClientUID:    false,
		CustomCss:       customCss,
		WelcomeMessage: "",
	}, nil
}

// EmbedInfoParams for GetEmbedInfo
type EmbedInfoParams struct {
	ProjectID  string `json:"projectId" query:"projectId"`
	EmbedToken string `json:"embedToken" query:"embedToken"`
}
