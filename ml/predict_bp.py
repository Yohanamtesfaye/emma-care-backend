import sys
import json
import os
import warnings
from contextlib import redirect_stderr

def simple_bp_prediction(hr, spo2):
    """
    Simple blood pressure prediction based on heart rate and SpO2
    This is a fallback when ML model fails
    """
    # Base systolic BP calculation
    base_bp = 120  # Normal baseline
    
    # Adjust based on heart rate
    if hr > 100:
        bp_adjustment = (hr - 100) * 0.8  # Higher HR = higher BP
    elif hr < 60:
        bp_adjustment = (60 - hr) * 0.5   # Lower HR = lower BP
    else:
        bp_adjustment = 0
    
    # Adjust based on SpO2
    if spo2 < 95:
        spo2_adjustment = (95 - spo2) * 2  # Lower SpO2 = higher BP
    else:
        spo2_adjustment = 0
    
    # Calculate final BP
    systolic_bp = base_bp + bp_adjustment + spo2_adjustment
    
    # Ensure reasonable range
    systolic_bp = max(80, min(180, systolic_bp))
    
    return round(systolic_bp, 1)

def main():
    # Suppress all warnings
    warnings.filterwarnings("ignore")
    
    try:
        # Force flush output
        sys.stdout.reconfigure(line_buffering=True)
        
        hr = float(sys.argv[1])
        spo2 = float(sys.argv[2])
        
        if hr <= 0 or spo2 <= 0:
            raise ValueError("HR and SpO2 must be positive")
        
        # Try ML model first, fallback to simple prediction
        try:
            import joblib
            model_path = os.path.join(os.path.dirname(__file__), "bp_model.pkl")
            
            if os.path.exists(model_path):
                model = joblib.load(model_path)
                bp = round(float(model.predict([[hr, spo2]])[0]), 2)
            else:
                bp = simple_bp_prediction(hr, spo2)
                
        except Exception as ml_error:
            # Fallback to simple prediction
            bp = simple_bp_prediction(hr, spo2)
        
        # Output result
        result = {"bp": bp}
        print(json.dumps(result), flush=True)
        
    except Exception as e:
        # Error handling
        error_result = {"error": str(e)}
        print(json.dumps(error_result), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    with redirect_stderr(sys.stdout):
        main()