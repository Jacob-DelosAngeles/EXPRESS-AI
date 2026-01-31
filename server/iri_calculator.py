import pandas as pd
import numpy as np
from scipy import signal
from scipy.integrate import cumulative_trapezoid
import matplotlib.pyplot as plt
from math import radians, cos, sin, sqrt, atan2
import warnings
warnings.filterwarnings('ignore')




class IRICalculator:
    
    # Speed-aware IRI calculation constants
    MIN_VALID_SPEED = 5.0       # m/s (~18 km/h) - Below this, flag as low-speed
    REFERENCE_SPEED = 10.0      # m/s (~36 km/h) - Used for extrapolation
    SPEED_EXPONENT = 0.9        # Damped exponent (was 1.0) - 0.9 for mild correction
    MAX_IRI_CAP = 16.0          # m/km - Maximum IRI for low-speed segments
    K = 80.59                   # Calibration constant

    # Initialization
    def __init__(self):
        self.gravity = 9.81 
        self.iri_segments = []

    # Loads the Data
    def load_data(self, csv_file):
        try:
            df = pd.read_csv(csv_file)
            print(f"Loaded data has {len(df)} rows")
            print(f"Features: {list(df.columns)}")
            return df
        except Exception as e:
            print(f"Error in loading data: {e}")
            return None

    # Processing and Cleaning the Data
    def preprocess_data(self, df):
        # Linear Accelerometer: ax, ay, az (m/s2) - to confirm
        # GPS: latitude, longitude, altitude, speed (m/s) - to confirm
        # Gyroscope: wx, wy, wz (rad/s)

        # Checking if required columns are missing
        required_cols = ['time', 'ax', 'ay', 'az' ]
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:  # if there's anything here then it's automatically True
            print(f"Error: Missing required columns: {missing_cols}")
            return None

        # Creating a standardized dataframe
        processed_df = pd.DataFrame()

        # Handle Time - Convert Iso timestamp format to Unix timestamp format
        if 'time' in df.columns:
            processed_df['time'] = pd.to_datetime(df['time']).astype('int64')/1e9 # Convert to seconds

            # Subtract each row to the first to start from 0
            processed_df['time'] = processed_df['time'] - processed_df['time'].iloc[0]

        else:
            print("Error: No time column found")
            return None

        # Accelerometer, data is already in correct format - to numeric
        processed_df['ax'] = pd.to_numeric(df['ax'], errors='coerce')   # errors = 'coerce' converts uncovertable values to NaN (Not a Number)
        processed_df['ay'] = pd.to_numeric(df['ay'], errors='coerce')
        processed_df['az'] = pd.to_numeric(df['az'], errors='coerce')

        # GPS data - to numeric
        if all(col in df.columns for col in ['latitude', 'longitude', 'speed']):
            processed_df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
            processed_df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')
            processed_df['speed'] = pd.to_numeric(df['speed'], errors='coerce')
            processed_df['altitude'] = pd.to_numeric(df['altitude'], errors='coerce') if 'altitude' in df.columns else None

        # Gyroscope data(wx, wy, wz) - to numeric
        if all(col in df.columns for col in ['wx', 'wy','wz']):
            processed_df['wx'] = pd.to_numeric(df['wx'], errors='coerce')
            processed_df['wy'] = pd.to_numeric(df['wy'], errors='coerce')
            processed_df['wz'] = pd.to_numeric(df['wz'], errors='coerce')

        # Remove rows with NaN in time ax ay and az
        processed_df = processed_df.dropna(subset=['time', 'ax', 'ay', 'az'])

        # Sort by time - though naturally it's already sorted
        processed_df = processed_df.sort_values('time').reset_index(drop=True)

        # Add duration
        duration = processed_df['time'].iloc[-1] - processed_df['time'].iloc[0]

        print(f"Processed Data: {len(processed_df)} valid rows")
        print(f"Time range: {processed_df['time'].iloc[0]:.2f}s to {processed_df['time'].iloc[-1]:.2f}s")
        print(f"Duration: {duration:.2f} seconds")

        return processed_df, duration

    # Handling inconsistent column names
    def _find_columns(self, df, possible_names):

        found_cols = []
        df_cols_lower = [col.lower() for col in df.columns]

        for name in possible_names:
            for i, col in enumerate(df_cols_lower):
                if name.lower() in col:
                    found_cols.append(df.columns[i])
                    break
                    
        return found_cols

    def calculate_speed_from_gps(self, df):
        if 'latitude' not in df.columns or 'longitude' not in df. columns:
            return None

        speeds = []
        for i in range(len(df)):
            
            if i == 0:             # Handling initial position
                speeds.append(0)

            else:
                # Distance Calculation between consecutive GPS Points
                lat1, lon1 = radians(df.iloc[i-1]['latitude']), radians(df.iloc[i-1]['longitude'])
                lat2, lon2 = radians(df.iloc[i]['latitude']), radians(df.iloc[i]['longitude'])

                # Haversine Formula
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                c = 2*atan2(sqrt(a), sqrt(1-a))
                distance = 6371000 * c                 # Earth radius in meters

                # Change in time and Speed Calculation
                dt = df.iloc[i]['time'] - df.iloc[i-1]['time']   # time computation elapsed

                if dt > 0:
                    speed = distance/dt            # distance over time
                    speeds.append(speed)           
                else:
                    speeds.append(speeds[-1] if speeds else 0)  # reuse the initial and last value

        return np.array(speeds)

    # filters accelerometer data to remove noise and keep only the useful vibration signals
    # estimates sampling rate
    def filter_accelerometer_data(self, df, cutoff_freq=10, sampling_rate = None):

        if sampling_rate is None:
            #Estimate sampling rate
            time_diff = np.diff(df['time'])             # gets time difference between consecutive rows
            sampling_rate = 1.0/np.median(time_diff)    # 1 / median interval

            print(f"Estimated sampling rate: {sampling_rate:.2f} Hz")

        # Design low-pass filter
        nyquist = sampling_rate / 2                    # max frequency to capture (half of sample rate)
        if cutoff_freq >= nyquist:                     # lower  cutoff_freq if too high
            cutoff_freq = nyquist * 0.9

        b, a = signal.butter(4, cutoff_freq / nyquist, btype = 'low')     # 4th-order Butterworth low-pass filter, allows road bumps, blocks  high frequency noise like phone shake and vibration where b and a are filter coefficients for filtfilt

        # Apply filter
        df_filtered = df.copy()
        df_filtered['ax_filtered'] = signal.filtfilt(b, a, df['ax'])
        df_filtered['ay_filtered'] = signal.filtfilt(b, a, df['ay'])
        df_filtered['az_filtered'] = signal.filtfilt(b, a, df['az'])

        return df_filtered, sampling_rate

    # Extract the vertical acceleration component
    def extract_vertical_acceleration(self, df):

        # Use Z-axis as this is the vertical movement from the mounting set-up
        vertical_accel_simple = df['az_filtered'].values

        # Use gyroscope to correct phone orientation - optional
        if all(col in df.columns for col in ['wx', 'wy', 'wz']):
            vertical_accel_corrected = self._correct_orientation(df)
        else:
            vertical_accel_corrected = vertical_accel_simple

        return vertical_accel_corrected

    # Correct accelerometer data using gyroscope data
    def _correct_orientation(self, df):
        # Use wx, wy, wz
        ax, ay , az = df['ax_filtered'].values, df['ay_filtered'].values, df['az_filtered'].values
        wx, wy, wz = df['wx'].values, df['wy'].values, df['wz'].values

        # Simple correction assuming small rotations from visual observations
        dt = np.median(np.diff(df['time']))
        angles_x = cumulative_trapezoid(wx, dx=dt, initial = 0)
        angles_y = cumulative_trapezoid(wy, dx=dt, initial = 0)

        # Rotation acceleration vector 
        vertical_accel = az * np.cos(angles_x) * np.cos(angles_y) + \
                        ay * np.sin(angles_x) - \
                        ax * np.sin(angles_y)

        return vertical_accel

    # Finally, calculation of IRI by RMS method
    # Possible points of improvement: Have a user input how many meters is in a segment
    def calculate_iri_rms_method(self, df, segment_length=100):     # create IRI values for every 100m

        # Filtered data
        df_filtered, sampling_rate = self.filter_accelerometer_data(df)

        # Extract vertical acceleration
        vertical_accel = self.extract_vertical_acceleration(df_filtered)

        # Calculate Speed
        if 'speed' in df_filtered.columns:
            speed = df_filtered['speed'].values
        else:
            speed = self.calculate_speed_from_gps(df_filtered)
            if speed is None:
                # Assume constant speed if no GPS data
                speed = np.full(len(df_filtered), 15.0) # 15 m/s default
                print("Warning: Using default speed of 15 m/s")

        # Remove gravity component and calculate RMS
        vertical_accel_corrected = vertical_accel - np.mean(vertical_accel)

        # Calculate distance traveled
        time_array = df_filtered['time'].values
        distance = cumulative_trapezoid(speed, time_array, initial = 0)

        # Segmentation of data
        segments = self._create_segments(distance, vertical_accel_corrected, speed, segment_length)

        # Calculation of IRI for each segment
        iri_values = []
        for segment in segments:
            iri, speed = self._calculate_segment_iri(segment)
            iri_values.append(iri)

        return iri_values, segments, sampling_rate, speed

    #Create Segments of specified length - SPEED-AWARE VERSION
    def _create_segments(self, distance, vertical_accel, speed, segment_length):
        segments = []
        max_distance = distance[-1]

        for start_dist in np.arange(0, max_distance - segment_length, segment_length):
            end_dist = start_dist + segment_length

            # Find indices for this segment
            start_idx = np.argmin(np.abs(distance - start_dist))
            end_idx = np.argmin(np.abs(distance - end_dist))

            if end_idx > start_idx:
                segment_accel = vertical_accel[start_idx:end_idx]
                segment_speed = speed[start_idx:end_idx]
                
                mean_speed = float(np.mean(segment_speed))
                
                # Determine speed flag for this segment
                if mean_speed >= self.MIN_VALID_SPEED:
                    speed_flag = 'normal'
                elif mean_speed > 0:
                    speed_flag = 'low_speed'
                else:
                    speed_flag = 'stopped'
                
                segment = {
                    'distance_start': start_dist,
                    'distance_end': end_dist,
                    'vertical_accel': segment_accel,
                    'speed': segment_speed,
                    'length': segment_length,
                    'center_index': start_idx + (end_idx - start_idx) // 2,
                    'speed_flag': speed_flag
                }
                segments.append(segment)

        return segments
    

    # Computation of IRI per segment(100 meters) - SPEED-AWARE VERSION
    def _calculate_segment_iri(self, segment):
        vertical_accel = segment['vertical_accel']
        mean_speed = np.mean(segment['speed'])

        # Calculate RMS acceleration
        rms_accel = np.sqrt(np.mean(vertical_accel**2))

        # SPEED-AWARE IRI CALCULATION
        # Uses damped speed exponent to reduce sensitivity at varying speeds
        if mean_speed >= self.MIN_VALID_SPEED:
            # Normal calculation with damped speed exponent
            iri = self.K * rms_accel / (mean_speed ** self.SPEED_EXPONENT)
            speed_flag = 'normal'
        elif mean_speed > 0:
            # Low-speed: extrapolate to reference speed and cap
            extrapolated_iri = self.K * rms_accel / (self.REFERENCE_SPEED ** self.SPEED_EXPONENT)
            iri = min(extrapolated_iri, self.MAX_IRI_CAP)
            speed_flag = 'low_speed'
        else:
            iri = 0
            speed_flag = 'stopped'

        return iri, mean_speed, speed_flag

    # Plotting the Results
    def plot_results(self, df, iri_values, segments):
        
        fig, axes = plt.subplots(3,1, figsize = (12, 10))

        # Plotting raw accelerometer data
        axes[0].plot(df['time'], df['ax'], label='X-axis', alpha = 0.7)
        axes[0].plot(df['time'], df['ay'], label='Y-axis', alpha = 0.7)
        axes[0].plot(df['time'], df['az'], label='Z-axis', alpha = 0.7)
        axes[0].set_ylabel('Acceleration (m/s^2)')
        axes[0].set_title('Raw Accelerometer Data')
        axes[0].legend()
        axes[0].grid(True)

        # Plot filtered vertical acceleration
        df_filtered, _ = self.filter_accelerometer_data(df)
        vertical_accel = self.extract_vertical_acceleration(df_filtered)
        axes[1].plot(df_filtered['time'], vertical_accel)
        axes[1].set_ylabel('Vertical Acceleration (m/s^2)')
        axes[1].set_title('Filtered Vertical Acceleration')
        axes[1].grid(True)

        # Plot IRI values
        segment_centers = [s['distance_start'] + s['length']/2 for s in segments]
        axes[2].plot(segment_centers, iri_values, 'ro-')
        axes[2].set_xlabel('Distance (m)')
        axes[2].set_ylabel('IRI (m/km)')
        axes[2].set_title('International Roughness Index')
        axes[2].grid(True)

        plt.tight_layout()
        plt.show()

    # Plotting Raw Data
    def plot_raw_data(self, df):
        fig, axes = plt.subplots(2,1, figsize = (12,8))

        # Plot raw accelerometer data
        axes[0].plot(df['time'], df['ax'], label='X-axis', alpha=0.7)
        axes[0].plot(df['time'], df['ay'], label='Y-axis', alpha=0.7)
        axes[0].plot(df['time'], df['az'], label='Z-axis', alpha=0.7)
        axes[0].set_ylabel('Acceleration (m/s^2)')
        axes[0].set_title('Raw Accelerometer Data')
        axes[0].legend()
        axes[0].grid(True)

        # Plot speed if available
        if 'speed' in df.columns:
            axes[1].plot(df['time'], df['speed'])
            axes[1].set_ylabel('Speed (m/s)')
            axes[1].set_title('Vehicle Speed')
            axes[1].grid(True)

        axes[1].set_xlabel('Time (seconds)')
        plt.tight_layout()
        plt.show()

        return fig

    # Saving the Results
    def save_results(self, iri_values, segments, filename = 'iri_results.csv'):

        results = []
        for i, (iri, segment) in enumerate(zip(iri_values, segments)):
            results.append({
                'segment_id' : i + 1,
                'distance_start' : segment['distance_start'],
                'distance_end' : segment['distance_end'],
                'segment_length' : segment['length'],
                'iri_value' : iri, 
                'mean_speed' : np.mean(segment['speed']),
                'rms_accel' : np.sqrt(np.mean(segment['vertical_accel']**2))
            })

        results_df = pd.DataFrame(results)
        results_df.to_csv(filename, index = False)
        print(f"Results saved to {filename}")

        return results_df
        
        


            

        
