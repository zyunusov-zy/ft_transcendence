class GlobApp {
    constructor() {
        this.globalSocket = null;
    }

    GlobSocket() {
        this.globalSocket = new WebSocket(`wss://${window.location.host}/wss/global/`);

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
                // alert('Game request ' + data.response + ' by ' + data.responder_username);
                if (data.response === 'accepted') {
                    console.log("Game request accepted");
                    this.gameVis(data.responder_username);
                }
            } else if (data.type === 'in_game') {
                alert(data.message);
                console.error('Error:', data.message);
            } else if (data.type === 'friend_status_update') {
                console.log("AM i Updating?");
                console.log(data.username);
                console.log(data.status);
                updateFriendStatus(data.username, data.status);
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



function updateFriendStatus(username, newStatus) {
    // Find the friend element by username
    const friendElements = document.querySelectorAll('.friend-mini-box');
    
    friendElements.forEach(friendElem => {
        const nicknameElem = friendElem.querySelector("#nick");
        console.log(nicknameElem);
        if (nicknameElem && nicknameElem.textContent === username) {
            console.log("HERE MBBBBBBBBS");
            const statusIcon = friendElem.querySelector('.status-icon');
            if (statusIcon) {
                // Update the status icon based on the new status
                if (newStatus === 'online') {
                    console.log("On");
                    statusIcon.innerHTML = '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--noto" preserveAspectRatio="xMidYMid meet" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><circle cx="63.93" cy="64" r="60" fill="#689f38"></circle><circle cx="60.03" cy="63.1" r="56.1" fill="#7cb342"></circle><path d="M23.93 29.7c4.5-7.1 14.1-13 24.1-14.8c2.5-.4 5-.6 7.1.2c1.6.6 2.9 2.1 2 3.8c-.7 1.4-2.6 2-4.1 2.5a44.64 44.64 0 0 0-23 17.4c-2 3-5 11.3-8.7 9.2c-3.9-2.3-3.1-9.5 2.6-18.3z" fill="#aed581"></path></g></svg>';
                } else if (newStatus === 'offline') {
                    console.log("Off");
                    statusIcon.innerHTML = '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--noto" preserveAspectRatio="xMidYMid meet" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><circle cx="63.93" cy="64" r="60" fill="#c33"></circle><circle cx="60.03" cy="63.1" r="56.1" fill="#f44336"></circle><path d="M23.93 29.7c4.5-7.1 14.1-13 24.1-14.8c2.5-.4 5-.6 7.1.2c1.6.6 2.9 2.1 2 3.8c-.7 1.4-2.6 2-4.1 2.5a44.64 44.64 0 0 0-23 17.4c-2 3-5 11.3-8.7 9.2c-3.9-2.3-3.1-9.5 2.6-18.3z" fill="#ff8a80"></path></g></svg>';
                } else if (newStatus === 'in_game') {
                    statusIcon.innerHTML = '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" fill="#1E88E5"><circle cx="64" cy="64" r="60" fill="#42A5F5"></circle><circle cx="64" cy="64" r="56" fill="#90CAF9"></circle></svg>';            
                } else if (newStatus === 'available') {
                    statusIcon.innerHTML = '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--noto" preserveAspectRatio="xMidYMid meet" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><circle cx="63.93" cy="64" r="60" fill="#689f38"></circle><circle cx="60.03" cy="63.1" r="56.1" fill="#7cb342"></circle><path d="M23.93 29.7c4.5-7.1 14.1-13 24.1-14.8c2.5-.4 5-.6 7.1.2c1.6.6 2.9 2.1 2 3.8c-.7 1.4-2.6 2-4.1 2.5a44.64 44.64 0 0 0-23 17.4c-2 3-5 11.3-8.7 9.2c-3.9-2.3-3.1-9.5 2.6-18.3z" fill="#aed581"></path></g></svg>';
                }
            }
        }
    });
}














