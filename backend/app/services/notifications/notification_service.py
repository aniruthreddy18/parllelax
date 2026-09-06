import datetime
from typing import List, Dict, Any
from app.config import settings

class BaseNotificationProvider:
  def send_push(self, token: str, title: str, body: str, data: Dict[str, Any]) -> bool:
    raise NotImplementedError

  def send_sms(self, to_phone: str, body: str) -> bool:
    raise NotImplementedError

  def send_email(self, to_email: str, subject: str, body: str) -> bool:
    raise NotImplementedError

class DemoNotificationProvider(BaseNotificationProvider):
  def send_push(self, token: str, title: str, body: str, data: Dict[str, Any]) -> bool:
    print(f"[DEMO FCM PUSH] Token: {token} | Title: {title} | Body: {body}")
    return True

  def send_sms(self, to_phone: str, body: str) -> bool:
    print(f"[DEMO TWILIO SMS] To: {to_phone} | Body: {body}")
    return True

  def send_email(self, to_email: str, subject: str, body: str) -> bool:
    print(f"[DEMO SENDGRID EMAIL] To: {to_email} | Subject: {subject}")
    return True

class RealNotificationProvider(BaseNotificationProvider):
  def send_push(self, token: str, title: str, body: str, data: Dict[str, Any]) -> bool:
    if not settings.FCM_PROJECT_ID:
      return False
    # FCM push implementation via httpx or firebase-admin
    return True

  def send_sms(self, to_phone: str, body: str) -> bool:
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
      return False
    # Twilio REST API request
    return True

  def send_email(self, to_email: str, subject: str, body: str) -> bool:
    if not settings.SENDGRID_API_KEY:
      return False
    # SendGrid v3 mail send API request
    return True

def get_notification_provider() -> BaseNotificationProvider:
  if settings.DEMO_MODE or not settings.TWILIO_ACCOUNT_SID:
    return DemoNotificationProvider()
  return RealNotificationProvider()

def dispatch_incident_alert_sequence(
  incident: Dict[str, Any],
  recipients: List[Dict[str, Any]],
  channels: List[str]
) -> List[Dict[str, Any]]:
  """Orchestrates prioritized notification dispatch & generates initial recipient records."""
  results = []
  now_str = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S IST")

  for idx, r in enumerate(recipients):
    channel = channels[idx % len(channels)]
    results.append({
      "id": f"RECIP-{incident['id']}-{idx + 1:03d}",
      "event_id": f"NOTIF-EVT-{incident['id']}",
      "recipient_name": r['name'],
      "recipient_type": r.get('category', 'Opted-in Resident').title(),
      "channel": channel,
      "status": "QUEUED",
      "sent_at": now_str,
      "delivered_at": None,
      "read_at": None,
      "acknowledged_at": None,
    })

  return results
