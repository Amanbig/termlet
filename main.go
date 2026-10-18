package main

import (
	"embed"
	"os"
	"runtime/debug"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

func init() {
	// WebKitGTK 2.42+ uses DMA-BUF / GBM buffers by default, which can fail on NVIDIA/Mesa drivers
	// with "KMS: DRM_IOCTL_MODE_CREATE_DUMB failed: Permission denied".
	// Setting WEBKIT_DISABLE_DMABUF_RENDERER=1 tells WebKitGTK to fall back to standard rendering.
	if os.Getenv("WEBKIT_DISABLE_DMABUF_RENDERER") == "" {
		_ = os.Setenv("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
	}

	// Optimize Go runtime for desktop memory efficiency:
	debug.SetGCPercent(50)
	debug.SetMemoryLimit(256 * 1024 * 1024)
}

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

func main() {
	// Automatically register icon and desktop entry on Linux for standalone desktop binaries
	installDesktopIntegration(appIcon)

	// Periodic idle OS memory scavenger to return unused heap pages back to the OS
	go func() {
		ticker := time.NewTicker(45 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			debug.FreeOSMemory()
		}
	}()

	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "Termlet",
		Width:     1100,
		Height:    800,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 24, G: 24, B: 27, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
		Linux: &linux.Options{
			Icon:                appIcon,
			ProgramName:         "termlet",
			WindowIsTranslucent: true,
			WebviewGpuPolicy:    linux.WebviewGpuPolicyOnDemand,
		},
		Windows: &windows.Options{
			DisableFramelessWindowDecorations: false,
			WindowIsTranslucent:               true,
			WebviewIsTransparent:              true,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
