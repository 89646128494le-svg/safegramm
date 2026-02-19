package testkey

import (
	"github.com/89646128494le-svg/safegram-core/internal/crypto"
)

var keyArr = [crypto.AESKeySize]byte{
	's', 'a', 'f', 'e', 'g', 'r', 'a', 'm',
	'-', 't', 'e', 's', 't', '-', 'k', 'e',
	'y', '-', '3', '2', '-', 'b', 'y', 't',
	'e', 's', '!', '!', '!', '!', '!', '!',
}

// Key is exactly AESKeySize bytes. Use for server/client tests only.
var Key = keyArr[:]
