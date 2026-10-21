package sshkeys

import (
	"crypto/sha256"
	"fmt"
	"strings"

	"golang.org/x/crypto/ssh"
)

const (
	artX = 17
	artY = 9
)

// GenerateRandomart produces the standard OpenSSH "Drunken Bishop" ASCII art
// representation for a given public key and its key title.
func GenerateRandomart(pubKey ssh.PublicKey, title string) string {
	hash := sha256.Sum256(pubKey.Marshal())

	var field [artY][artX]int
	x := artX / 2
	y := artY / 2

	// Drunken bishop walk: 4 steps per byte (2 bits each)
	for _, b := range hash {
		for i := 0; i < 4; i++ {
			dx := -1
			if (b & 0x1) != 0 {
				dx = 1
			}
			dy := -1
			if (b & 0x2) != 0 {
				dy = 1
			}

			x += dx
			y += dy

			if x < 0 {
				x = 0
			} else if x >= artX {
				x = artX - 1
			}

			if y < 0 {
				y = 0
			} else if y >= artY {
				y = artY - 1
			}

			field[y][x]++
			b >>= 2
		}
	}

	symbols := " .o+=*BOX@%&#/^"
	var output strings.Builder

	// Top border
	header := fmt.Sprintf("[%s]", title)
	if len(header) > artX-2 {
		header = header[:artX-2]
	}
	leftPad := (artX - len(header)) / 2
	rightPad := artX - len(header) - leftPad
	output.WriteString("+" + strings.Repeat("-", leftPad) + header + strings.Repeat("-", rightPad) + "+\n")

	// Art body
	for r := 0; r < artY; r++ {
		output.WriteString("|")
		for c := 0; c < artX; c++ {
			if r == artY/2 && c == artX/2 {
				output.WriteString("S") // Start
			} else if r == y && c == x {
				output.WriteString("E") // End
			} else {
				val := field[r][c]
				if val >= len(symbols) {
					val = len(symbols) - 1
				}
				output.WriteByte(symbols[val])
			}
		}
		output.WriteString("|\n")
	}

	// Bottom border
	footer := "[SHA256]"
	leftPadF := (artX - len(footer)) / 2
	rightPadF := artX - len(footer) - leftPadF
	output.WriteString("+" + strings.Repeat("-", leftPadF) + footer + strings.Repeat("-", rightPadF) + "+\n")

	return output.String()
}
