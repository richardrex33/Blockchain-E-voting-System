from app import db
from datetime import datetime
import secrets
import string

class Election(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    start_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    contract_address = db.Column(db.String(42))  # Ethereum address
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    candidates = db.relationship('Candidate', backref='election', lazy=True, cascade='all, delete-orphan')
    votes = db.relationship('Vote', backref='election', lazy=True, cascade='all, delete-orphan')

class Candidate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    party = db.Column(db.String(100))
    description = db.Column(db.Text)
    age = db.Column(db.Integer)
    location = db.Column(db.String(200))
    topic = db.Column(db.String(100))
    logo_url = db.Column(db.String(500))
    education = db.Column(db.Text)
    experience = db.Column(db.Text)
    manifesto = db.Column(db.Text)
    election_id = db.Column(db.Integer, db.ForeignKey('election.id'), nullable=False)
    vote_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    votes = db.relationship('Vote', backref='candidate', lazy=True)

class Vote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    voter_address = db.Column(db.String(42), nullable=False)  # Ethereum wallet address
    election_id = db.Column(db.Integer, db.ForeignKey('election.id'), nullable=False)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidate.id'), nullable=False)
    verification_code = db.Column(db.String(10), unique=True, nullable=False)
    transaction_hash = db.Column(db.String(66))  # Ethereum transaction hash
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __init__(self, **kwargs):
        super(Vote, self).__init__(**kwargs)
        if not self.verification_code:
            self.verification_code = self.generate_verification_code()
    
    @staticmethod
    def generate_verification_code():
        """Generate a unique 8-character alphanumeric verification code"""
        while True:
            code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
            if not Vote.query.filter_by(verification_code=code).first():
                return code

class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    wallet_address = db.Column(db.String(42), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
