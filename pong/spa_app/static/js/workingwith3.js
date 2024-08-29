class Tournament {
    constructor() {
        this.players = [];
        this.currentRoundPairs = [];
        this.activeTournament = false;
        this.currentMatchIndex = 0;
        this.winners = [];
        console.log("Tournament initialized");
    }

    openModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
        console.log(`Modal ${modalId} opened`);
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        console.log(`Modal ${modalId} closed`);
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

        if (numPlayers > 8) {
            alert("Only up to 8 players can participate in the tournament.");
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

        // Add event listener to the Start Tournament button
        const startTournamentBtn = document.getElementById('startTournamentBtn');
        if (startTournamentBtn) {
            startTournamentBtn.addEventListener('click', () => {
                console.log("Start Tournament button clicked");
                this.collectPlayerNames();
            });
        }
    }

    collectPlayerNames() {
        const playerForm = document.getElementById('playerForm');
        const formData = new FormData(playerForm);
        this.players = [];

        formData.forEach((value) => {
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
    
        // Handle bye if odd number of players
        if (this.players.length % 2 !== 0) {
            const byePlayerIndex = Math.floor(Math.random() * this.players.length);
            const byePlayer = this.players.splice(byePlayerIndex, 1)[0]; // Remove the bye player from the list
            pairs.push([byePlayer, null]); // Add the player with a bye
            console.log(`Bye assigned to player: ${byePlayer}`);
        }
    
        // Pair remaining players
        for (let i = 0; i < this.players.length; i += 2) {
            if (this.players[i + 1] !== undefined) {
                pairs.push([this.players[i], this.players[i + 1]]);
            }
        }
    
        console.log("Generated pairs for the round:", pairs);
        return pairs;
    }

    async runMatch(player1, player2) {
        try {
            console.log(`Running match between ${player1} and ${player2}`);
            if (player2 === null) {
                alert(`${player1} automatically advances to the next round due to a bye.`);
                console.log(`${player1} advances due to bye`);
                return player1;
            }
    
            alert(`Starting match between ${player1} and ${player2}`);
            const gameAppS = new GameAPPS(player1, player2, 1); // Initialize the game
            const winner = await gameAppS.init();
    
            console.log("I AM HERE");
            this.displayMatchResult(winner);
            return winner;
        } catch (error) {
            console.error("An error occurred:", error);
        }
    }

    displayMatchResult(winner) {
        console.log("Displaying the result for winner: ", winner);
        this.updateBracket();

        const gameCon = document.getElementById('gameCon');
        const bracketHTML = this.getBracketHTML();
        gameCon.innerHTML = `
            <div class="winner-container">
                <h1 class="winner-text">${winner} is the winner!</h1>
                <div id="bracketCon">${bracketHTML}</div>
                <button id="nextMatchButton" class="next-match-button">Start Next Match</button>
            </div>
        `;

        document.getElementById('nextMatchButton').addEventListener('click', () => {
            const gameCon = document.getElementById('gameCon');
            document.getElementById('gameCon').style.display = 'none';
            gameCon.innerHTML = '';
            this.startNextMatch();
        });
    }

    updateBracket() {
        const bracketCon = document.getElementById('bracketCon');
        let bracketHTML = `<div class="bracket">`;
    
        // Create the bracket layout
        this.currentRoundPairs.forEach(pair => {
            bracketHTML += `<div class="bracket-pair">`;
            pair.forEach(player => {
                bracketHTML += `<div class="bracket-player">${player || 'Bye'}</div>`;
            });
            bracketHTML += `</div>`;
        });
    
        bracketHTML += `</div>`;
        bracketCon.innerHTML = bracketHTML;
    }

    getBracketHTML() {
        let bracketHTML = '';
        
        // Create the bracket layout
        this.currentRoundPairs.forEach(pair => {
            bracketHTML += `<div class="bracket-pair">`;
            pair.forEach(player => {
                bracketHTML += `<div class="bracket-player">${player || 'Bye'}</div>`;
            });
            bracketHTML += `</div>`;
        });
    
        return bracketHTML;
    }

    async startNextMatch() {
        if (this.currentMatchIndex < this.currentRoundPairs.length) {
            const [player1, player2] = this.currentRoundPairs[this.currentMatchIndex];
            this.currentMatchIndex += 1; // Increment the match index
    
            try {
                const winner = await this.runMatch(player1, player2);
                this.winners.push(winner); // Store the winner for the next round
                console.log(`Winner of the match: ${winner}`);
            } catch (error) {
                console.error("Error running the match:", error);
            }
        } else {
            // All matches in the current round are complete
            this.players = this.winners; // Move the winners to the next round
            this.winners = []; // Reset the winners array for the next round
            this.currentMatchIndex = 0; // Reset match index for the next round
    
            if (this.players.length > 1) {
                this.currentRoundPairs = this.organizeIntoPairs(); // Set up pairs for the next round
                await this.runRound(this.currentRoundPairs); // Start the next round
            } else {
                const champion = this.players[0]; // Last remaining player
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
            const winner = await this.runMatch(player1, player2); // Get the winner for each pair
            winners.push(winner);
        }
        console.log("Winners of the round:", winners);
        this.players = winners; // Update players for the next round
        this.currentRoundPairs = this.organizeIntoPairs(); // Set up pairs for the next round
    }

    async startTournament() {
        console.log("Tournament started");
        this.activeTournament = true;
    
        this.shufflePlayers(); // Shuffle players before starting
    
        if (this.players.length > 1) {
            this.currentRoundPairs = this.organizeIntoPairs(); // Set initial pairs
            await this.runRound(this.currentRoundPairs); // Start the first round
        } else {
            const champion = this.players[0]; // Last remaining player
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