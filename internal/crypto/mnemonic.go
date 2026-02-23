// Mnemonic (BIP39-style): сид-фраза и вывод seed. Приватный ключ из seed только на устройстве.
package crypto

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	"errors"
	"io"
	"strings"

	"golang.org/x/crypto/pbkdf2"
)

const (
	EntropySize256 = 32
	EntropySize128 = 16
	MnemonicWords  = 24
	MnemonicWords12 = 12
	BIP39WordCount = 2048
)

var (
	ErrEntropySize   = errors.New("crypto: entropy must be 32 bytes for 24 words")
	ErrMnemonicWords = errors.New("crypto: mnemonic must be 24 words")
	ErrUnknownWord   = errors.New("crypto: unknown word in mnemonic")
)

var bip39Words []string

func init() {
	bip39Words = make([]string, BIP39WordCount)
	for i := 0; i < BIP39WordCount; i++ {
		bip39Words[i] = loadBip39Word(i)
	}
}

func loadBip39Word(i int) string {
	if i < len(embeddedBip39) {
		return embeddedBip39[i]
	}
	return "word"
}

var embeddedBip39 = []string{
	"abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
	"access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
	"action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
	"adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
	"agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert",
	"alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter",
	"always", "amateur", "amazing", "among", "amount", "amused", "analyst", "anchor", "ancient", "anger",
	"angle", "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
	"anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april", "arch", "arctic",
	"area", "arena", "argue", "arm", "armed", "armor", "army", "around", "arrange", "arrest",
	"arrive", "arrow", "art", "artefact", "artist", "artwork", "ask", "aspect", "assault", "asset",
	"assist", "assume", "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction",
	"audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado", "avoid", "awake",
	"aware", "away", "awesome", "awful", "awkward", "axis", "baby", "bachelor", "bacon", "badge",
	"bag", "balance", "balcony", "ball", "bamboo", "banana", "banner", "bar", "barely", "bargain",
	"barrel", "base", "basic", "basket", "battle", "beach", "bean", "beauty", "because", "become",
	"beef", "before", "begin", "behave", "behind", "believe", "below", "belt", "bench", "benefit",
	"best", "betray", "better", "between", "beyond", "bicycle", "bid", "bike", "bind", "biology",
	"bird", "birth", "bitter", "black", "blade", "blame", "blanket", "blast", "bleak", "bless",
	"blind", "blood", "blossom", "blouse", "blue", "blur", "blush", "board", "boat", "body",
	"boil", "bomb", "bone", "bonus", "book", "boost", "border", "boring", "borrow", "boss",
	"bottom", "bounce", "box", "boy", "bracket", "brain", "brand", "brass", "brave", "bread",
	"breeze", "brick", "bridge", "brief", "bright", "bring", "brisk", "broccoli", "broken", "bronze",
	"broom", "brother", "brown", "brush", "bubble", "buddy", "budget", "buffalo", "build", "bulb",
	"bulk", "bullet", "bundle", "bunker", "burden", "burger", "burst", "bus", "business", "busy",
	"butter", "buyer", "buzz", "cabbage", "cabin", "cable", "cactus", "cage", "cake", "call",
	"calm", "camera", "camp", "can", "canal", "cancel", "candy", "cannon", "canoe", "canvas",
	"canyon", "capable", "capital", "captain", "car", "carbon", "card", "cargo", "carpet", "carry",
	"cart", "case", "cash", "casino", "castle", "casual", "cat", "catalog", "catch", "category",
	"cattle", "caught", "cause", "caution", "cave", "ceiling", "celery", "cement", "census", "century",
	"cereal", "certain", "chair", "chalk", "champion", "change", "chaos", "chapter", "charge", "chase",
	"chat", "cheap", "check", "cheese", "chef", "cherry", "chest", "chicken", "chief", "child",
	"chimney", "choice", "choose", "chronic", "chuckle", "chunk", "churn", "cigar", "cinnamon", "circle",
	"citizen", "city", "civil", "claim", "clap", "clarify", "claw", "clay", "clean", "clerk",
	"clever", "click", "client", "cliff", "climb", "clinic", "clip", "clock", "clog", "close",
	"cloth", "cloud", "clown", "club", "clump", "cluster", "clutch", "coach", "coast", "coconut",
	"code", "coffee", "coil", "coin", "collect", "color", "column", "combine", "come", "comfort",
	"comic", "common", "company", "concert", "conduct", "confirm", "congress", "connect", "consider", "control",
	"convince", "cook", "cool", "copper", "copy", "coral", "core", "corn", "correct", "cost",
}

