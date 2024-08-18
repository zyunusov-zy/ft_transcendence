class GlobApp {
    constructor() {
        this.globalSocket = null;
    }

    GlobSocket() {
        this.globalSocket = new WebSocket(`ws://${window.location.host}/ws/global/`);

        this.globalSocket.onopen = () => {
            console.log('Global WebSocket connection established');
        };

        this.globalSocket.onmessage = (e) => {
            console.log('Message received:', e.data);

            const data = JSON.parse(e.data);
            if (data.type === 'notification') {
                alert('New message from your friend: ' + data.message);
            } else if (data.type === 'game_request') {
                console.log("REQUEST GOTTT");
                this.displayGameRequest(data.sender_id, data.sender_username, data.game_request);
            } else if (data.type === 'game_response') {
                alert('Game request ' + data.response + ' by ' + data.responder_username);
                if (data.response === 'accepted') {
                    console.log("Game request accepted");
                    this.gameVis(data.responder_username);
                }
            } else if (data.type === 'in_game') {
                alert(data.message);
                console.error('Error:', data.message);
            }
        };

        this.globalSocket.onerror = (e) => {
            console.error('WebSocket error:', e);
        };

        this.globalSocket.onclose = (e) => {
            console.error('Global socket closed unexpectedly:', e);
        };
    }

    sendGameRequest(receiverUsername, gameRequest) {
        if (this.globalSocket && this.globalSocket.readyState === WebSocket.OPEN) {
            this.globalSocket.send(JSON.stringify({
                'receiver_username': receiverUsername,
                'game_request': gameRequest,
            }));
            console.log('Game request sent:', { receiverUsername, gameRequest });
        } else {
            console.error('Global WebSocket is not open. Cannot send game request.');
        }
    }

    sendGameResponse(receiverId, response) {
        if (this.globalSocket && this.globalSocket.readyState === WebSocket.OPEN) {
            this.globalSocket.send(JSON.stringify({
                'receiver_id': receiverId,
                'response': response,
            }));
            console.log('Game response sent:', { receiverId, response });
        } else {
            console.error('Global WebSocket is not open. Cannot send game response.');
        }
    }

    displayGameRequest(senderId, senderUsername, gameRequest) {
        const overlay = document.createElement('div');
        overlay.id = 'gameRequestOverlay';
        
        const gameRequestContainer = document.createElement('div');
        gameRequestContainer.id = 'gameRequestContainer';
        gameRequestContainer.innerHTML = `
            <p>${senderUsername} wants to play a game: ${gameRequest}</p>
            <button id="acceptGameRequest">Accept</button>
            <button id="rejectGameRequest">Reject</button>
        `;
        
        overlay.appendChild(gameRequestContainer);
        document.body.appendChild(overlay);

        document.getElementById('acceptGameRequest').addEventListener('click', () => {
            this.sendGameResponse(senderId, 'accepted');
            document.body.removeChild(overlay);
            this.gameVis(senderUsername);
        });

        document.getElementById('rejectGameRequest').addEventListener('click', () => {
            this.sendGameResponse(senderId, 'rejected');
            document.body.removeChild(overlay);
        });
    }

    gameVis(friendUsername) {
        document.getElementById('gameCon').style.display = 'block';
        document.getElementById('sideBar').style.display = 'none';
        document.getElementById('mainPageHome').style.display = 'none';
        const gameApp = new GameApp();
        gameApp.init(friendUsername);
        const scoreboard = document.createElement('div');
        scoreboard.innerHTML = `
        <div id="scoreboard">
            <div id="player1">
                <span id="player1-name"></span>
            </div>
            <div id="score-center">
                <span id="player1-score"></span> - <span id="player2-score"></span>
            </div>
            <div id="player2">
                <span id="player2-name"></span>
            </div>
        </div>
        `;
        document.getElementById('gameCon').appendChild(scoreboard);
        
       gameApp.initGame();
    }

    clearS()
    {
        this.globalSocket.close();
    }

    init() {
        this.GlobSocket();
        console.log("IAM INIT");
    }
};

















