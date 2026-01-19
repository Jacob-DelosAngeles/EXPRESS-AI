import numpy as np
import cv2
import logging

logger = logging.getLogger(__name__)

class RoadCalibrator:
    """
    Handles Inverse Perspective Mapping (IPM) to convert 2D image pixels 
    into real-world physical area ($m^2$).
    """
    
    def __init__(self, 
                 sensor_width_mm=4.71,   # iPhone/Samsung standard sensor
                 focal_length_mm=4.0,    # Standard wide lens
                 cam_height_m=1.2,       # Standard dashboard mount height
                 cam_pitch_deg=-15.0,    # Angled down 15 degrees
                 img_width=1920,
                 img_height=1080):
        
        self.cam_h = cam_height_m
        self.cam_pitch = np.radians(cam_pitch_deg)
        self.f_mm = focal_length_mm
        self.w_mm = sensor_width_mm
        
        self.img_w = img_width
        self.img_h = img_height
        
        # Calculate pixel-to-meter scaling locally
        self.ipm_matrix = self._compute_ipm_matrix()
        
        # Approximate conversion factor ($m^2$ per pixel) at the "sweet spot"
        # (center of lane, ~5 meters ahead)
        self.params = self._calibrate_dummy()
        
    def _compute_ipm_matrix(self):
        """
        Compute the homography matrix to warp perspective view to bird's eye view.
        Simple 4-point transform assuming flat road.
        """
        # Define 4 points in the Image (Trapezoid looking down the road)
        # Bottom-Left, Bottom-Right, Top-Right, Top-Left
        h, w = self.img_h, self.img_w
        
        # Region of Interest (ROI) - The road lane ahead
        src_points = np.float32([
            [w * 0.1, h * 0.95],  # Bottom Left (close to hood)
            [w * 0.9, h * 0.95],  # Bottom Right
            [w * 0.65, h * 0.45], # Top Right (further away)
            [w * 0.35, h * 0.45]  # Top Left
        ])
        
        # Destination Points (Bird's Eye View - Rectangular)
        # Represents a physical rectangle of ~3.5m width x ~10m length
        dst_points = np.float32([
            [w * 0.2, h],         # Bottom Left
            [w * 0.8, h],         # Bottom Right
            [w * 0.8, 0],         # Top Right
            [w * 0.2, 0]          # Top Left
        ])
        
        matrix = cv2.getPerspectiveTransform(src_points, dst_points)
        return matrix

    def _calibrate_dummy(self):
        """
        Returns a simplified Area-per-Pixel constant for MVP.
        In a real app, this changes based on Y-coordinate (further = larger pixels).
        """
        # MVP Approximation:
        # At 5 meters distance, 1 pixel width ≈ 0.2 cm
        return {
            "m2_per_pixel": 0.000025  # Very rough average for 1080p
        }

    def estimate_area_from_bbox(self, w_px, h_px, y_center_px):
        """
        Estimate real-world area ($m^2$) from a Bounding Box.
        
        Args:
            w_px: Width of box in pixels
            h_px: Height of box in pixels
            y_center_px: Vertical position (lower Y = further away)
            
        Returns:
            float: Estimated Area in Square Meters ($m^2$)
        """
        # Perspective Correction Factor
        # Objects higher in the image (smaller y) are further away, 
        # so each pixel represents MORE area.
        
        # Normalize Y (0 = top/horizon, 1 = bottom/hood)
        normalized_y = y_center_px / self.img_h
        
        # Linear scaling factor (Simple approximation)
        # Close (y=1.0) -> Scale 1x
        # Far (y=0.4) -> Scale 4x (because things shrink in distance)
        distance_scale = 1.0 + (1.0 - normalized_y) * 3.0
        
        adjusted_w = w_px * distance_scale
        adjusted_h = h_px * distance_scale
        
        # Calculate Area
        # Using calibrated constant
        pixel_area = adjusted_w * adjusted_h
        area_m2 = pixel_area * self.params["m2_per_pixel"]
        
        return round(area_m2, 4)

    def estimate_area_from_mask(self, mask_pixel_count, y_center_px):
        """
        Estimate real-world area ($m^2$) from a Segmentation Mask count.
        Much more accurate than BBox.
        """
        normalized_y = y_center_px / self.img_h
        distance_scale = 1.0 + (1.0 - normalized_y) * 3.0
        
        # Area scales quadratically with distance scaling
        adjusted_pixels = mask_pixel_count * (distance_scale ** 2)
        
        area_m2 = adjusted_pixels * self.params["m2_per_pixel"]
        return round(area_m2, 4)
