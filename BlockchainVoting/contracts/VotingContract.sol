// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title VotingContract
 * @dev A simple voting contract for blockchain-based elections
 */
contract VotingContract {
    
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }
    
    struct Voter {
        bool hasVoted;
        uint256 candidateId;
        uint256 timestamp;
    }
    
    address public owner;
    string public electionTitle;
    bool public votingActive;
    uint256 public totalVotes;
    
    mapping(uint256 => Candidate) public candidates;
    mapping(address => Voter) public voters;
    uint256 public candidatesCount;
    
    event VoteCast(address indexed voter, uint256 indexed candidateId, uint256 timestamp);
    event ElectionStarted(string title);
    event ElectionEnded(uint256 totalVotes);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier votingIsActive() {
        require(votingActive, "Voting is not active");
        _;
    }
    
    modifier hasNotVoted() {
        require(!voters[msg.sender].hasVoted, "You have already voted");
        _;
    }
    
    constructor(string memory _electionTitle, string[] memory _candidateNames) {
        owner = msg.sender;
        electionTitle = _electionTitle;
        votingActive = true;
        
        // Initialize candidates
        for (uint256 i = 0; i < _candidateNames.length; i++) {
            candidatesCount++;
            candidates[candidatesCount] = Candidate({
                id: candidatesCount,
                name: _candidateNames[i],
                voteCount: 0
            });
        }
        
        emit ElectionStarted(_electionTitle);
    }
    
    /**
     * @dev Cast a vote for a candidate
     * @param _candidateId The ID of the candidate to vote for
     */
    function vote(uint256 _candidateId) public votingIsActive hasNotVoted {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        
        // Record the vote
        voters[msg.sender] = Voter({
            hasVoted: true,
            candidateId: _candidateId,
            timestamp: block.timestamp
        });
        
        // Increment candidate vote count
        candidates[_candidateId].voteCount++;
        totalVotes++;
        
        emit VoteCast(msg.sender, _candidateId, block.timestamp);
    }
    
    /**
     * @dev Get candidate details
     * @param _candidateId The ID of the candidate
     */
    function getCandidate(uint256 _candidateId) public view returns (
        uint256 id,
        string memory name,
        uint256 voteCount
    ) {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        Candidate memory candidate = candidates[_candidateId];
        return (candidate.id, candidate.name, candidate.voteCount);
    }
    
    /**
     * @dev Get voter details
     * @param _voter The address of the voter
     */
    function getVoter(address _voter) public view returns (
        bool hasVoted,
        uint256 candidateId,
        uint256 timestamp
    ) {
        Voter memory voter = voters[_voter];
        return (voter.hasVoted, voter.candidateId, voter.timestamp);
    }
    
    /**
     * @dev Get all candidates with their vote counts
     */
    function getAllCandidates() public view returns (
        uint256[] memory ids,
        string[] memory names,
        uint256[] memory voteCounts
    ) {
        ids = new uint256[](candidatesCount);
        names = new string[](candidatesCount);
        voteCounts = new uint256[](candidatesCount);
        
        for (uint256 i = 1; i <= candidatesCount; i++) {
            ids[i-1] = candidates[i].id;
            names[i-1] = candidates[i].name;
            voteCounts[i-1] = candidates[i].voteCount;
        }
        
        return (ids, names, voteCounts);
    }
    
    /**
     * @dev End the voting process (only owner)
     */
    function endVoting() public onlyOwner {
        require(votingActive, "Voting is already ended");
        votingActive = false;
        emit ElectionEnded(totalVotes);
    }
    
    /**
     * @dev Start voting (only owner)
     */
    function startVoting() public onlyOwner {
        require(!votingActive, "Voting is already active");
        votingActive = true;
    }
    
    /**
     * @dev Get election summary
     */
    function getElectionSummary() public view returns (
        string memory title,
        bool active,
        uint256 total,
        uint256 candidateCount
    ) {
        return (electionTitle, votingActive, totalVotes, candidatesCount);
    }
}
