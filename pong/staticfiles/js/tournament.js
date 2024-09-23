class Tournament {
    constructor() {
        this.players = [];
        this.currentRoundPairs = [];
        this.activeTournament = false;
        this.currentMatchIndex = 0;
        this.winners = [];
        this.lastMatchWiner = null;
        this.lastRound = false;
        console.log("Tournament initialized");
    }

    openModal(modalId) {
        console.log(`Opening modal with ID: ${modalId}`);
        document.getElementById(modalId).style.display = 'flex';
    }

    closeModal(modalId) {
        console.log(`Closing modal with ID: ${modalId}`);
        document.getElementById(modalId).style.display = 'none';
    }

    generatePlayerInputs() {
        const numPlayers = document.getElementById('numPlayers').value;
        console.log(`Number of players entered: ${numPlayers}`);
        const playerFormDiv = document.getElementById('playerFormDiv');
        playerFormDiv.innerHTML = '';

        if (numPlayers < 2) {
            alert("Please enter at least 2 players.");
            console.log("Error: Less than 2 players");
            return;
        }

        if (numPlayers > 4) {
            alert("Only up to 4 players can participate in the tournament.");
            console.log("Error: More than 8 players");
            return;
        }

        let formHTML = `<form id="playerForm">`;
        for (let i = 0; i < numPlayers; i++) {
            formHTML += `
                <div class="form-group mb-2">
                    <input type="text" class="form-control" name="player${i}" placeholder="Player ${i + 1} Alias" required>
                </div>
            `;
        }
        formHTML += `<button type="button" id="startTournamentBtn" class="btn btn-primary">Start Tournament</button></form>`;
        playerFormDiv.innerHTML = formHTML;

        console.log("Player form generated with inputs for each player");

        this.closeModal('numberOfPlayersModal');
        this.openModal('playerFormModal');

        const startTournamentBtn = document.getElementById('startTournamentBtn');
        if (startTournamentBtn) {
            startTournamentBtn.addEventListener('click', () => {
                console.log("Start Tournament button clicked");
                this.collectPlayerNames();
            });
        }
    }

    collectPlayerNames() {
        console.log("Collecting player names from the form");
        const playerForm = document.getElementById('playerForm');
        const formData = new FormData(playerForm);
        this.players = [];

        formData.forEach((value, key) => {
            console.log(`Collected player ${key}: ${value}`);
            this.players.push(value); // Collect player names
        });

        console.log("Collected player names:", this.players);

        if (this.players.length < 2) {
            alert("You need at least 2 players to start the tournament.");
            console.log("Error: Less than 2 players after form submission");
            return;
        }

        console.log("Player names collected successfully");
        this.closeModal('playerFormModal');
        this.startTournament();
    }

    shufflePlayers() {
        console.log("Shuffling players before starting the tournament");
        for (let i = this.players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.players[i], this.players[j]] = [this.players[j], this.players[i]];
        }
        console.log("Shuffled players:", this.players);
    }

    organizeIntoPairs() {
        console.log("Organizing players into pairs");
        const pairs = [];

        if (this.players.length === 1) {
            const singlePlayer = this.players[0];
            alert(`${singlePlayer} is the tournament champion!`);
            document.getElementById('gameCon').style.display = 'none';
            document.getElementById('sideBar').style.display = 'flex';
            document.getElementById('mainPageHome').style.display = 'flex';
            console.log(`Tournament champion: ${singlePlayer}`);
        }
    
        if (this.players.length % 2 !== 0) {
            const byePlayerIndex = Math.floor(Math.random() * this.players.length);
            const byePlayer = this.players.splice(byePlayerIndex, 1)[0]; 
            pairs.push([byePlayer, null]);
            console.log(`Bye assigned to player: ${byePlayer}`);
        }
    
        for (let i = 0; i < this.players.length; i += 2) {
            if (this.players[i + 1] !== undefined) {
                pairs.push([this.players[i], this.players[i + 1]]);
                console.log(`Pair formed: ${this.players[i]} vs ${this.players[i + 1]}`);
            } else {
                console.log(`Unpaired player: ${this.players[i]}`);
            }
        }
    
        console.log("Generated pairs for the round:", pairs);
        return pairs;
    }

    async runMatch(player1, player2) {
        console.log(`Running match between ${player1} and ${player2}`);
        try {
            if (player2 === null) {
                alert(`${player1} automatically advances to the next round due to a bye.`);
                console.log(`${player1} advances due to bye`);
                return player1;
            }
    
            alert(`Starting match between ${player1} and ${player2}`);
            const gameAppS = new GameAPPS(player1, player2, 1);
            const winner = await gameAppS.init();
    
            console.log("Match completed. Winner:", winner);
            this.displayMatchResult(winner);
            return(winner);
        } catch (error) {
            console.error("An error occurred while running the match:", error);
        }
    }

    displayMatchResult(winner) {
        console.log("Displaying the result for winner: ", winner);

        const gameCon = document.getElementById('gameCon');
        const bracketHTML = this.getBracketHTML(winner);

        const resultText = this.lastRound ? `${winner} is the champion!` : `${winner} is the winner!`;
        const buttonText = this.lastRound ? 'Home' : 'Start Next Match';

        gameCon.innerHTML = `
            <div class="winner-container">
                <h1 class="winner-text">${resultText}</h1>
                <div id="bracketCon">${bracketHTML}</div>
                <button id="nextMatchButton" class="next-match-button">${buttonText}</button>
            </div>
        `;

        document.getElementById('nextMatchButton').addEventListener('click', () => {
            console.log("Next Match button clicked");
            document.getElementById('gameCon').style.display = 'none';
            gameCon.innerHTML = '';
            // this.startNextMatch();
            this.currentMatchIndex += 2;
        }, { once: true });
    }

    getBracketHTML(winner) {
        let bracketHTML = '';
        this.currentRoundPairs.forEach(pair => {
            bracketHTML += `<div class="bracket-pair">`;
            pair.forEach(player => {
                let playerClass = '';
                if (player === winner) {
                    playerClass += 'winner ';
                }
                if (player === this.lastMatchWiner) {
                    playerClass += 'winner ';
                }
                this.lastMatchWiner = winner;
                bracketHTML += `<div class="bracket-player ${playerClass}">${player || 'Bye'}</div>`;
            });
            bracketHTML += `</div>`;
        });
    
        return bracketHTML;
    }

    async startNextMatch() {
        console.log("Starting next match. Current match index:", this.currentMatchIndex);
        console.log("Starting next match. Current Pair length:", this.currentRoundPairs.length);
        if (this.currentMatchIndex < this.currentRoundPairs.length) {
            const [player1, player2] = this.currentRoundPairs[this.currentMatchIndex];
            console.log(`Current match index: ${this.currentMatchIndex}`);
            console.log(`Player 1: ${player1}`);
            console.log(`Player 2: ${player2}`);
            try {
                const winner = await this.runMatch(player1, player2);
                this.winners.push(winner);
                console.log(`Winner of the match: ${winner}`);
            } catch (error) {
                console.error("Error running the match:", error);
            }
        } else {
            console.log("All matches in the current round are complete.");
            this.players = this.winners;
            this.winners = [];
            this.currentMatchIndex = 0;
            
            if (this.players.length > 1) {
                this.currentRoundPairs = this.organizeIntoPairs();
                await this.runRound(this.currentRoundPairs);
            } else {
                const champion = this.players[0];
                if (champion) {
                    alert(`${champion} is the tournament champion!`);
                    document.getElementById('gameCon').style.display = 'none';
                    document.getElementById('sideBar').style.display = 'flex';
                    document.getElementById('mainPageHome').style.display = 'flex';
                    console.log(`Tournament champion: ${champion}`);
                } else {
                    console.error("Error: No champion found.");
                }
                this.resetTournament();
            }
        }
    }
    
    async runRound(pairs) {
        console.log("Starting round with pairs:", pairs);
        const winners = [];
        for (const [player1, player2] of pairs) {
            console.log(`Running match for pair: ${player1} vs ${player2}`);
            const winner = await this.runMatch(player1, player2);
            winners.push(winner);
            console.log(`Match result: ${winner} is the winner`);
            await this.waitForNextMatch();
        }
        console.log("Winners of the round:", winners);
        this.players = winners; 
        this.currentRoundPairs = this.organizeIntoPairs();
    }

    async waitForNextMatch() {
        return new Promise((resolve) => {
            console.log("Waiting for user to start the next match");
    
            const nextMatchButton = document.getElementById('nextMatchButton');
            if (nextMatchButton) {
                const handleNextMatch = () => {
                    nextMatchButton.removeEventListener('click', handleNextMatch);
                    resolve();
                };
    
                nextMatchButton.addEventListener('click', handleNextMatch);
            } else {
                console.error("Next Match button not found.");
                resolve();
            }
        });
    }

    async startTournament() {
        console.log("Starting the tournament");
        this.activeTournament = true;
    
        this.shufflePlayers();
    
        const totalRounds = this.calculateTotalRounds(this.players.length);
        console.log(`Total rounds: ${totalRounds}`);
        for (let round = 1; round <= totalRounds; round++) {
            console.log(`Starting round ${round}`);
            if(round === totalRounds)
                this.lastRound = true;
            if (this.players.length > 1) {
                this.currentRoundPairs = this.organizeIntoPairs();
                await this.runRound(this.currentRoundPairs);
            } else {
                const champion = this.players[0];
                if (champion) {
                    alert(`${champion} is the tournament champion!`);
                    document.getElementById('gameCon').style.display = 'none';
                    document.getElementById('sideBar').style.display = 'flex';
                    document.getElementById('mainPageHome').style.display = 'flex';
                    console.log(`Tournament champion: ${champion}`);
                } else {
                    console.error("Error: No champion found.");
                }
                break;
            }
        }
    
        this.resetTournament();
    }

    calculateTotalRounds(numPlayers) {
        let rounds = 0;
        while (numPlayers > 1) {
            numPlayers = Math.ceil(numPlayers / 2);
            rounds += 1;
        }
        return rounds;
    }

    resetTournament() {
        console.log("Resetting the tournament");
        this.players = [];
        this.currentRoundPairs = [];
        this.activeTournament = false;
        this.currentMatchIndex = 0;
        this.winners = [];
        console.log("Tournament has been reset");
    }
}
