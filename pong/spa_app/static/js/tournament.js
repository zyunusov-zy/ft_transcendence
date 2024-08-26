class Tournament {
    constructor() {
        this.players = [];
        this.currentRoundPairs = [];
        this.activeTournament = false;
        this.currentMatchIndex = 0;
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

        if (this.players.length % 2 !== 0) {
            const byePlayerIndex = Math.floor(Math.random() * this.players.length);
            const byePlayer = this.players.splice(byePlayerIndex, 1)[0]; // Remove the bye player from the list
            pairs.push([byePlayer, null]); // Add the player with a bye
            console.log(`Bye assigned to player: ${byePlayer}`);
        }

        for (let i = 0; i < this.players.length; i += 2) {
            pairs.push([this.players[i], this.players[i + 1]]);
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
        const gameCon = document.getElementById('gameCon');
        gameCon.innerHTML = `
            <div class="winner-container">
                <h1 class="winner-text">${winner} is the winner!</h1>
                <button id="nextMatchButton" class="next-match-button">Start Next Match</button>
            </div>
        `;

        document.getElementById('nextMatchButton').addEventListener('click', () => {
            const gameCon = document.getElementById('gameCon');
            while (gameCon.firstChild) {
                gameCon.removeChild(gameCon.firstChild);
            }
            document.getElementById('gameCon').style.display = 'none';
            document.getElementById('sideBar').style.display = 'flex';
            document.getElementById('mainPageHome').style.display = 'flex';
            this.startNextMatch();
        });
    }

    async startNextMatch() {
        // Logic to start the next match
        if (this.players.length > this.currentMatchIndex) {
            const player1 = this.players[this.currentMatchIndex];
            const player2 = this.players[this.currentMatchIndex + 1] || null;
            this.currentMatchIndex += 2; // Move to the next match

            const winner = await this.runMatch(player1, player2);
            // Process the winner if needed
            console.log(`Winner of the next match: ${winner}`);
        } else {
            console.log('No more matches to start.');
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
        return winners;
    }

    async startTournament() {
        console.log("Tournament started");
        this.activeTournament = true;

        this.shufflePlayers(); // Shuffle players before starting

        while (this.players.length > 1) {
            const pairs = this.organizeIntoPairs();
            this.players = await this.runRound(pairs); // Get the winners for the next round
        }

        const champion = this.players[0]; // The last remaining player
        console.log(`Tournament champion: ${champion}`);
        alert(`${champion} is the tournament champion!`);
        this.resetTournament();
    }

    resetTournament() {
        console.log("Resetting the tournament");
        this.players = [];
        this.currentRoundPairs = [];
        this.activeTournament = false;
        console.log("Tournament has been reset");
    }

    displayMatchInfo(player1, player2) {
        const matchInfoDiv = document.getElementById('matchInfo');
        if (player2 === null) {
            matchInfoDiv.innerHTML = `${player1} automatically advances to the next round.`;
        } else {
            matchInfoDiv.innerHTML = `Now playing: ${player1} vs ${player2}`;
        }
        console.log(`Displaying match info: ${player1} vs ${player2}`);
    }
}
