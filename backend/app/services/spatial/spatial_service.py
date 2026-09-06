import math
from typing import List, Dict, Any

def calculate_haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
  """Calculate distance in meters between two lat/lng points using Haversine formula."""
  R = 6371000.0 # Earth radius in meters
  phi1 = math.radians(lat1)
  phi2 = math.radians(lat2)
  delta_phi = math.radians(lat2 - lat1)
  delta_lambda = math.radians(lng2 - lng1)

  a = (math.sin(delta_phi / 2) ** 2 +
       math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
  c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
  return R * c

def find_affected_users_in_radius(
  users_data: List[Dict[str, Any]],
  incident_lat: float,
  incident_lng: float,
  radius_meters: float
) -> List[Dict[str, Any]]:
  affected = []
  for u in users_data:
    dist = calculate_haversine_distance(incident_lat, incident_lng, u['lat'], u['lng'])
    if dist <= radius_meters and u.get('notification_opt_in', True):
      affected.append({
        'id': u['id'],
        'name': u['name'],
        'phone': u.get('phone'),
        'email': u.get('email'),
        'distance_meters': round(dist, 1),
        'opt_in': True,
      })
  return sorted(affected, key=lambda x: x['distance_meters'])

def find_emergency_contacts_in_radius(
  contacts_data: List[Dict[str, Any]],
  incident_lat: float,
  incident_lng: float,
  radius_meters: float
) -> List[Dict[str, Any]]:
  contacts = []
  for c in contacts_data:
    dist = calculate_haversine_distance(incident_lat, incident_lng, c['lat'], c['lng'])
    # Include emergency contacts up to 5x radius or 15km
    if dist <= max(radius_meters * 3, 15000):
      contacts.append({
        'id': c['id'],
        'name': c['name'],
        'organization': c['organization'],
        'category': c['category'],
        'phone': c['phone'],
        'email': c['email'],
        'distance_meters': round(dist, 1),
      })
  return sorted(contacts, key=lambda x: x['distance_meters'])
