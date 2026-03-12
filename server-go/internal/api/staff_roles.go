package api

import (
	"errors"
	"net/http"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

const (
	RoleUser           = "user"
	RoleSupportL1      = "support_l1"
	RoleSupportLead    = "support_lead"
	RoleModerator      = "moderator"
	RoleRiskAnalyst    = "risk_analyst"
	RoleSafety         = "safety"
	RoleBillingManager = "billing_manager"
	RoleReleaseManager = "release_manager"
	RoleSysadmin       = "sysadmin"
	RoleOwner          = "owner"
)

var roleAliases = map[string]string{
	"admin":    RoleSysadmin,
	"guardian": RoleSafety,
	"support":  RoleSupportLead,
}

var rolePriority = map[string]int{
	RoleUser:           0,
	RoleSupportL1:      1,
	RoleSupportLead:    2,
	RoleModerator:      3,
	RoleRiskAnalyst:    4,
	RoleSafety:         5,
	RoleBillingManager: 6,
	RoleReleaseManager: 7,
	RoleSysadmin:       8,
	RoleOwner:          9,
}

var assignableRoles = map[string]struct{}{
	RoleUser:           {},
	RoleSupportL1:      {},
	RoleSupportLead:    {},
	RoleModerator:      {},
	RoleRiskAnalyst:    {},
	RoleSafety:         {},
	RoleBillingManager: {},
	RoleReleaseManager: {},
	RoleSysadmin:       {},
	RoleOwner:          {},
}

func normalizeStaffRole(role string) string {
	normalized := strings.TrimSpace(strings.ToLower(role))
	if normalized == "" {
		return ""
	}
	if alias, ok := roleAliases[normalized]; ok {
		return alias
	}
	return normalized
}

func normalizeRoleList(roles []string) []string {
	if len(roles) == 0 {
		return []string{}
	}
	unique := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		normalized := normalizeStaffRole(role)
		if normalized == "" {
			continue
		}
		unique[normalized] = struct{}{}
	}
	if len(unique) == 0 {
		return []string{}
	}
	result := make([]string, 0, len(unique))
	for role := range unique {
		result = append(result, role)
	}
	sort.Slice(result, func(i, j int) bool {
		li := rolePriority[result[i]]
		lj := rolePriority[result[j]]
		if li == lj {
			return result[i] < result[j]
		}
		return li > lj
	})
	return result
}

func normalizedUserRoles(user models.User) []string {
	return normalizeRoleList(user.ParseRoles())
}

func userHasAnyNormalizedRole(user models.User, allowed ...string) bool {
	if len(allowed) == 0 {
		return false
	}
	userRoles := normalizedUserRoles(user)
	if len(userRoles) == 0 {
		return false
	}
	allowedSet := make(map[string]struct{}, len(allowed))
	for _, role := range allowed {
		if normalized := normalizeStaffRole(role); normalized != "" {
			allowedSet[normalized] = struct{}{}
		}
	}
	for _, role := range userRoles {
		if _, ok := allowedSet[role]; ok {
			return true
		}
	}
	return false
}

func userHasStaffAccess(user models.User) bool {
	for _, role := range normalizedUserRoles(user) {
		if role != RoleUser {
			if _, ok := rolePriority[role]; ok && rolePriority[role] > 0 {
				return true
			}
		}
	}
	return false
}

func userHighestRole(user models.User) string {
	roles := normalizedUserRoles(user)
	if len(roles) == 0 {
		return RoleUser
	}
	return roles[0]
}

func userRoleRank(user models.User) int {
	return rolePriority[userHighestRole(user)]
}

func normalizeAssignableRoles(roles []string) ([]string, error) {
	if len(roles) == 0 {
		return []string{RoleUser}, nil
	}
	normalized := normalizeRoleList(roles)
	if len(normalized) == 0 {
		return []string{RoleUser}, nil
	}
	cleaned := make([]string, 0, len(normalized))
	for _, role := range normalized {
		if _, ok := assignableRoles[role]; !ok {
			return nil, errors.New("invalid_role:" + role)
		}
		if role == RoleUser {
			continue
		}
		cleaned = append(cleaned, role)
	}
	if len(cleaned) == 0 {
		return []string{RoleUser}, nil
	}
	return cleaned, nil
}

func RequireStaffRoles(db *gorm.DB, roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			c.Abort()
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			c.Abort()
			return
		}

		if len(roles) == 0 {
			if !userHasStaffAccess(user) {
				c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
				c.Abort()
				return
			}
		} else if !userHasAnyNormalizedRole(user, roles...) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			c.Abort()
			return
		}

		c.Set("staffHighestRole", userHighestRole(user))
		c.Next()
	}
}
