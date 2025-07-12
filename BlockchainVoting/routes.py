# Applying the changes to the code based on the provided diffs.
from flask import render_template, request, jsonify, redirect, url_for, flash
from app import app, db
from models import Election, Candidate, Vote, Admin
from blockchain_service import BlockchainService
from datetime import datetime
import logging
from sqlalchemy import func

blockchain_service = BlockchainService()

@app.route('/')
def index():
    """Main landing page"""
    active_elections = Election.query.filter_by(is_active=True).filter(
        Election.end_time > datetime.utcnow()
    ).all()
    return render_template('index.html', elections=active_elections)

@app.route('/voting/<int:election_id>')
def voting(election_id):
    """Voting page for a specific election"""
    election = Election.query.get_or_404(election_id)

    # Check if election is still active
    if not election.is_active or election.end_time < datetime.utcnow():
        flash('This election is no longer active.', 'error')
        return redirect(url_for('index'))

    candidates = Candidate.query.filter_by(election_id=election_id).all()
    return render_template('voting.html', election=election, candidates=candidates)

@app.route('/api/cast_vote', methods=['POST'])
def cast_vote():
    """API endpoint to cast a vote"""
    try:
        data = request.get_json()

        voter_address = data.get('voter_address')
        election_id = data.get('election_id')
        candidate_id = data.get('candidate_id')
        transaction_hash = data.get('transaction_hash')

        if not all([voter_address, election_id, candidate_id, transaction_hash]):
            return jsonify({'error': 'Missing required fields'}), 400

        # Check if voter already voted in this election
        existing_vote = Vote.query.filter_by(
            voter_address=voter_address.lower(),
            election_id=election_id
        ).first()

        if existing_vote:
            return jsonify({'error': 'You have already voted in this election'}), 400

        # Verify election is active
        election = Election.query.get(election_id)
        if not election or not election.is_active or election.end_time < datetime.utcnow():
            return jsonify({'error': 'Election is not active'}), 400

        # Verify candidate exists
        candidate = Candidate.query.get(candidate_id)
        if not candidate or candidate.election_id != election_id:
            return jsonify({'error': 'Invalid candidate'}), 400

        # Create vote record
        vote = Vote(
            voter_address=voter_address.lower(),
            election_id=election_id,
            candidate_id=candidate_id,
            transaction_hash=transaction_hash
        )

        # Update candidate vote count
        candidate.vote_count += 1

        db.session.add(vote)
        db.session.commit()

        logging.info(f"Vote cast successfully: {vote.verification_code}")

        return jsonify({
            'success': True,
            'verification_code': vote.verification_code,
            'message': 'Vote cast successfully!'
        })

    except Exception as e:
        logging.error(f"Error casting vote: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to cast vote'}), 500

@app.route('/verification')
def verification():
    """Verification page where voters can check their vote"""
    return render_template('verification.html')

@app.route('/api/verify_vote', methods=['POST'])
def verify_vote():
    """API endpoint to verify a vote using verification code"""
    try:
        data = request.get_json()
        verification_code = data.get('verification_code')

        if not verification_code:
            return jsonify({'error': 'Verification code is required'}), 400

        vote = Vote.query.filter_by(verification_code=verification_code.upper()).first()

        if not vote:
            return jsonify({'error': 'Invalid verification code'}), 404

        candidate = Candidate.query.get(vote.candidate_id)
        election = Election.query.get(vote.election_id)

        return jsonify({
            'success': True,
            'vote_details': {
                'election_title': election.title,
                'candidate_name': candidate.name,
                'candidate_party': candidate.party,
                'vote_time': vote.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC'),
                'transaction_hash': vote.transaction_hash
            }
        })

    except Exception as e:
        logging.error(f"Error verifying vote: {str(e)}")
        return jsonify({'error': 'Failed to verify vote'}), 500

@app.route('/admin')
def admin():
    """Admin dashboard"""
    return render_template('admin.html')

@app.route('/api/admin/verify', methods=['POST'])
def verify_admin():
    """Verify admin wallet address"""
    try:
        data = request.get_json()
        wallet_address = data.get('wallet_address')

        if not wallet_address:
            return jsonify({'error': 'Wallet address is required'}), 400

        # For demo purposes, allow any wallet as admin
        # In production, you would check against a predefined list
        admin = Admin.query.filter_by(wallet_address=wallet_address.lower()).first()
        if not admin:
            # Create admin entry for demo
            admin = Admin(
                wallet_address=wallet_address.lower(),
                name=f"Admin {wallet_address[:8]}..."
            )
            db.session.add(admin)
            db.session.commit()

        return jsonify({'success': True, 'admin_name': admin.name})

    except Exception as e:
        logging.error(f"Error verifying admin: {str(e)}")
        return jsonify({'error': 'Failed to verify admin'}), 500

@app.route('/api/admin/elections')
def get_elections():
    """Get all elections for admin"""
    try:
        elections = Election.query.all()
        elections_data = []

        for election in elections:
            total_votes = Vote.query.filter_by(election_id=election.id).count()
            candidate_count = Candidate.query.filter_by(election_id=election.id).count()
            elections_data.append({
                'id': election.id,
                'title': election.title,
                'description': election.description,
                'start_time': election.start_time.strftime('%Y-%m-%d %H:%M'),
                'end_time': election.end_time.strftime('%Y-%m-%d %H:%M'),
                'is_active': election.is_active,
                'total_votes': total_votes,
                'candidate_count': candidate_count,
                'contract_address': election.contract_address if hasattr(election, 'contract_address') else None  # Handle potential missing attribute
            })

        return jsonify({'elections': elections_data})

    except Exception as e:
        logging.error(f"Error fetching elections: {str(e)}")
        return jsonify({'error': 'Failed to fetch elections'}), 500

@app.route('/api/admin/election/<int:election_id>/results')
def get_election_results(election_id):
    """Get detailed results for a specific election"""
    try:
        election = Election.query.get_or_404(election_id)
        candidates = Candidate.query.filter_by(election_id=election_id).all()

        results = []
        total_votes = 0

        for candidate in candidates:
            vote_count = Vote.query.filter_by(candidate_id=candidate.id).count()
            total_votes += vote_count
            results.append({
                'id': candidate.id,
                'name': candidate.name,
                'party': candidate.party,
                'votes': vote_count
            })

        # Calculate percentages
        for result in results:
            result['percentage'] = (result['votes'] / total_votes * 100) if total_votes > 0 else 0

        return jsonify({
            'election': {
                'id': election.id,
                'title': election.title,
                'total_votes': total_votes
            },
            'results': results
        })

    except Exception as e:
        logging.error(f"Error fetching election results: {str(e)}")
        return jsonify({'error': 'Failed to fetch election results'}), 500

@app.route('/results/<int:election_id>')
def results(election_id):
    """Public results page for an election"""
    election = Election.query.get_or_404(election_id)
    return render_template('results.html', election=election)

@app.route('/voter_area')
def voter_area():
    """Voter area page where users can see all elections and candidates"""
    return render_template('voter_area.html')

@app.route('/api/elections')
def get_all_elections():
    """Get all active elections for voters"""
    try:
        elections = Election.query.filter_by(is_active=True).filter(
            Election.end_time > datetime.utcnow()
        ).all()
        
        elections_data = []
        for election in elections:
            total_votes = Vote.query.filter_by(election_id=election.id).count()
            candidate_count = Candidate.query.filter_by(election_id=election.id).count()
            
            elections_data.append({
                'id': election.id,
                'title': election.title,
                'description': election.description,
                'start_time': election.start_time.isoformat(),
                'end_time': election.end_time.isoformat(),
                'is_active': election.is_active,
                'total_votes': total_votes,
                'candidate_count': candidate_count
            })

        return jsonify({'elections': elections_data})

    except Exception as e:
        logging.error(f"Error fetching elections: {str(e)}")
        return jsonify({'error': 'Failed to fetch elections'}), 500

@app.route('/api/elections/<int:election_id>/candidates')
def get_election_candidates_public(election_id):
    """Get all candidates for a specific election (public endpoint)"""
    try:
        election = Election.query.get_or_404(election_id)
        
        # Check if election is active
        if not election.is_active or election.end_time < datetime.utcnow():
            return jsonify({'error': 'Election is not active'}), 400
            
        candidates = Candidate.query.filter_by(election_id=election_id).all()
        candidates_data = []

        for candidate in candidates:
            candidates_data.append({
                'id': candidate.id,
                'name': candidate.name,
                'party': candidate.party,
                'description': candidate.description,
                'age': candidate.age,
                'location': candidate.location,
                'topic': candidate.topic,
                'logo_url': candidate.logo_url,
                'education': candidate.education,
                'experience': candidate.experience,
                'manifesto': candidate.manifesto
            })

        return jsonify({'candidates': candidates_data})

    except Exception as e:
        logging.error(f"Error fetching candidates: {str(e)}")
        return jsonify({'error': 'Failed to fetch candidates'}), 500

# Admin routes for election and candidate management
@app.route('/api/admin/create_election', methods=['POST'])
def create_election():
    """Create a new election"""
    try:
        data = request.get_json()

        election = Election(
            title=data.get('title'),
            description=data.get('description'),
            start_time=datetime.fromisoformat(data.get('start_time')),
            end_time=datetime.fromisoformat(data.get('end_time')),
            is_active=data.get('is_active', True)
        )

        db.session.add(election)
        db.session.commit()

        return jsonify({
            'success': True,
            'election_id': election.id,
            'message': 'Election created successfully'
        })

    except Exception as e:
        logging.error(f"Error creating election: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to create election'}), 500

@app.route('/api/admin/add_candidate', methods=['POST'])
def add_candidate():
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ['name', 'party', 'description', 'location', 'topic', 'election_id']
        for field in required_fields:
            if not data.get(field) or str(data.get(field)).strip() == '':
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Check if election exists
        election = Election.query.get(data['election_id'])
        if not election:
            return jsonify({'error': 'Election not found'}), 404

        # Create new candidate
        candidate = Candidate(
            name=data['name'].strip(),
            party=data['party'].strip(),
            description=data['description'].strip(),
            age=data.get('age'),
            location=data['location'].strip(),
            topic=data['topic'],
            logo_url=data.get('logo_url', '').strip() if data.get('logo_url') else None,
            education=data.get('education', '').strip() if data.get('education') else None,
            experience=data.get('experience', '').strip() if data.get('experience') else None,
            manifesto=data.get('manifesto', '').strip() if data.get('manifesto') else None,
            election_id=data['election_id']
        )

        db.session.add(candidate)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Candidate added successfully'})

    except Exception as e:
        db.session.rollback()
        print(f"Error adding candidate: {str(e)}")
        return jsonify({'error': f'Failed to add candidate: {str(e)}'}), 500

@app.route('/api/admin/update_candidate/<int:candidate_id>', methods=['PUT'])
def update_candidate(candidate_id):
    """Update candidate information"""
    try:
        candidate = Candidate.query.get_or_404(candidate_id)
        data = request.get_json()

        candidate.name = data.get('name', candidate.name)
        candidate.party = data.get('party', candidate.party)
        candidate.description = data.get('description', candidate.description)
        candidate.age = data.get('age', candidate.age)
        candidate.location = data.get('location', candidate.location)
        candidate.topic = data.get('topic', candidate.topic)
        candidate.logo_url = data.get('logo_url', candidate.logo_url)
        candidate.education = data.get('education', candidate.education)
        candidate.experience = data.get('experience', candidate.experience)
        candidate.manifesto = data.get('manifesto', candidate.manifesto)

        db.session.commit()

        return jsonify({'success': True, 'message': 'Candidate updated successfully'})

    except Exception as e:
        logging.error(f"Error updating candidate: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to update candidate'}), 500

@app.route('/api/admin/delete_candidate/<int:candidate_id>', methods=['DELETE'])
def delete_candidate(candidate_id):
    """Delete a candidate"""
    try:
        candidate = Candidate.query.get_or_404(candidate_id)
        db.session.delete(candidate)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Candidate deleted successfully'})

    except Exception as e:
        logging.error(f"Error deleting candidate: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to delete candidate'}), 500

@app.route('/api/admin/election/<int:election_id>/candidates')
def get_election_candidates(election_id):
    """Get all candidates for a specific election"""
    try:
        candidates = Candidate.query.filter_by(election_id=election_id).all()
        candidates_data = []

        for candidate in candidates:
            vote_count = Vote.query.filter_by(candidate_id=candidate.id).count()
            candidates_data.append({
                'id': candidate.id,
                'name': candidate.name,
                'party': candidate.party,
                'description': candidate.description,
                'age': candidate.age,
                'location': candidate.location,
                'topic': candidate.topic,
                'logo_url': candidate.logo_url,
                'education': candidate.education,
                'experience': candidate.experience,
                'manifesto': candidate.manifesto,
                'vote_count': vote_count,
                'created_at': candidate.created_at.strftime('%Y-%m-%d %H:%M') if candidate.created_at else None
            })

        return jsonify({'candidates': candidates_data})

    except Exception as e:
        logging.error(f"Error fetching candidates: {str(e)}")
        return jsonify({'error': 'Failed to fetch candidates'}), 500

@app.route('/api/admin/candidate/<int:candidate_id>')
def get_candidate(candidate_id):
    """Get a specific candidate's details"""
    try:
        candidate = Candidate.query.get_or_404(candidate_id)

        return jsonify({
            'id': candidate.id,
            'name': candidate.name,
            'party': candidate.party,
            'description': candidate.description,
            'age': candidate.age,
            'location': candidate.location,
            'topic': candidate.topic,
            'logo_url': candidate.logo_url,
            'education': candidate.education,
            'experience': candidate.experience,
            'manifesto': candidate.manifesto,
            'election_id': candidate.election_id
        })

    except Exception as e:
        logging.error(f"Error fetching candidate: {str(e)}")
        return jsonify({'error': 'Failed to fetch candidate'}), 500

# Initialize sample data for demo
@app.route('/api/init_demo_data', methods=['POST'])
def init_demo_data():
    """Initialize demo election data"""
    try:
        # Check if demo data already exists
        if Election.query.first():
            return jsonify({'message': 'Demo data already exists'})

        # Create sample election
        election = Election(
            title="Student Council Election 2024",
            description="Annual student council election for academic year 2024-2025",
            start_time=datetime.utcnow(),
            end_time=datetime(2024, 12, 31, 23, 59, 59),
            is_active=True
        )
        db.session.add(election)
        db.session.flush()  # Get the election ID

        # Create sample candidates with detailed information
        candidates = [
            Candidate(
                name="Alice Johnson",
                party="Progressive Students Alliance",
                description="Experienced leader focused on student welfare and academic excellence",
                age=22,
                location="California, USA",
                topic="Education",
                logo_url="https://images.unsplash.com/photo-1494790108755-2616b612b1c5?w=200&h=200&fit=crop&crop=face",
                education="Computer Science Major, 3.8 GPA",
                experience="Former Class Representative, Debate Team Captain",
                manifesto="I pledge to improve campus Wi-Fi, extend library hours, and create more study spaces for students.",
                election_id=election.id
            ),
            Candidate(
                name="Bob Smith",
                party="Student Unity Movement",
                description="Dedicated to improving campus facilities and student activities",
                age=21,
                location="Texas, USA",
                topic="Sports & Recreation",
                logo_url="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face",
                education="Business Administration Major, 3.6 GPA",
                experience="Student Activities Coordinator, Sports Club President",
                manifesto="Focus on enhancing campus recreation facilities and organizing more cultural events.",
                election_id=election.id
            ),
            Candidate(
                name="Carol Davis",
                party="Future Leaders Coalition",
                description="Advocate for technology integration and sustainable campus practices",
                age=23,
                location="New York, USA",
                topic="Environment",
                logo_url="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",
                education="Environmental Science Major, 3.9 GPA",
                experience="Environmental Club Leader, Research Assistant",
                manifesto="Promote sustainability initiatives and green energy solutions on campus.",
                election_id=election.id
            ),
            Candidate(
                name="David Wilson",
                party="Student Voice Party",
                description="Champion of student rights and academic freedom",
                age=24,
                location="Florida, USA",
                topic="Student Welfare",
                logo_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
                education="Political Science Major, 3.7 GPA",
                experience="Student Government Senator, Mock Trial Team",
                manifesto="Strengthen student representation in university decisions and reduce tuition fees.",
                election_id=election.id
            )
        ]

        for candidate in candidates:
            db.session.add(candidate)

        db.session.commit()

        return jsonify({'success': True, 'message': 'Demo data initialized successfully'})

    except Exception as e:
        logging.error(f"Error initializing demo data: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to initialize demo data'}), 500

def setup_demo_data():
    """Internal function to set up demo data"""
    try:
        # Check if demo data already exists
        if Election.query.first():
            return

        # Create sample election
        election = Election(
            title="Student Council Election 2024",
            description="Annual student council election for academic year 2024-2025",
            start_time=datetime.utcnow(),
            end_time=datetime(2024, 12, 31, 23, 59, 59),
            is_active=True
        )
        db.session.add(election)
        db.session.flush()  # Get the election ID

        # Create sample candidates with detailed information
        candidates = [
            Candidate(
                name="Alice Johnson",
                party="Progressive Students Alliance",
                description="Experienced leader focused on student welfare and academic excellence",
                age=22,
                location="California, USA",
                topic="Education",
                logo_url="https://images.unsplash.com/photo-1494790108755-2616b612b1c5?w=200&h=200&fit=crop&crop=face",
                education="Computer Science Major, 3.8 GPA",
                experience="Former Class Representative, Debate Team Captain",
                manifesto="I pledge to improve campus Wi-Fi, extend library hours, and create more study spaces for students.",
                election_id=election.id
            ),
            Candidate(
                name="Bob Smith",
                party="Student Unity Movement",
                description="Dedicated to improving campus facilities and student activities",
                age=21,
                location="Texas, USA",
                topic="Sports & Recreation",
                logo_url="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face",
                education="Business Administration Major, 3.6 GPA",
                experience="Student Activities Coordinator, Sports Club President",
                manifesto="Focus on enhancing campus recreation facilities and organizing more cultural events.",
                election_id=election.id
            )
        ]

        for candidate in candidates:
            db.session.add(candidate)

        db.session.commit()
        logging.info("Demo data initialized successfully")

    except Exception as e:
        logging.error(f"Error setting up demo data: {str(e)}")
        db.session.rollback()