func SetBip39Wordlist(words []string) {
	if len(words) >= BIP39WordCount {
		bip39Words = words[:BIP39WordCount]
	}
}

func GenerateEntropy() ([]byte, error) {
	entropy := make([]byte, EntropySize256)
	if _, err := io.ReadFull(rand.Reader, entropy); err != nil {
		return nil, err
	}
	return entropy, nil
}

func EntropyToMnemonic(entropy []byte) ([]string, error) {
	if len(entropy) != EntropySize256 {
		return nil, ErrEntropySize
	}
	checksum := sha256.Sum256(entropy)
	full := make([]byte, EntropySize256+1)
	copy(full, entropy)
	full[EntropySize256] = checksum[0]
	var words []string
	for i := 0; i < MnemonicWords; i++ {
		startBit := i * 11
		byteIdx := startBit / 8
		var idx uint16
		idx = uint16(full[byteIdx]) << 3
		if byteIdx+1 < len(full) {
			idx |= uint16(full[byteIdx+1]) >> 5
		}
		idx &= 0x7FF
		if int(idx) >= len(bip39Words) {
			idx = 0
		}
		words = append(words, bip39Words[idx])
	}
	return words, nil
}

func MnemonicToSeed(mnemonic []string, passphrase string) []byte {
	sentence := strings.Join(mnemonic, " ")
	return pbkdf2.Key([]byte(sentence), []byte("mnemonic"+passphrase), 2048, 64, sha512.New)
}

func WordToIndex(word string) int {
	w := strings.TrimSpace(strings.ToLower(word))
	for i, s := range bip39Words {
		if s == w {
			return i
		}
	}
	return -1
}

func MnemonicToEntropy(words []string) ([]byte, error) {
	if len(words) != MnemonicWords {
		return nil, ErrMnemonicWords
	}
	var fullBits []byte
	for i := 0; i < MnemonicWords; i++ {
		idx := WordToIndex(words[i])
		if idx < 0 {
			return nil, ErrUnknownWord
		}
		for b := 10; b >= 0; b-- {
			bit := (idx >> b) & 1
			fullBits = append(fullBits, byte(bit))
		}
	}
	if len(fullBits) != 264 {
		return nil, ErrMnemonicWords
	}
	full := make([]byte, 33)
	for i := 0; i < 33*8 && i < len(fullBits); i++ {
		if fullBits[i] == 1 {
			full[i/8] |= 1 << (7 - i%8)
		}
	}
	entropy := full[:32]
	checksum := sha256.Sum256(entropy)
	if checksum[0] != full[32] {
		return nil, errors.New("crypto: mnemonic checksum mismatch")
	}
	return entropy, nil
}

// GenerateMnemonic12 создаёт 12 слов (128 бит энтропии). Для регистрации; сид только в ответе, не в БД.
func GenerateMnemonic12() ([]string, error) {
	entropy := make([]byte, EntropySize128)
	if _, err := io.ReadFull(rand.Reader, entropy); err != nil {
		return nil, err
	}
	return EntropyToMnemonic12(entropy)
}

// EntropyToMnemonic12 превращает 16 байт энтропии в 12 слов (BIP39-style).
func EntropyToMnemonic12(entropy []byte) ([]string, error) {
	if len(entropy) != EntropySize128 {
		return nil, errors.New("crypto: entropy must be 16 bytes for 12 words")
	}
	checksum := sha256.Sum256(entropy)
	full := make([]byte, EntropySize128+1)
	copy(full, entropy)
	full[EntropySize128] = checksum[0]
	var words []string
	for i := 0; i < MnemonicWords12; i++ {
		startBit := i * 11
		byteIdx := startBit / 8
		var idx uint16
		idx = uint16(full[byteIdx]) << 3
		if byteIdx+1 < len(full) {
			idx |= uint16(full[byteIdx+1]) >> 5
		}
		idx &= 0x7FF
		if int(idx) >= len(bip39Words) {
			idx = 0
		}
		words = append(words, bip39Words[idx])
	}
	return words, nil
}

// Mnemonic12ToSeed возвращает 64-байтный seed из 12 слов (для вывода ключей только в RAM).
func Mnemonic12ToSeed(words []string, passphrase string) []byte {
	sentence := strings.Join(words, " ")
	return pbkdf2.Key([]byte(sentence), []byte("mnemonic"+passphrase), 2048, 64, sha512.New)
}
