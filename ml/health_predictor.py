import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, mean_squared_error
import joblib
import warnings
warnings.filterwarnings('ignore')

class MaternalHealthPredictor:
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.feature_names = ['heart_rate', 'spo2', 'temperature', 'blood_pressure', 'pregnancy_week']
        
    def generate_synthetic_data(self, n_samples=10000):
        """Generate realistic synthetic data for maternal health"""
        np.random.seed(42)
        
        # Base parameters for pregnant women
        base_hr = np.random.normal(85, 15, n_samples)  # Higher baseline during pregnancy
        base_spo2 = np.random.normal(97, 2, n_samples)
        base_temp = np.random.normal(37.0, 0.5, n_samples)
        base_bp = np.random.normal(110, 15, n_samples)
        pregnancy_week = np.random.randint(1, 41, n_samples)
        
        # Add correlations and realistic variations
        # Heart rate increases with pregnancy week
        hr = base_hr + (pregnancy_week - 20) * 0.5 + np.random.normal(0, 5, n_samples)
        
        # SpO2 slightly decreases with pregnancy week
        spo2 = base_spo2 - (pregnancy_week - 20) * 0.02 + np.random.normal(0, 1, n_samples)
        
        # Temperature variations
        temp = base_temp + np.random.normal(0, 0.3, n_samples)
        
        # Blood pressure variations
        bp = base_bp + np.random.normal(0, 10, n_samples)
        
        # Create health status labels
        health_status = self._generate_health_labels(hr, spo2, temp, bp, pregnancy_week)
        
        # Create risk scores
        risk_score = self._calculate_risk_score(hr, spo2, temp, bp, pregnancy_week)
        
        # Create next day predictions
        next_day_hr = hr + np.random.normal(0, 3, n_samples)
        next_day_spo2 = spo2 + np.random.normal(0, 1, n_samples)
        next_day_temp = temp + np.random.normal(0, 0.2, n_samples)
        next_day_bp = bp + np.random.normal(0, 5, n_samples)
        
        df = pd.DataFrame({
            'heart_rate': hr,
            'spo2': spo2,
            'temperature': temp,
            'blood_pressure': bp,
            'pregnancy_week': pregnancy_week,
            'health_status': health_status,
            'risk_score': risk_score,
            'next_day_hr': next_day_hr,
            'next_day_spo2': next_day_spo2,
            'next_day_temp': next_day_temp,
            'next_day_bp': next_day_bp
        })
        
        return df
    
    def _generate_health_labels(self, hr, spo2, temp, bp, pregnancy_week):
        """Generate health status labels based on vital signs"""
        labels = []
        
        for i in range(len(hr)):
            score = 0
            
            # Heart rate scoring
            if hr[i] > 120 or hr[i] < 50:
                score += 3  # Critical
            elif hr[i] > 100 or hr[i] < 60:
                score += 2  # Warning
            elif 60 <= hr[i] <= 100:
                score += 0  # Normal
            
            # SpO2 scoring
            if spo2[i] < 90:
                score += 3  # Critical
            elif spo2[i] < 95:
                score += 2  # Warning
            else:
                score += 0  # Normal
            
            # Temperature scoring
            if temp[i] > 38.0 or temp[i] < 36.0:
                score += 3  # Critical
            elif temp[i] > 37.5 or temp[i] < 36.5:
                score += 2  # Warning
            else:
                score += 0  # Normal
            
            # Blood pressure scoring
            if bp[i] > 160 or bp[i] < 90:
                score += 3  # Critical