/**
 * Admin Dashboard JavaScript
 * Handles admin authentication, election management, and results display
 */

class AdminDashboard {
    constructor() {
        this.isAuthenticated = false;
        this.adminWallet = null;
        this.elections = [];
        this.currentElection = null;

        this.init();
    }

    init() {
        this.bindEventListeners();
        this.checkAuthStatus();
    }

    bindEventListeners() {
        // Admin wallet connection
        const connectAdminBtn = document.getElementById('connect-admin-wallet');
        if (connectAdminBtn) {
            connectAdminBtn.addEventListener('click', () => this.connectAdminWallet());
        }

        // Refresh data button
        const refreshBtn = document.getElementById('refresh-data-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadDashboardData());
        }

        // Election selection
        document.addEventListener('change', (e) => {
            if (e.target.id === 'election-select') {
                this.loadElectionResults(e.target.value);
            }
        });

        // Real-time updates toggle
        const realTimeToggle = document.getElementById('real-time-updates');
        if (realTimeToggle) {
            realTimeToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.startRealTimeUpdates();
                } else {
                    this.stopRealTimeUpdates();
                }
            });
        }

        // Create election form
        const createElectionForm = document.getElementById('create-election-form');
        if (createElectionForm) {
            createElectionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createElection();
            });
        }

        // Candidate election selection
        const candidateElectionSelect = document.getElementById('candidate-election-select');
        if (candidateElectionSelect) {
            candidateElectionSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadCandidatesForElection(e.target.value);
                }
            });
        }

        // Image preview functionality for add candidate
        const candidateLogoInput = document.getElementById('candidate-logo');
        if (candidateLogoInput) {
            candidateLogoInput.addEventListener('input', (e) => {
                this.updateImagePreview(e.target.value, 'candidate-image-preview', 'image-placeholder');
            });
        }

        // Image preview functionality for edit candidate
        const editCandidateLogoInput = document.getElementById('edit-candidate-logo');
        if (editCandidateLogoInput) {
            editCandidateLogoInput.addEventListener('input', (e) => {
                this.updateImagePreview(e.target.value, 'edit-candidate-image-preview', 'edit-image-placeholder');
            });
        }
    }

    async checkAuthStatus() {
        // Only show login section initially, don't auto-connect
        const loginSection = document.getElementById('admin-login');
        const dashboardSection = document.getElementById('admin-dashboard');

        if (loginSection) loginSection.style.display = 'block';
        if (dashboardSection) dashboardSection.style.display = 'none';
    }

    async connectAdminWallet() {
        if (!window.web3Integration) {
            this.showError('Web3 integration not available. Please refresh the page.');
            return;
        }

        const connected = await window.web3Integration.connectWallet();
        if (connected) {
            this.adminWallet = window.web3Integration.account;
            this.authenticateAdmin();
        }
    }

    async authenticateAdmin() {
        try {
            const response = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    wallet_address: this.adminWallet
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.isAuthenticated = true;
                this.showAdminDashboard();
                this.loadDashboardData();
                this.showSuccess(`Welcome, ${result.admin_name}!`);
            } else {
                this.showError(result.error || 'Failed to authenticate as admin');
            }
        } catch (error) {
            console.error('Admin authentication error:', error);
            this.showError('Failed to authenticate. Please try again.');
        }
    }

    showAdminDashboard() {
        const loginSection = document.getElementById('admin-login');
        const dashboardSection = document.getElementById('admin-dashboard');

        if (loginSection) loginSection.style.display = 'none';
        if (dashboardSection) dashboardSection.style.display = 'block';

        // Update admin info
        const adminWalletElement = document.getElementById('admin-wallet');
        if (adminWalletElement) {
            adminWalletElement.textContent = this.formatAddress(this.adminWallet);
        }
    }

    async loadDashboardData() {
        try {
            this.showLoading(true);

            // Load elections
            const response = await fetch('/api/admin/elections');
            const result = await response.json();

            if (response.ok) {
                this.elections = result.elections;
                this.updateElectionsList();
                this.updateStatistics();

                // Load first election results if available
                if (this.elections.length > 0) {
                    this.loadElectionResults(this.elections[0].id);
                }
            } else {
                this.showError('Failed to load dashboard data');
            }
        } catch (error) {
            console.error('Dashboard data loading error:', error);
            this.showError('Failed to load dashboard data');
        } finally {
            this.showLoading(false);
        }
    }

    updateElectionsList() {
        const electionSelect = document.getElementById('election-select');
        const candidateElectionSelect = document.getElementById('candidate-election-select');
        const electionsTable = document.getElementById('elections-table-body');

        // Update main election select
        if (electionSelect) {
            electionSelect.innerHTML = '<option value="">Select an election...</option>';
            this.elections.forEach(election => {
                const option = document.createElement('option');
                option.value = election.id;
                option.textContent = election.title;
                electionSelect.appendChild(option);
            });
        }

        // Update candidate management election select
        if (candidateElectionSelect) {
            candidateElectionSelect.innerHTML = '<option value="">Choose an election...</option>';
            this.elections.forEach(election => {
                const option = document.createElement('option');
                option.value = election.id;
                option.textContent = election.title;
                candidateElectionSelect.appendChild(option);
            });
        }

        if (electionsTable) {
            electionsTable.innerHTML = '';
            this.elections.forEach(election => {
                const candidateCount = election.candidate_count || 0;
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${election.title}</td>
                    <td>${election.total_votes}</td>
                    <td>${candidateCount}</td>
                    <td>
                        <span class="badge ${election.is_active ? 'bg-success' : 'bg-secondary'}">
                            ${election.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>${election.start_time}</td>
                    <td>${election.end_time}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="window.adminDashboard.loadElectionResults(${election.id})">
                            View Results
                        </button>
                        <button class="btn btn-sm btn-outline-primary" onclick="window.adminDashboard.manageCandidates(${election.id})">
                            Manage
                        </button>
                    </td>
                `;
                electionsTable.appendChild(row);
            });
        }
    }

    updateStatistics() {
        const totalElections = this.elections.length;
        const activeElections = this.elections.filter(e => e.is_active).length;
        const totalVotes = this.elections.reduce((sum, e) => sum + e.total_votes, 0);

        this.updateStatCard('total-elections', totalElections);
        this.updateStatCard('active-elections', activeElections);
        this.updateStatCard('total-votes', totalVotes);
    }

    updateStatCard(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    async loadElectionResults(electionId) {
        if (!electionId) return;

        try {
            const response = await fetch(`/api/admin/election/${electionId}/results`);
            const result = await response.json();

            if (response.ok) {
                this.currentElection = result.election;
                this.displayResults(result.results);
                this.createResultsChart(result.results);
            } else {
                this.showError('Failed to load election results');
            }
        } catch (error) {
            console.error('Results loading error:', error);
            this.showError('Failed to load election results');
        }
    }

    displayResults(results) {
        const resultsContainer = document.getElementById('results-container');
        const electionTitle = document.getElementById('current-election-title');

        if (electionTitle && this.currentElection) {
            electionTitle.textContent = this.currentElection.title;
        }

        if (resultsContainer) {
            resultsContainer.innerHTML = '';

            if (results.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="alert alert-info">
                        No votes have been cast yet in this election.
                    </div>
                `;
                return;
            }

            // Sort results by vote count (descending)
            results.sort((a, b) => b.votes - a.votes);

            results.forEach((candidate, index) => {
                const resultCard = document.createElement('div');
                resultCard.className = 'candidate-result slide-up';
                resultCard.style.animationDelay = `${index * 0.1}s`;

                resultCard.innerHTML = `
                    <div class="result-info">
                        <div class="result-name">${candidate.name}</div>
                        <div class="result-party">${candidate.party}</div>
                        <div class="progress mt-2">
                            <div class="progress-bar" role="progressbar" 
                                 style="width: ${candidate.percentage}%"
                                 aria-valuenow="${candidate.percentage}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                            </div>
                        </div>
                    </div>
                    <div class="result-votes">
                        <div class="vote-count">${candidate.votes}</div>
                        <div class="vote-percentage">${candidate.percentage.toFixed(1)}%</div>
                    </div>
                `;

                resultsContainer.appendChild(resultCard);
            });
        }
    }

    createResultsChart(results) {
        const chartContainer = document.getElementById('results-chart');
        if (!chartContainer) return;

        // Clear previous chart
        chartContainer.innerHTML = '<canvas id="results-chart-canvas" width="400" height="200"></canvas>';

        const canvas = document.getElementById('results-chart-canvas');
        const ctx = canvas.getContext('2d');

        // Simple bar chart implementation
        const maxVotes = Math.max(...results.map(r => r.votes));
        const chartHeight = canvas.height - 60;
        const chartWidth = canvas.width - 100;
        const barWidth = chartWidth / results.length;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw bars
        results.forEach((candidate, index) => {
            const barHeight = (candidate.votes / maxVotes) * chartHeight;
            const x = 50 + index * barWidth;
            const y = canvas.height - 30 - barHeight;

            // Draw bar
            ctx.fillStyle = `hsl(${index * 60}, 70%, 50%)`;
            ctx.fillRect(x, y, barWidth - 10, barHeight);

            // Draw candidate name
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(candidate.name, x + (barWidth - 10) / 2, canvas.height - 5);

            // Draw vote count
            ctx.fillText(candidate.votes, x + (barWidth - 10) / 2, y - 5);
        });
    }

    startRealTimeUpdates() {
        this.realTimeInterval = setInterval(() => {
            if (this.currentElection) {
                this.loadElectionResults(this.currentElection.id);
            }
        }, 30000); // Update every 30 seconds

        this.showInfo('Real-time updates enabled');
    }

    stopRealTimeUpdates() {
        if (this.realTimeInterval) {
            clearInterval(this.realTimeInterval);
            this.realTimeInterval = null;
        }
        this.showInfo('Real-time updates disabled');
    }

    showLoading(show) {
        const loadingElement = document.getElementById('loading-indicator');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
    }

    updateImagePreview(imageUrl, previewId, placeholderId) {
        const preview = document.getElementById(previewId);
        const placeholder = document.getElementById(placeholderId);

        if (imageUrl && this.isValidImageUrl(imageUrl)) {
            preview.src = imageUrl;
            preview.classList.remove('d-none');
            placeholder.classList.add('d-none');

            // Handle image load errors
            preview.onerror = () => {
                preview.classList.add('d-none');
                placeholder.classList.remove('d-none');
                this.showError('Failed to load image. Please check the URL.');
            };
        } else {
            preview.classList.add('d-none');
            placeholder.classList.remove('d-none');
        }
    }

    isValidImageUrl(url) {
        try {
            new URL(url);
            return /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(url);
        } catch {
            return false;
        }
    }

    formatAddress(address) {
        if (!address) return 'N/A';
        return `${address.substring(0, 6)}...${address.substring(38)}`;
    }

    // Alert methods
    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showInfo(message) {
        this.showAlert(message, 'info');
    }

    async createElection() {
        try {
            const formData = {
                title: document.getElementById('election-title').value,
                description: document.getElementById('election-description').value,
                start_time: document.getElementById('start-date').value,
                end_time: document.getElementById('end-date').value,
                is_active: document.getElementById('election-status').value === 'true'
            };

            const response = await fetch('/api/admin/create_election', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (response.ok) {
                this.showSuccess('Election created successfully!');
                document.getElementById('create-election-form').reset();
                this.loadDashboardData();
            } else {
                this.showError(result.error || 'Failed to create election');
            }
        } catch (error) {
            this.showError('Failed to create election');
        }
    }

    async loadCandidatesForElection(electionId) {
        try {
            const response = await fetch(`/api/admin/election/${electionId}/candidates`);
            const result = await response.json();

            if (response.ok) {
                this.displayCandidates(result.candidates, electionId);
            } else {
                this.showError('Failed to load candidates');
            }
        } catch (error) {
            this.showError('Failed to load candidates');
        }
    }

    displayCandidates(candidates, electionId) {
        const container = document.getElementById('candidates-list');

        if (candidates.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-user-plus fa-3x mb-3"></i>
                    <h5>No Candidates Added</h5>
                    <p>Click "Add Candidate" to add candidates to this election.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        candidates.forEach(candidate => {
            const candidateCard = document.createElement('div');
            candidateCard.className = 'card bg-dark border-secondary mb-3';
            candidateCard.innerHTML = `
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-2 text-center">
                            <img src="${candidate.logo_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'}" 
                                 class="rounded-circle" width="60" height="60" alt="${candidate.name}">
                        </div>
                        <div class="col-md-6">
                            <h6 class="mb-1">${candidate.name}</h6>
                            <p class="text-muted mb-1">${candidate.party}</p>
                            <small class="text-muted">${candidate.age} years • ${candidate.location || 'Location not specified'}</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <div class="badge bg-primary">${candidate.vote_count || 0} votes</div>
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="editCandidate(${candidate.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteCandidate(${candidate.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(candidateCard);
        });
    }

    manageCandidates(electionId) {
        document.getElementById('candidate-election-select').value = electionId;
        document.querySelector('[data-bs-target="#manage-candidates-pane"]').click();
        this.loadCandidatesForElection(electionId);
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

// Global functions for candidate management
async function saveCandidateDetails() {
    const electionId = document.getElementById('candidate-election-select').value;
    if (!electionId) {
        alert('Please select an election first');
        return;
    }

    const candidateData = {
        name: document.getElementById('candidate-name').value.trim(),
        party: document.getElementById('candidate-party').value.trim(),
        description: document.getElementById('candidate-description').value.trim(),
        age: parseInt(document.getElementById('candidate-age').value) || null,
        location: document.getElementById('candidate-location').value.trim(),
        topic: document.getElementById('candidate-topic').value,
        logo_url: document.getElementById('candidate-logo').value.trim(),
        education: document.getElementById('candidate-education').value.trim(),
        experience: document.getElementById('candidate-experience').value.trim(),
        manifesto: document.getElementById('candidate-manifesto').value.trim(),
        election_id: parseInt(electionId)
    };

    // Validate required fields
    if (!candidateData.name || !candidateData.party || !candidateData.description || !candidateData.location || !candidateData.topic) {
        alert('Please fill in all required fields (Name, Party, Description, Location, and Topic)');
        return;
    }

    try {
        const response = await fetch('/api/admin/add_candidate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(candidateData)
        });

        const result = await response.json();
        if (response.ok) {
            document.getElementById('add-candidate-form').reset();
            bootstrap.Modal.getInstance(document.getElementById('addCandidateModal')).hide();
            window.adminDashboard.showSuccess('Candidate added successfully!');
            window.adminDashboard.loadCandidatesForElection(electionId);

            // Update image preview to placeholder
            document.getElementById('candidate-image-preview').classList.add('d-none');
            document.getElementById('image-placeholder').classList.remove('d-none');
        } else {
            alert(result.error || 'Failed to add candidate');
        }
    } catch (error) {
        console.error('Error adding candidate:', error);
        alert('Failed to add candidate: ' + error.message);
    }
}

// Load candidates when election is selected  
function loadCandidates() {
    const electionId = document.getElementById('candidate-election-select').value;
    if (electionId) {
        window.adminDashboard.loadCandidatesForElection(electionId);
    }
}

async function editCandidate(candidateId) {
    // Load candidate data and show edit modal
    try {
        const response = await fetch(`/api/admin/candidate/${candidateId}`);
        const candidate = await response.json();

        if (response.ok) {
            // Populate edit form
            document.getElementById('edit-candidate-id').value = candidate.id;
            document.getElementById('edit-candidate-name').value = candidate.name || '';
            document.getElementById('edit-candidate-party').value = candidate.party || '';
            document.getElementById('edit-candidate-description').value = candidate.description || '';
            document.getElementById('edit-candidate-age').value = candidate.age || '';
            document.getElementById('edit-candidate-location').value = candidate.location || '';
            document.getElementById('edit-candidate-topic').value = candidate.topic || '';
            document.getElementById('edit-candidate-logo').value = candidate.logo_url || '';
            document.getElementById('edit-candidate-education').value = candidate.education || '';
            document.getElementById('edit-candidate-experience').value = candidate.experience || '';
            document.getElementById('edit-candidate-manifesto').value = candidate.manifesto || '';

            // Update image preview
            if (candidate.logo_url) {
                window.adminDashboard.updateImagePreview(candidate.logo_url, 'edit-candidate-image-preview', 'edit-image-placeholder');
            }

            new bootstrap.Modal(document.getElementById('editCandidateModal')).show();
        }
    } catch (error) {
        alert('Failed to load candidate data');
    }
}

async function updateCandidateDetails() {
    const candidateId = document.getElementById('edit-candidate-id').value;
    const candidateData = {
        name: document.getElementById('edit-candidate-name').value.trim(),
        party: document.getElementById('edit-candidate-party').value.trim(),
        description: document.getElementById('edit-candidate-description').value.trim(),
        age: parseInt(document.getElementById('edit-candidate-age').value) || null,
        location: document.getElementById('edit-candidate-location').value.trim(),
        topic: document.getElementById('edit-candidate-topic').value,
        logo_url: document.getElementById('edit-candidate-logo').value.trim(),
        education: document.getElementById('edit-candidate-education').value.trim(),
        experience: document.getElementById('edit-candidate-experience').value.trim(),
        manifesto: document.getElementById('edit-candidate-manifesto').value.trim()
    };

    // Validate required fields
    if (!candidateData.name || !candidateData.party || !candidateData.description || !candidateData.location || !candidateData.topic) {
        alert('Please fill in all required fields (Name, Party, Description, Location, and Topic)');
        return;
    }

    try {
        const response = await fetch(`/api/admin/update_candidate/${candidateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(candidateData)
        });

        const result = await response.json();
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('editCandidateModal')).hide();
            window.adminDashboard.showSuccess('Candidate updated successfully!');
            const electionId = document.getElementById('candidate-election-select').value;
            window.adminDashboard.loadCandidatesForElection(electionId);
        } else {
            alert(result.error || 'Failed to update candidate');
        }
    } catch (error) {
        alert('Failed to update candidate');
    }
}

async function deleteCandidate(candidateId) {
    if (!confirm('Are you sure you want to delete this candidate?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/delete_candidate/${candidateId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (response.ok) {
            window.adminDashboard.showSuccess('Candidate deleted successfully!');
            const electionId = document.getElementById('candidate-election-select').value;
            window.adminDashboard.loadCandidatesForElection(electionId);
        } else {
            alert(result.error || 'Failed to delete candidate');
        }
    } catch (error) {
        alert('Failed to delete candidate');
    }
}

async function loadCandidates() {
    const electionId = document.getElementById('candidate-election-select').value;
    if (electionId) {
        window.adminDashboard.loadCandidatesForElection(electionId);
    }
}

// Initialize admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.adminDashboard = new AdminDashboard();
});
// Connect wallet button
        const connectWalletBtn = document.getElementById('connect-admin-wallet');
        if (connectWalletBtn) {
            connectWalletBtn.addEventListener('click', async () => {
                if (typeof window.ethereum === 'undefined') {
                    showAlert('Please install MetaMask browser extension first!', 'danger');
                    return;
                }

                connectWalletBtn.disabled = true;
                connectWalletBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Connecting...';

                try {
                    const connected = await window.web3Integration?.connectWallet();
                    if (connected) {
                        showAdminPanel();
                    }
                } finally {
                    connectWalletBtn.disabled = false;
                    connectWalletBtn.innerHTML = '<i class="fas fa-wallet me-2"></i>Connect Admin Wallet';
                }
            });
        }