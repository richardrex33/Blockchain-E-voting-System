/**
 * Web3 Integration for Blockchain E-Voting System
 * Handles MetaMask connection and blockchain interactions
 */

class Web3Integration {
    constructor() {
        this.web3 = null;
        this.account = null;
        this.isConnected = false;
        this.contractAddress = null;
        this.contract = null;
        this.votingContractABI = [
            {
                "inputs": [
                    {"internalType": "string", "name": "_electionTitle", "type": "string"},
                    {"internalType": "string[]", "name": "_candidateNames", "type": "string[]"}
                ],
                "stateMutability": "nonpayable",
                "type": "constructor"
            },
            {
                "inputs": [
                    {"internalType": "uint256", "name": "_candidateId", "type": "uint256"}
                ],
                "name": "vote",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "uint256", "name": "_candidateId", "type": "uint256"}
                ],
                "name": "getCandidate",
                "outputs": [
                    {"internalType": "uint256", "name": "id", "type": "uint256"},
                    {"internalType": "string", "name": "name", "type": "string"},
                    {"internalType": "uint256", "name": "voteCount", "type": "uint256"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "_voter", "type": "address"}
                ],
                "name": "getVoter",
                "outputs": [
                    {"internalType": "bool", "name": "hasVoted", "type": "bool"},
                    {"internalType": "uint256", "name": "candidateId", "type": "uint256"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "getAllCandidates",
                "outputs": [
                    {"internalType": "uint256[]", "name": "ids", "type": "uint256[]"},
                    {"internalType": "string[]", "name": "names", "type": "string[]"},
                    {"internalType": "uint256[]", "name": "voteCounts", "type": "uint256[]"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ];
        
        this.init();
    }

    async init() {
        // Check if MetaMask is installed
        if (typeof window.ethereum !== 'undefined') {
            this.web3 = new Web3(window.ethereum);
            await this.checkConnection();
            this.setupEventListeners();
        } else {
            this.showMetaMaskError();
        }
    }

    async checkConnection() {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                this.account = accounts[0];
                this.isConnected = true;
                this.updateConnectionStatus();
            }
        } catch (error) {
            console.error('Error checking connection:', error);
        }
    }

    async connectWallet() {
        try {
            if (typeof window.ethereum === 'undefined') {
                this.showMetaMaskError();
                return false;
            }

            // Check if already connected
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                this.account = accounts[0];
                this.isConnected = true;
                this.updateConnectionStatus();
                this.showSuccess('Wallet already connected!');
                return true;
            }

            // Request account access with proper MetaMask modal
            const requestedAccounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts',
                params: []
            });
            
