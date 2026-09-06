import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    notification_opt_in = Column(Boolean, default=True)
    push_token = Column(String, nullable=True)
    status = Column(String, default="ACTIVE")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False) # Wildfire, Industrial Fire, Unknown Thermal Event, Agricultural Fire
    status = Column(String, default="ACTIVE") # ACTIVE, CONTAINED, RESOLVED
    severity = Column(String, default="HIGH") # CRITICAL, HIGH, MEDIUM, LOW
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    frp_mw = Column(Float, default=50.0)
    brightness_k = Column(Float, default=320.0)
    confidence = Column(Integer, default=90)
    source = Column(String, default="MANUAL_BETA_EVENT") # MANUAL_BETA_EVENT, SATELLITE_VIIRS
    custom_radius_meters = Column(Float, default=1000.0)
    location_name = Column(String, nullable=False)
    suggested_action = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Facility(Base):
    __tablename__ = "facilities"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    location = Column(String, nullable=False)
    status = Column(String, default="NORMAL")
    baseline_frp = Column(Float, default=15.0)
    current_frp = Column(Float, default=15.0)
    risk_buffer_radius_km = Column(Float, default=2.0)
    emergency_contact = Column(String, nullable=False)

class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    organization = Column(String, nullable=False)
    category = Column(String, nullable=False) # police, fire, ambulance, facility
    phone = Column(String, nullable=False)
    email = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)

class NotificationEvent(Base):
    __tablename__ = "notification_events"

    id = Column(String, primary_key=True)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=False)
    channels = Column(String, nullable=False) # FCM, SMS, EMAIL
    status = Column(String, default="AUTHORIZED")
    authorized_at = Column(DateTime, default=datetime.datetime.utcnow)

class NotificationRecipient(Base):
    __tablename__ = "notification_recipients"

    id = Column(String, primary_key=True)
    event_id = Column(String, ForeignKey("notification_events.id"), nullable=False)
    recipient_name = Column(String, nullable=False)
    recipient_type = Column(String, nullable=False) # Emergency Contact, Facility Operator, Opted-in User
    channel = Column(String, nullable=False) # FCM, SMS, EMAIL
    status = Column(String, default="QUEUED") # QUEUED, SENT, DELIVERED, READ, ACKNOWLEDGED, FAILED
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
