// Реальная нейросеть: многослойный перцептрон (MLP) с обратным распространением.
// Используется для оценки аномальности по признакам (например, из логов).
package engine

import (
	"math"
	"math/rand"
)

// Matrix — плотная матрица row-major: data[i*cols + j] = строка i, столбец j.
type Matrix struct {
	Rows, Cols int
	Data       []float64
}

func newMatrix(rows, cols int) Matrix {
	return Matrix{Rows: rows, Cols: cols, Data: make([]float64, rows*cols)}
}

func (m Matrix) at(i, j int) float64 { return m.Data[i*m.Cols+j] }
func (m Matrix) set(i, j int, v float64) { m.Data[i*m.Cols+j] = v }

// Xavier: инициализация весов для ReLU.
func xavier(m *Matrix) {
	n := float64(m.Cols)
	for i := range m.Data {
		m.Data[i] = (rand.Float64()*2 - 1) * math.Sqrt(6/n)
	}
}

func sigmoid(x float64) float64 {
	if x < -20 {
		return 0
	}
	if x > 20 {
		return 1
	}
	return 1 / (1 + math.Exp(-x))
}
func sigmoidDeriv(y float64) float64 { return y * (1 - y) }

func relu(x float64) float64 {
	if x > 0 {
		return x
	}
	return 0
}
func reluDeriv(y float64) float64 {
	if y > 0 {
		return 1
	}
	return 0
}

// MLP — многослойный перцептрон: вход -> скрытый слой (ReLU) -> выход (sigmoid).
type MLP struct {
	In, Hidden, Out int
	W1              Matrix // Hidden x In
	B1              []float64
	W2              Matrix // Out x Hidden
	B2              []float64
	// кэш последнего forward для backprop и объяснений
	lastInput []float64
	z1, a1    []float64
	z2, a2    []float64
}

// NewMLP создаёт сеть с одним скрытым слоем.
func NewMLP(in, hidden, out int) *MLP {
	nn := &MLP{In: in, Hidden: hidden, Out: out}
	nn.W1 = newMatrix(hidden, in)
	nn.B1 = make([]float64, hidden)
	nn.W2 = newMatrix(out, hidden)
	nn.B2 = make([]float64, out)
	xavier(&nn.W1)
	xavier(&nn.W2)
	return nn
}

// Forward выполняет прямой проход. Возвращает выходной вектор (один элемент для бинарной классификации).
func (nn *MLP) Forward(input []float64) []float64 {
	if len(input) != nn.In {
		return nil
	}
	nn.lastInput = resize(nn.lastInput, nn.In)
	copy(nn.lastInput, input)
	nn.z1 = resize(nn.z1, nn.Hidden)
	nn.a1 = resize(nn.a1, nn.Hidden)
	nn.z2 = resize(nn.z2, nn.Out)
	nn.a2 = resize(nn.a2, nn.Out)
	// Скрытый слой: z1 = W1*x + b1, a1 = relu(z1)
	for i := 0; i < nn.Hidden; i++ {
		sum := nn.B1[i]
		for j := 0; j < nn.In; j++ {
			sum += nn.W1.at(i, j) * input[j]
		}
		nn.z1[i] = sum
		nn.a1[i] = relu(sum)
	}
	// Выход: z2 = W2*a1 + b2, a2 = sigmoid(z2)
	for i := 0; i < nn.Out; i++ {
		sum := nn.B2[i]
		for j := 0; j < nn.Hidden; j++ {
			sum += nn.W2.at(i, j) * nn.a1[j]
		}
		nn.z2[i] = sum
		nn.a2[i] = sigmoid(sum)
	}
	return nn.a2
}

