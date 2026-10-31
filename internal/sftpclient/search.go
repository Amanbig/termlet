package sftpclient

import (
	"context"
	"fmt"
	"path"
	"strings"
	"termlet/internal/models"
	"time"
)

// Ignored directory names for recursive workspace searches
var ignoredDirNames = map[string]bool{
	".git":         true,
	".hg":          true,
	".svn":         true,
	"node_modules": true,
	".next":        true,
	".nuxt":        true,
	"dist":         true,
	"build":        true,
	"out":          true,
	"vendor":       true,
	"target":       true,
	"bin":          true,
	"obj":          true,
	"__pycache__":  true,
	".venv":        true,
	"venv":         true,
	"env":          true,
	".cache":       true,
	".idea":        true,
	".vscode":      true,
	".terraform":   true,
	".docker":      true,
}

// SearchFiles searches for files within rootPath.
// It tries fast SSH command execution (find) first, falling back to BFS SFTP directory traversal.
func (c *Client) SearchFiles(rootPath string, query string, maxResults int) ([]models.RemoteFile, error) {
	if c == nil {
		return nil, fmt.Errorf("sftp client is not initialized")
	}

	if maxResults <= 0 {
		maxResults = 500
	} else if maxResults > 2000 {
		maxResults = 2000
	}

	// Resolve root directory
	if rootPath == "" || rootPath == "." {
		c.mu.Lock()
		if c.sftpClient != nil {
			wd, err := c.sftpClient.Getwd()
			if err == nil && wd != "" {
				rootPath = wd
			} else {
				rootPath = "/"
			}
		} else {
			rootPath = "/"
		}
		c.mu.Unlock()
	}

	// Clean root path
	rootPath = path.Clean(rootPath)

	// Try fast SSH execution first if SSH client is available
	if c.sshClient != nil {
		results, err := c.searchWithSSHExec(rootPath, query, maxResults)
		if err == nil {
			return results, nil
		}
	}

	// Fallback to SFTP BFS directory traversal
	return c.searchWithSFTPWalk(rootPath, query, maxResults)
}

// searchWithSSHExec executes a remote find command for near-instant results on Unix-like servers.
func (c *Client) searchWithSSHExec(rootPath string, query string, maxResults int) ([]models.RemoteFile, error) {
	session, err := c.sshClient.NewSession()
	if err != nil {
		return nil, err
	}
	defer session.Close()

	// Build prune arguments
	var pruneClauses []string
	for dir := range ignoredDirNames {
		pruneClauses = append(pruneClauses, fmt.Sprintf("-name %q", dir))
	}
	pruneExpr := strings.Join(pruneClauses, " -o ")

	// Sanitize query to avoid command injection
	cleanQuery := strings.ReplaceAll(query, `"`, `\"`)
	cleanQuery = strings.ReplaceAll(cleanQuery, "`", "")
	cleanQuery = strings.ReplaceAll(cleanQuery, "$", "")
	cleanQuery = strings.ReplaceAll(cleanQuery, ";", "")
	cleanQuery = strings.ReplaceAll(cleanQuery, "&", "")
	cleanQuery = strings.ReplaceAll(cleanQuery, "|", "")

	// Construct find command
	var cmd string
	escapedRoot := fmt.Sprintf("%q", rootPath)
	if strings.TrimSpace(cleanQuery) != "" {
		cmd = fmt.Sprintf("find %s -maxdepth 8 \\( %s \\) -prune -o -type f -iname \"*%s*\" -print 2>/dev/null | head -n %d",
			escapedRoot, pruneExpr, cleanQuery, maxResults)
	} else {
		cmd = fmt.Sprintf("find %s -maxdepth 8 \\( %s \\) -prune -o -type f -print 2>/dev/null | head -n %d",
			escapedRoot, pruneExpr, maxResults)
	}

	// Run with 4 second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()

	type result struct {
		out []byte
		err error
	}
	resChan := make(chan result, 1)

	go func() {
		out, runErr := session.Output(cmd)
		resChan <- result{out: out, err: runErr}
	}()

	select {
	case <-ctx.Done():
		_ = session.Signal("KILL")
		_ = session.Close()
		return nil, fmt.Errorf("ssh find search timed out")
	case res := <-resChan:
		if res.err != nil && len(res.out) == 0 {
			return nil, res.err
		}

		lines := strings.Split(string(res.out), "\n")
		var files []models.RemoteFile
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			name := path.Base(line)
			files = append(files, models.RemoteFile{
				Name:    name,
				Path:    line,
				IsDir:   false,
				ModTime: time.Now().Unix(),
			})
			if len(files) >= maxResults {
				break
			}
		}
		return files, nil
	}
}

// searchWithSFTPWalk provides a robust, non-blocking fallback when SSH exec is not supported or timed out.
func (c *Client) searchWithSFTPWalk(rootPath string, query string, maxResults int) ([]models.RemoteFile, error) {
	c.mu.Lock()
	if c.closed || c.sftpClient == nil {
		c.mu.Unlock()
		return nil, fmt.Errorf("sftp client is closed or not initialized")
	}
	sftpCl := c.sftpClient
	c.mu.Unlock()

	queryLower := strings.ToLower(strings.TrimSpace(query))
	results := []models.RemoteFile{}

	type dirEntry struct {
		dirPath string
		depth   int
	}

	queue := []dirEntry{{dirPath: rootPath, depth: 0}}
	maxDepth := 4
	deadline := time.Now().Add(2500 * time.Millisecond)
	visitedDirs := 0
	const maxDirs = 40

	for len(queue) > 0 {
		if time.Now().After(deadline) || visitedDirs >= maxDirs || len(results) >= maxResults {
			break
		}

		current := queue[0]
		queue = queue[1:]

		if current.depth > maxDepth {
			continue
		}

		visitedDirs++
		entries, err := sftpCl.ReadDir(current.dirPath)
		if err != nil {
			// Skip directories that cannot be read (permission denied, etc.)
			continue
		}

		for _, entry := range entries {
			entryName := entry.Name()
			fullPath := path.Join(current.dirPath, entryName)

			if entry.IsDir() {
				if ignoredDirNames[entryName] || (strings.HasPrefix(entryName, ".") && current.depth > 0) {
					continue
				}
				if current.depth < maxDepth {
					queue = append(queue, dirEntry{dirPath: fullPath, depth: current.depth + 1})
				}
			} else {
				if queryLower == "" || strings.Contains(strings.ToLower(entryName), queryLower) || strings.Contains(strings.ToLower(fullPath), queryLower) {
					results = append(results, models.RemoteFile{
						Name:        entryName,
						Path:        fullPath,
						IsDir:       false,
						Size:        entry.Size(),
						ModTime:     entry.ModTime().Unix(),
						Permissions: uint32(entry.Mode().Perm()),
					})
					if len(results) >= maxResults {
						return results, nil
					}
				}
			}
		}
	}

	return results, nil
}
