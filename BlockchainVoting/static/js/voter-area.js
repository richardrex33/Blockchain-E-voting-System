/**
 * Voter Area JavaScript
 * Handles election listing, candidate display, and voting process
 */

class VoterArea {
    constructor() {
        this.elections = [];
        this.selectedElection = null;
        this.candidates = [];
        this.selectedCandidate = null;
        this.isVoting = false;

        this.init();
    }

    init() {
        this.bindEventListeners();
        this.loadElections();
        this.checkWalletConnection();

        // Auto-refresh elections every 30 seconds
        setInterval(() => {
            this.loadElections();
        }, 30000);
    }

    bindEventListeners() {
        // Wallet connection buttons
        const connectBtn = document.getElementById('connect-wallet-btn');
        const disconnectBtn = document.getElementById('disconnect-wallet-btn');

        if (connectBtn) {
            connectBtn.addEventListener('click', async () => {
                if (typeof window.ethereum === 'undefined') {
                    showAlert('Please install MetaMask browser extension first!', 'danger');
                    return;
                }

                connectBtn.disabled = true;
                connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Connecting...';

                try {
                    await window.web3Integration?.connectWallet();
                } finally {
                    connectBtn.disabled = false;
                    connectBtn.innerHTML = '<i class="fas fa-wallet me-2"></i>Connect MetaMask';
                }
            });
        }

        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', async () => {
                await window.web3Integration?.disconnectWallet();
            });
        }

        // Refresh elections button
        const refreshBtn = document.getElementById('refresh-elections-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadElections());
        }

        // Proceed to vote button
        const proceedBtn = document.getElementById('proceed-to-vote-btn');
        if (proceedBtn) {
            proceedBtn.addEventListener('click', () => this.showCandidates());
        }

        // Cast vote button
        const castVoteBtn = document.getElementById('cast-vote-btn');
        if (castVoteBtn) {
            castVoteBtn.addEventListener('click', () => this.castVote());
        }

        // Election and candidate selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.election-card')) {
                this.selectElection(e.target.closest('.election-card'));
            }
            if (e.target.closest('.candidate-card')) {
                this.selectCandidate(e.target.closest('.candidate-card'));
            }
        });
    }

    async checkWalletConnection() {
        if (window.web3Integration) {
            await window.web3Integration.checkConnection();
            this.updateProceedButton();
        }
    }

    async connectWallet() {
        if (window.web3Integration) {
            const connected = await window.web3Integration.connectWallet();
            if (connected) {
                this.updateProceedButton();
            }
        }
    }

    async disconnectWallet() {
        if (window.web3Integration) {
            await window.web3Integration.disconnectWallet();
            this.updateProceedButton();
        }
    }

    async loadElections() {
        try {
            const response = await fetch('/api/elections');
            const result = await response.json();

            if (response.ok) {
                this.elections = result.elections || [];
                this.displayElections();
            } else {
                this.showError('Failed to load elections');
            }
        } catch (error) {
            console.error('Error loading elections:', error);
            this.showError('Failed to load elections');
        }
    }

    displayElections() {
        const container = document.getElementById('elections-list');

        if (this.elections.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-3x mb-3"></i>
                    <h5>No Active Elections</h5>
                    <p>There are currently no active elections available for voting.</p>
                    <button class="btn btn-outline-primary" onclick="location.reload()">
                        <i class="fas fa-sync-alt me-1"></i>Refresh Page
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        this.elections.forEach(election => {
            const electionCard = document.createElement('div');
            electionCard.className = 'col-md-6 mb-3';
            electionCard.innerHTML = `
                <div class="election-card card bg-dark border-secondary h-100" data-election-id="${election.id}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="card-title mb-0">${election.title}</h6>
                            <span class="badge ${election.is_active ? 'bg-success' : 'bg-secondary'}">
                                ${election.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <p class="card-text text-muted small">${election.description}</p>
                        <div class="row text-center">
                            <div class="col-6">
                                <small class="text-muted">
                                    <i class="fas fa-users me-1"></i>
                                    ${election.candidate_count} Candidates
                                </small>
                            </div>
                            <div class="col-6">
                                <small class="text-muted">
                                    <i class="fas fa-vote-yea me-1"></i>
                                    ${election.total_votes} Votes
                                </small>
                            </div>
                        </div>
                        <hr class="my-2">
                        <div class="row">
                            <div class="col-12">
                                <small class="text-muted">
                                    <i class="fas fa-calendar me-1"></i>
                                    ${new Date(election.start_time).toLocaleDateString()} - 
                                    ${new Date(election.end_time).toLocaleDateString()}
                                </small>
                            </div>
                        </div>
                        <div class="mt-3">
                            <button class="btn btn-primary btn-sm w-100">
                                <i class="fas fa-arrow-right me-1"></i>Select Election
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(electionCard);
        });
    }

    selectElection(electionCard) {
        // Remove previous selection
        document.querySelectorAll('.election-card').forEach(card => {
            card.classList.remove('border-primary');
        });

        // Add selection to clicked card
        electionCard.classList.add('border-primary');

        const electionId = parseInt(electionCard.dataset.electionId);
        this.selectedElection = this.elections.find(e => e.id === electionId);

        this.showElectionDetails();
        this.updateProceedButton();
    }

    showElectionDetails() {
        if (!this.selectedElection) return;

        const detailsSection = document.getElementById('election-details');
        const titleElement = document.getElementById('selected-election-title');
        const descriptionElement = document.getElementById('selected-election-description');
        const startElement = document.getElementById('selected-election-start');
        const endElement = document.getElementById('selected-election-end');
        const candidatesCountElement = document.getElementById('candidates-count');

        titleElement.innerHTML = `<i class="fas fa-info-circle me-2"></i>${this.selectedElection.title}`;
        descriptionElement.textContent = this.selectedElection.description;
        startElement.textContent = new Date(this.selectedElection.start_time).toLocaleString();
        endElement.textContent = new Date(this.selectedElection.end_time).toLocaleString();
        candidatesCountElement.textContent = this.selectedElection.candidate_count;

        detailsSection.style.display = 'block';
    }

    updateProceedButton() {
        const proceedBtn = document.getElementById('proceed-to-vote-btn');
        const isConnected = window.web3Integration?.isConnected;
        const hasSelectedElection = this.selectedElection !== null;
        const isElectionActive = this.selectedElection?.is_active;

        if (proceedBtn) {
            proceedBtn.disabled = !isConnected || !hasSelectedElection || !isElectionActive;

            if (!isConnected) {
                proceedBtn.innerHTML = '<i class="fas fa-wallet me-1"></i>Connect Wallet First';
            } else if (!hasSelectedElection) {
                proceedBtn.innerHTML = '<i class="fas fa-hand-pointer me-1"></i>Select Election';
            } else if (!isElectionActive) {
                proceedBtn.innerHTML = '<i class="fas fa-ban me-1"></i>Election Inactive';
            } else {
                proceedBtn.innerHTML = '<i class="fas fa-arrow-right me-1"></i>Proceed to Vote';
            }
        }
    }

    async showCandidates() {
        if (!this.selectedElection) return;

        try {
            const response = await fetch(`/api/elections/${this.selectedElection.id}/candidates`);
            const result = await response.json();

            if (response.ok) {
                this.candidates = result.candidates || [];
                this.displayCandidates();

                const candidatesSection = document.getElementById('candidates-section');
                candidatesSection.style.display = 'block';

                // Scroll to candidates section
                candidatesSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                this.showError('Failed to load candidates');
            }
        } catch (error) {
            console.error('Error loading candidates:', error);
            this.showError('Failed to load candidates');
        }
    }

    displayCandidates() {
        const container = document.getElementById('candidates-list');

        if (this.candidates.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="text-center text-muted py-4">
                        <i class="fas fa-user-slash fa-3x mb-3"></i>
                        <h5>No Candidates</h5>
                        <p>No candidates have been added to this election yet.</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        this.candidates.forEach(candidate => {
            const candidateCard = document.createElement('div');
            candidateCard.className = 'col-lg-4 col-md-6 mb-4';
            candidateCard.innerHTML = `
                <div class="candidate-card card bg-dark border-secondary h-100" data-candidate-id="${candidate.id}">
                    <div class="card-body text-center">
                        <div class="mb-3">
                            ${candidate.logo_url ? 
                                `<img src="${candidate.logo_url}" class="rounded-circle" width="80" height="80" alt="${candidate.name}" style="object-fit: cover;">` :
                                `<div class="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style="width: 80px; height: 80px; font-size: 2rem;">${candidate.name[0]}</div>`
                            }
                        </div>
                        <h6 class="card-title">${candidate.name}</h6>
                        <p class="text-primary fw-bold mb-2">${candidate.party}</p>
                        <p class="card-text small text-muted mb-3">${candidate.description}</p>

                        ${candidate.age || candidate.location ? `
                        <div class="mb-2">
                            ${candidate.age ? `<span class="badge bg-secondary me-1">${candidate.age} years</span>` : ''}
                            ${candidate.location ? `<span class="badge bg-secondary"><i class="fas fa-map-marker-alt me-1"></i>${candidate.location}</span>` : ''}
                        </div>
                        ` : ''}

                        ${candidate.topic ? `
                        <div class="mb-3">
                            <span class="badge bg-info">${candidate.topic}</span>
                        </div>
                        ` : ''}

                        <button class="btn btn-outline-primary btn-sm w-100">
                            <i class="fas fa-check me-1"></i>Select ${candidate.name.split(' ')[0]}
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(candidateCard);
        });

        // Show vote submission section
        document.getElementById('vote-submission').style.display = 'block';
    }

    selectCandidate(candidateCard) {
        // Remove previous selection
        document.querySelectorAll('.candidate-card').forEach(card => {
            card.classList.remove('border-primary');
        });

        // Add selection to clicked card
        candidateCard.classList.add('border-primary');

        const candidateId = parseInt(candidateCard.dataset.candidateId);
        this.selectedCandidate = this.candidates.find(c => c.id === candidateId);

        // Update selected candidate display
        const selectedNameElement = document.getElementById('selected-candidate-name');
        if (selectedNameElement && this.selectedCandidate) {
            selectedNameElement.textContent = this.selectedCandidate.name;
        }

        // Enable cast vote button
        const castVoteBtn = document.getElementById('cast-vote-btn');
        if (castVoteBtn) {
            castVoteBtn.disabled = false;
        }

        this.showInfo(`Selected: ${this.selectedCandidate.name}`);
    }

    async castVote() {
        if (!this.selectedCandidate || !this.selectedElection) {
            this.showError('Please select a candidate first.');
            return;
        }

        if (!window.web3Integration?.isConnected) {
            this.showError('Please connect your wallet first.');
            return;
        }

        if (this.isVoting) {
            return;
        }

        this.isVoting = true;
        this.updateVotingButton(true);

        try {
            // Cast vote on blockchain
            const txHash = await window.web3Integration.castVote(this.selectedCandidate.id);

            if (!txHash) {
                throw new Error('Failed to cast vote on blockchain');
            }

            // Submit vote to backend
            const response = await fetch('/api/cast_vote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    voter_address: window.web3Integration.account,
                    election_id: this.selectedElection.id,
                    candidate_id: this.selectedCandidate.id,
                    transaction_hash: txHash
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showVoteSuccess(result.verification_code);
            } else {
                throw new Error(result.error || 'Failed to submit vote');
            }

        } catch (error) {
            console.error('Voting error:', error);
            this.showError(error.message || 'Failed to cast vote. Please try again.');
        } finally {
            this.isVoting = false;
            this.updateVotingButton(false);
        }
    }

    updateVotingButton(isLoading) {
        const castVoteBtn = document.getElementById('cast-vote-btn');
        if (castVoteBtn) {
            if (isLoading) {
                castVoteBtn.disabled = true;
                castVoteBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Casting Vote...';
            } else {
                castVoteBtn.disabled = !this.selectedCandidate;
                castVoteBtn.innerHTML = '<i class="fas fa-vote-yea me-2"></i>Cast Vote on Blockchain';
            }
        }
    }

    showVoteSuccess(verificationCode) {
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
            mainContainer.innerHTML = `
                <div class="row justify-content-center">
                    <div class="col-lg-8">
                        <div class="text-center text-white mb-4">
                            <h1 class="display-4 fw-bold fade-in">
                                🎉 Vote Cast Successfully!
                            </h1>
                        </div>

                        <div class="card voting-card">
                            <div class="card-body text-center">
                                <h3 class="text-success mb-4">
                                    <i class="fas fa-check-circle me-2"></i>
                                    Your Vote Has Been Recorded
                                </h3>

                                <div class="verification-code mb-4">
                                    <p class="mb-2">Your verification code is:</p>
                                    <div class="code bg-secondary p-3 rounded">
                                        <strong>${verificationCode}</strong>
                                    </div>
                                </div>

                                <div class="alert alert-success">
                                    <i class="fas fa-info-circle me-2"></i>
                                    Save this verification code to verify your vote later.
                                </div>

                                <div class="row">
                                    <div class="col-md-6 mb-2">
                                        <a href="/verification" class="btn btn-outline-light w-100">
                                            <i class="fas fa-search me-1"></i>Verify Your Vote
                                        </a>
                                    </div>
                                    <div class="col-md-6 mb-2">
                                        <a href="/" class="btn btn-primary w-100">
                                            <i class="fas fa-home me-1"></i>Back to Home
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    // Utility methods for showing alerts
    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showInfo(message) {
        this.showAlert(message, 'info');
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; max-width: 500px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(alertDiv);

        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Initialize voter area when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.voterArea = new VoterArea();
});