// Backward считает градиенты по весам и обновляет веса (SGD). lossGrad — градиент по выходу (обычно target - output для MSE).
func (nn *MLP) Backward(input []float64, lossGrad []float64, lr float64) {
	if len(lossGrad) != nn.Out {
		return
	}
	// Выходной слой: dL/dz2 = lossGrad * sigmoid'(a2)
	dZ2 := make([]float64, nn.Out)
	for i := 0; i < nn.Out; i++ {
		dZ2[i] = lossGrad[i] * sigmoidDeriv(nn.a2[i])
	}
	// dW2, dB2
	for i := 0; i < nn.Out; i++ {
		for j := 0; j < nn.Hidden; j++ {
			nn.W2.set(i, j, nn.W2.at(i, j)-lr*dZ2[i]*nn.a1[j])
		}
		nn.B2[i] -= lr * dZ2[i]
	}
	// dL/da1 = W2^T * dZ2
	dA1 := make([]float64, nn.Hidden)
	for j := 0; j < nn.Hidden; j++ {
		for i := 0; i < nn.Out; i++ {
			dA1[j] += nn.W2.at(i, j) * dZ2[i]
		}
	}
	// dZ1 = dA1 * relu'(z1)
	dZ1 := make([]float64, nn.Hidden)
	for j := 0; j < nn.Hidden; j++ {
		dZ1[j] = dA1[j] * reluDeriv(nn.a1[j])
	}
	// dW1, dB1
	for i := 0; i < nn.Hidden; i++ {
		for j := 0; j < nn.In; j++ {
			nn.W1.set(i, j, nn.W1.at(i, j)-lr*dZ1[i]*input[j])
		}
		nn.B1[i] -= lr * dZ1[i]
	}
}

func resize(s []float64, n int) []float64 {
	if cap(s) >= n {
		return s[:n]
	}
	return make([]float64, n)
}

// Train выполняет одну эпоху SGD: для каждого примера forward, MSE градиент, backward, update.
func (nn *MLP) Train(X [][]float64, y []float64, lr float64) float64 {
	if len(X) != len(y) {
		return 0
	}
	var totalLoss float64
	perm := rand.Perm(len(X))
	for _, idx := range perm {
		out := nn.Forward(X[idx])
		if out == nil {
			continue
		}
		// MSE: L = (target - out)^2, dL/dout = 2*(out - target)
		target := y[idx]
		loss := 0.0
		grad := make([]float64, nn.Out)
		for i := range out {
			diff := out[i] - target
			loss += diff * diff
			grad[i] = 2 * diff
		}
		totalLoss += loss
		nn.Backward(X[idx], grad, lr)
	}
	if len(X) > 0 {
		return totalLoss / float64(len(X))
	}
	return totalLoss
}

// Predict возвращает выход сети для одного вектора (вероятность для бинарной классификации).
func (nn *MLP) Predict(x []float64) float64 {
	out := nn.Forward(x)
	if out == nil || len(out) == 0 {
		return 0
	}
	return out[0]
}

// GradientToInput возвращает градиент выхода по входам (для объяснения: какие признаки сильнее влияют).
// gradOut — градиент по выходу (обычно [1] для единственного выхода). Использует кэш последнего Forward.
func (nn *MLP) GradientToInput(gradOut []float64) []float64 {
	if len(gradOut) != nn.Out || len(nn.lastInput) != nn.In {
		return nil
	}
	dZ2 := make([]float64, nn.Out)
	for i := 0; i < nn.Out; i++ {
		dZ2[i] = gradOut[i] * sigmoidDeriv(nn.a2[i])
	}
	dA1 := make([]float64, nn.Hidden)
	for j := 0; j < nn.Hidden; j++ {
		for i := 0; i < nn.Out; i++ {
			dA1[j] += nn.W2.at(i, j) * dZ2[i]
		}
	}
	dZ1 := make([]float64, nn.Hidden)
	for j := 0; j < nn.Hidden; j++ {
		dZ1[j] = dA1[j] * reluDeriv(nn.a1[j])
	}
	gradIn := make([]float64, nn.In)
	for j := 0; j < nn.In; j++ {
		for i := 0; i < nn.Hidden; i++ {
			gradIn[j] += nn.W1.at(i, j) * dZ1[i]
		}
	}
	return gradIn
}
