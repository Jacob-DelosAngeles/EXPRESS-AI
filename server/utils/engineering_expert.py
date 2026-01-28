from typing import Dict, Any, Optional

class EngineeringExpert:
    """
    Deterministically determines the rehabilitation method and condition rating
    based on the Pavement Distress & Rehabilitation Matrix (DPWH Standards).
    """

    @staticmethod
    def diagnose(defect_type: str, 
                 metric_value: float, 
                 pavement_type: str = 'asphalt') -> Dict[str, Any]:
        """
        Diagnose the condition and recommend an action.

        Args:
            defect_type: 'pothole', 'linear_crack', 'fatigue_crack', 'roughness', 'rutting'
            metric_value: The quantitative metric (e.g., Density %, IRI value, Length in m)
            pavement_type: 'asphalt' or 'concrete'

        Returns:
            Dict with keys: 'status', 'color', 'action', 'method', 'insight'
        """
        dt = defect_type.lower()
        
        # Default response
        recommendation = {
            "status": "UNKNOWN",
            "color": "gray",
            "action": "Inspect",
            "method": "Manual verification required",
            "insight": "Data insufficient for automatic diagnosis.",
            "cause": "Unknown",
            "pre_rehab_assessment": "Conduct initial site survey."
        }

        # --- 1. POTHOLES (Metric: Density %) ---
        if dt == 'pothole':
            cause = "Trapped moisture and fatigue due to traffic"
            pre_rehab_assessment = [
                "Check for possible flooding",
                "Identify traffic characteristics",
                "Evaluate concentration every 100m"
            ]

            if metric_value > 30.0:
                recommendation = {
                    "status": "CRITICAL",
                    "color": "red",
                    "action": "Major Rehabilitation",
                    "method": "Mill pavement surface to remove all potholes, then reconstruct surface.",
                    "insight": "Concentration exceeds 30%. Structural failure likely.",
                    "cause": cause,
                    "pre_rehab_assessment": pre_rehab_assessment
                }
            elif metric_value >= 10.0:
                recommendation = {
                    "status": "WARNING",
                    "color": "yellow",
                    "action": "Conditional Patching",
                    "method": "Apply patching. Verify if area is prone to flooding.",
                    "vlm_prompt": "Check for signs of standing water or poor drainage near the potholes.",
                    "insight": "Concentration between 10-30%. Drainage check recommended.",
                    "cause": cause,
                    "pre_rehab_assessment": pre_rehab_assessment
                }
            else:
                recommendation = {
                    "status": "GOOD",
                    "color": "green",
                    "action": "Patching",
                    "method": "Apply standard patching.",
                    "insight": "Low concentration (<10%). Routine maintenance.",
                    "cause": cause,
                    "pre_rehab_assessment": pre_rehab_assessment
                }

        # --- 2. ROUGHNESS / IRI (Metric: IRI in m/km) ---
        elif dt == 'roughness' or dt == 'iri':
            cause = "Change in pavement surface from traffic or environmental conditions"
            if metric_value > 4.0:
                recommendation = {
                    "status": "CRITICAL",
                    "color": "red",
                    "action": "Major Rehabilitation",
                    "method": "Complete removal and reconstruction of existing pavement.",
                    "insight": "IRI exceeds 4m/km. Severe ride quality issues.",
                    "cause": cause,
                    "pre_rehab_assessment": "Identify sections with severe roughness."
                }
            elif metric_value >= 2.0:
                recommendation = {
                    "status": "WARNING",
                    "color": "yellow",
                    "action": "Resurfacing",
                    "method": "Identify cause (patching/potholes vs pavement failure). Apply resurfacing.",
                    "vlm_prompt": "Determine if roughness is caused by surface patches or general pavement undulation.",
                    "insight": "IRI between 2-4m/km. Surface restoration needed.",
                    "cause": cause,
                    "pre_rehab_assessment": "Determine if roughness is coming from potholes, patching, and other objects."
                }
            else:
                recommendation = {
                    "status": "GOOD",
                    "color": "green",
                    "action": "No Action",
                    "method": "Do nothing. Pavement is in good condition.",
                    "insight": "IRI < 2m/km. Excellent ride quality.",
                    "cause": cause,
                    "pre_rehab_assessment": "Monitor condition."
                }

        # --- 3. CRACKING (Metric: Density % or Avg Length) ---
        elif dt == 'linear_crack' or dt == 'crack':
            cause = "Tire Pressure, Aging, Insufficient Thickness"
            # When diagnosing a trip, metric_value is Density % (0-100)
            if metric_value > 20.0:
                recommendation = {
                    "status": "CRITICAL",
                    "color": "red",
                    "action": "Mill and Fill",
                    "method": "Crack depth likely extends to bottom. Conduct full rehab or Mill & Fill.",
                    "insight": "Crack density exceeds 20%. Structural integrity compromised.",
                    "cause": cause,
                    "pre_rehab_assessment": "Identify traffic characteristics."
                }
            elif metric_value >= 5.0:
                recommendation = {
                    "status": "WARNING",
                    "color": "yellow",
                    "action": "Sealing",
                    "method": "Conduct density check. Apply crack sealing.",
                    "vlm_prompt": "Check if cracks are interconnected (alligator pattern) or if there are signs of pumping.",
                    "insight": "Crack density 5-20%. Prevent moisture infiltration through sealing.",
                    "cause": cause,
                    "pre_rehab_assessment": "Determine previous rehabilitation year."
                }
            else:
                 recommendation = {
                    "status": "GOOD",
                    "color": "green",
                    "action": "No Action",
                    "method": "Monitor condition.",
                    "insight": "Minor cracking detected (Density <5%). Routine monitoring.",
                    "cause": cause,
                    "pre_rehab_assessment": "Conduct field coring."
                }
        
        # --- 4. FATIGUE CRACKING ---
        elif dt == 'fatigue_crack':
            cause = "Traffic Volume, Weak material, Insufficient Thickness"
            # Placeholder values for metric_value (assuming normalized score 0-100 or area for now)
            # This part is illustrative as main focus is Pothole/IRI
            recommendation = {
                "status": "UNKNOWN",
                "color": "gray",
                "action": " Inspect",
                "method": "Check thickness and traffic volume.",
                "insight": "Fatigue cracking detected.",
                "cause": cause,
                "pre_rehab_assessment": "Identify surfacing material."
            }

        return recommendation
