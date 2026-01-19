from typing import Dict, Any

class CostCalculator:
    """
    Calculates estimated repair costs based on defect area and pavement type.
    Uses standard unit rates (defaults based on Philippine DPWH estimates).
    """
    
    # Unit Rates per Square Meter (PHP)
    # These can be overridden via config or API in the future
    DEFAULT_RATES = {
        "pothole": {
            "asphalt": 1200.0,  # ASPHALT PATCHING per sqm
            "concrete": 1800.0, # CONCRETE REBLOCKING per sqm
            "gravel": 500.0     # GRAVEL RESURFACING per sqm
        },
        "alligator_crack": {
            "asphalt": 850.0,   # SEALING/OVERLAY per sqm
            "concrete": 0.0     # (Rare for alligator, usually reblocking)
        },
        "linear_crack": {
            "asphalt": 450.0,   # CRACK SEALING per sqm (linear meter converted)
            "concrete": 600.0
        }
    }

    @staticmethod
    def calculate_repair_cost(defect_type: str, 
                              pavement_type: str, 
                              area_m2: float) -> Dict[str, Any]:
        """
        Calculate total repair cost.
        
        Args:
            defect_type: 'pothole', 'crack', etc.
            pavement_type: 'asphalt', 'concrete', 'gravel'
            area_m2: Physical area of the defect
            
        Returns:
            Dict containing cost breakdown
        """
        
        # Normalize inputs
        dt = defect_type.lower()
        pt = pavement_type.lower()
        
        # Map generic 'crack' to 'linear_crack' if not specified
        if dt == 'crack': 
            dt = 'linear_crack'
        
        # Fallback to 'pothole' if unknown, 'asphalt' if unknown
        base_rates = CostCalculator.DEFAULT_RATES.get(dt, CostCalculator.DEFAULT_RATES['pothole'])
        rate = base_rates.get(pt, base_rates.get('asphalt', 1200.0))
        
        # Calculate
        total_cost = area_m2 * rate
        
        # Determine Severity based on Cost/Area
        # Simple heuristic: > 1m2 is SEVERE, > 0.3m2 is MODERATE
        severity = "LOW"
        if area_m2 > 1.0:
            severity = "HIGH"
        elif area_m2 > 0.3:
            severity = "MEDIUM"
            
        return {
            "total_cost_php": round(total_cost, 2),
            "unit_rate_used": rate,
            "severity": severity,
            "currency": "PHP"
        }