            if (requestedAccounts.length > 0) {
                this.account = requestedAccounts[0];
                this.isConnected = true;
                this.updateConnectionStatus();
                this.showSuccess('MetaMask wallet connected successfully!');
                
                // Get network info for better UX
                const networkInfo = await this.getNetworkInfo();
                if (networkInfo) {
                    console.log(`Connected to ${networkInfo.name}`);
                }
                
                return true;
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
            
            if (error.code === 4001) {
                this.showError('MetaMask connection was rejected by user.');
            } else if (error.code === -32002) {
                this.showError('MetaMask is already processing a connection request.');
            } else {
                this.showError('Failed to connect to MetaMask. Please try again.');
            }
            return false;
        }
    }

    async disconnectWallet() {
        this.account = null;
        this.isConnected = false;
        this.updateConnectionStatus();
        this.showInfo('Wallet disconnected.');
    }

    setupEventListeners() {
        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
                this.account = accounts[0];
                this.isConnected = true;
            } else {
                this.account = null;
                this.isConnected = false;
            }
            this.updateConnectionStatus();
            location.reload(); // Refresh page on account change
        });

        // Listen for chain changes
        window.ethereum.on('chainChanged', () => {
            location.reload(); // Refresh page on network change
        });
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('wallet-status');
        const connectBtn = document.getElementById('connect-wallet-btn');
        const disconnectBtn = document.getElementById('disconnect-wallet-btn');
        const walletAddress = document.getElementById('wallet-address');

        if (statusElement) {
            if (this.isConnected) {
                statusElement.innerHTML = `
                    <div class="d-flex align-items-center">
                        <div class="status-indicator bg-success rounded-circle me-2" style="width: 10px; height: 10px;"></div>
                        <span class="text-success fw-bold">Wallet Connected</span>
                    </div>
                `;
            } else {
                statusElement.innerHTML = `
                    <div class="d-flex align-items-center">
                        <div class="status-indicator bg-danger rounded-circle me-2" style="width: 10px; height: 10px;"></div>
                        <span class="text-danger fw-bold">Wallet Not Connected</span>
                    </div>
                `;
            }
        }

        if (connectBtn) {
            connectBtn.style.display = this.isConnected ? 'none' : 'block';
        }

        if (disconnectBtn) {
            disconnectBtn.style.display = this.isConnected ? 'block' : 'none';
        }

        if (walletAddress) {
            if (this.isConnected && this.account) {
                walletAddress.textContent = `Connected: ${this.account.substring(0, 6)}...${this.account.substring(38)}`;
            } else {
                walletAddress.textContent = 'Connect your MetaMask wallet to vote';
            }
        }

        // Update blockchain status indicator
        this.updateBlockchainStatus();
    }

    updateBlockchainStatus() {
        let statusDiv = document.getElementById('blockchain-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'blockchain-status';
            statusDiv.className = 'blockchain-status';
            document.body.appendChild(statusDiv);
        }

        if (this.isConnected) {
            statusDiv.className = 'blockchain-status blockchain-connected';
            statusDiv.textContent = '🔗 Blockchain Connected';
        } else {
            statusDiv.className = 'blockchain-status blockchain-disconnected';
            statusDiv.textContent = '⚠️ Blockchain Disconnected';
        }
    }

    async castVote(candidateId) {
        if (!this.isConnected) {
            this.showError('Please connect your wallet first.');
            return null;
        }

        try {
            // For demo purposes, create a mock transaction
            // In a real implementation, this would interact with the smart contract
            const mockTxHash = this.generateMockTxHash();
            
            // Simulate transaction delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.showSuccess('Vote cast successfully on blockchain!');
            return mockTxHash;
        } catch (error) {
            console.error('Error casting vote:', error);
            this.showError('Failed to cast vote on blockchain. Please try again.');
            return null;
        }
    }

    generateMockTxHash() {
        // Generate a realistic-looking transaction hash for demo purposes
        const chars = '0123456789abcdef';
        let hash = '0x';
        for (let i = 0; i < 64; i++) {
            hash += chars[Math.floor(Math.random() * chars.length)];
        }
        return hash;
    }

    async getNetworkInfo() {
        try {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const networkId = parseInt(chainId, 16);
            
            const networks = {
                1: 'Ethereum Mainnet',
                3: 'Ropsten Testnet',
                4: 'Rinkeby Testnet',
                5: 'Goerli Testnet',
                11155111: 'Sepolia Testnet',
                1337: 'Local Development'
            };

            return {
                chainId: networkId,
                name: networks[networkId] || `Unknown Network (${networkId})`
            };
        } catch (error) {
            console.error('Error getting network info:', error);
            return null;
        }
    }

    async getBalance() {
        if (!this.isConnected) return 0;

        try {
            const balance = await this.web3.eth.getBalance(this.account);
            return this.web3.utils.fromWei(balance, 'ether');
        } catch (error) {
            console.error('Error getting balance:', error);
            return 0;
        }
    }

    showMetaMaskError() {
        this.showError(`
            MetaMask is not installed! Please install MetaMask browser extension to use this voting system.
            <br><a href="https://metamask.io/" target="_blank" class="text-primary">Download MetaMask</a>
        `);
    }

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
        const alertContainer = document.getElementById('alert-container') || document.body;
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; max-width: 500px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        alertContainer.appendChild(alertDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    // Utility method to format addresses
    formatAddress(address) {
        if (!address) return 'N/A';
        return `${address.substring(0, 6)}...${address.substring(38)}`;
    }

    // Utility method to validate Ethereum address
    isValidAddress(address) {
        return this.web3 && this.web3.utils.isAddress(address);
    }
}

// Initialize Web3 integration when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.web3Integration = new Web3Integration();
});
