import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
import joblib

# Synthetic dataset
np.random.seed(42)
heart_rate = np.random.randint(60, 120, 1000)
spo2 = np.random.uniform(92, 100, 1000)
bp = 0.5 * heart_rate + 0.8 * spo2 + np.random.normal(0, 5, 1000)

df = pd.DataFrame({
    'heart_rate': heart_rate,
    'spo2': spo2,
    'bp': bp
})

X = df[['heart_rate', 'spo2']]
y = df['bp']

model = LinearRegression()
model.fit(X, y)
joblib.dump(model, 'bp_model.pkl')

print("ML model saved as bp_model.pkl")

