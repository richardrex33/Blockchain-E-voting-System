/**
 * Voting System Frontend Logic
 * Handles voting interface, candidate selection, and vote submission
 */

class VotingSystem {
    constructor() {
        this.selectedCandidate = null;
        this.isVoting = false;
        this.electionId = null;
        this.candidates = [];
        
        this.init();
    }

    init() {
        this.bindEventListeners();
        this.loadElectionData();
        this.checkWalletConnection();
    }

    bindEventListeners() {
        // Connect wallet button
        const connectBtn = document.getElementById('connect-wallet-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectWallet());
        }

        // Disconnect wallet button
        const disconnectBtn = document.getElementById('disconnect-wallet-btn');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => this.disconnectWallet());
        }

        // Vote submission button
        const voteBtn = document.getElementById('submit-vote-btn');
        if (voteBtn) {
            voteBtn.addEventListener('click', () => this.submitVote());
        }

        // Candidate selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.candidate-card')) {
                this.selectCandidate(e.target.closest('.candidate-card'));
            }
        });

        // Initialize demo data button
        const initDemoBtn = document.getElementById('init-demo-btn');
        if (initDemoBtn) {
            initDemoBtn.addEventListener('click', () => this.initDemoData());
        }
    }

    async loadElectionData() {
        // Extract election ID from URL or page data
        const urlParts = window.location.pathname.split('/');
        if (urlParts.includes('voting')) {
            this.electionId = urlParts[urlParts.indexOf('voting') + 1];
        }

        // Load candidates from page data
        const candidateCards = document.querySelectorAll('.candidate-card');
        this.candidates = Array.from(candidateCards).map(card => ({
            id: card.dataset.candidateId,
            name: card.querySelector('.candidate-name').textContent,
            party: card.querySelector('.candidate-party').textContent
        }));
    }

    async checkWalletConnection() {
        if (window.web3Integration) {
            await window.web3Integration.checkConnection();
        }
    }

    async connectWallet() {
        if (window.web3Integration) {
            const connected = await window.web3Integration.connectWallet();
            if (connected) {
                this.updateVotingInterface();
            }
        }
    }

    async disconnectWallet() {
        if (window.web3Integration) {
            await window.web3Integration.disconnectWallet();
            this.updateVotingInterface();
        }
    }

    selectCandidate(candidateCard) {
        // Remove previous selection
        document.querySelectorAll('.candidate-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Add selection to clicked card
        candidateCard.classList.add('selected');
        this.selectedCandidate = candidateCard.dataset.candidateId;

        // Enable vote button
        const voteBtn = document.getElementById('submit-vote-btn');
        if (voteBtn) {
            voteBtn.disabled = false;
        }

        this.showInfo(`Selected: ${candidateCard.querySelector('.candidate-name').textContent}`);
    }

    async submitVote() {
        if (!this.selectedCandidate) {
            this.showError('Please select a candidate first.');
            return;
        }

        if (!window.web3Integration?.isConnected) {
            this.showError('Please connect your wallet first.');
            return;
        }

        if (this.isVoting) {
            return; // Prevent double voting
        }

        this.isVoting = true;
        this.updateVotingButton(true);

        try {
            // Cast vote on blockchain
            const txHash = await window.web3Integration.castVote(this.selectedCandidate);
            
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
                    election_id: parseInt(this.electionId),
                    candidate_id: parseInt(this.selectedCandidate),
                    transaction_hash: txHash
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showVoteSuccess(result.verification_code);
                this.disableVoting();
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

    showVoteSuccess(verificationCode) {
        const successHtml = `
            <div class="verification-code fade-in">
                <h3>🎉 Vote Cast Successfully!</h3>
                <p>Your verification code is:</p>
                <div class="code">${verificationCode}</div>
                <p class="mt-3">
                    <small>Save this code to verify your vote later.</small>
                </p>
                <a href="/verification" class="btn btn-outline-light mt-2">
                    Verify Your Vote
                </a>
            </div>
        `;

        const container = document.querySelector('.voting-container') || document.querySelector('.container');
        if (container) {
            container.innerHTML = successHtml;
        }
    }

    disableVoting() {
        // Disable all candidate cards
        document.querySelectorAll('.candidate-card').forEach(card => {
            card.style.pointerEvents = 'none';
            card.style.opacity = '0.6';
        });

        // Disable vote button
        const voteBtn = document.getElementById('submit-vote-btn');
        if (voteBtn) {
            voteBtn.disabled = true;
            voteBtn.textContent = 'Vote Submitted';
        }
    }

    updateVotingButton(isLoading) {
        const voteBtn = document.getElementById('submit-vote-btn');
        if (voteBtn) {
            if (isLoading) {
                voteBtn.disabled = true;
                voteBtn.innerHTML = '<span class="loading-spinner"></span> Casting Vote...';
            } else {
                voteBtn.disabled = !this.selectedCandidate;
                voteBtn.innerHTML = 'Cast Vote';
            }
        }
    }

    updateVotingInterface() {
        const isConnected = window.web3Integration?.isConnected;
        const votingSection = document.getElementById('voting-section');
        
        if (votingSection) {
            if (isConnected) {
                votingSection.style.display = 'block';
            } else {
                votingSection.style.display = 'none';
            }
        }
    }

    async initDemoData() {
        try {
            const response = await fetch('/api/init_demo_data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (response.ok) {
                this.showSuccess('Demo data initialized successfully! Refreshing page...');
                setTimeout(() => {
                    location.reload();
                }, 2000);
            } else {
                this.showError(result.error || 'Failed to initialize demo data');
            }
        } catch (error) {
            console.error('Error initializing demo data:', error);
            this.showError('Failed to initialize demo data');
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
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; max-width: 500px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(alertDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Initialize voting system when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.votingSystem = new VotingSystem();
});

// Verification system for the verification page
class VerificationSystem {
    constructor() {
        this.init();
    }

    init() {
        const verifyBtn = document.getElementById('verify-code-btn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => this.verifyCode());
        }

        const codeInput = document.getElementById('verification-code-input');
        if (codeInput) {
            codeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.verifyCode();
                }
            });
        }
    }

    async verifyCode() {
        const codeInput = document.getElementById('verification-code-input');
        const verificationCode = codeInput?.value?.trim();

        if (!verificationCode) {
            this.showError('Please enter your verification code.');
            return;
        }

        try {
            const response = await fetch('/api/verify_vote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    verification_code: verificationCode
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showVoteDetails(result.vote_details);
            } else {
                this.showError(result.error || 'Invalid verification code');
            }
        } catch (error) {
            console.error('Verification error:', error);
            this.showError('Failed to verify code. Please try again.');
        }
    }

    showVoteDetails(voteDetails) {
        const resultDiv = document.getElementById('verification-result');
        if (resultDiv) {
            resultDiv.innerHTML = `
                <div class="card voting-card fade-in">
                    <div class="card-header">
                        <h4>✅ Vote Verified Successfully</h4>
                    </div>
                    <div class="card-body">
                        <h5>Election: ${voteDetails.election_title}</h5>
                        <p><strong>Candidate:</strong> ${voteDetails.candidate_name}</p>
                        <p><strong>Party:</strong> ${voteDetails.candidate_party}</p>
                        <p><strong>Vote Time:</strong> ${voteDetails.vote_time}</p>
                        <p><strong>Transaction Hash:</strong> 
                            <code class="text-primary">${voteDetails.transaction_hash}</code>
                        </p>
                        <div class="alert alert-success mt-3">
                            Your vote has been successfully recorded on the blockchain and is immutable.
                        </div>
                    </div>
                </div>
            `;
            resultDiv.style.display = 'block';
        }
    }

    showError(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(alertDiv, container.firstChild);
        }

        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Initialize verification system if on verification page
if (window.location.pathname.includes('verification')) {
    document.addEventListener('DOMContentLoaded', function() {
        window.verificationSystem = new VerificationSystem();
    });
}
