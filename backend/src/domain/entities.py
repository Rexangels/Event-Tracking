from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List
from enum import Enum

class EventSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class EventStatus(Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    RESOLVED = "resolved"

@dataclass
class Location:
    latitude: float
    longitude: float
    accuracy: float = 0.0  # in meters
    altitude: Optional[float] = None

@dataclass
class MediaAttachment:
    id: Optional[str] = None
    file_url: str = ""
    file_type: str = "image"  # image, video, audio
    file_hash: str = ""
    metadata: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class EventReport:
    id: Optional[str] = None
    title: str = ""
    description: str = ""
    category: str = "general"
    severity: EventSeverity = EventSeverity.LOW
    status: EventStatus = EventStatus.PENDING
    location: Optional[Location] = None
    media_attachments: List[MediaAttachment] = field(default_factory=list)
    trust_score: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
